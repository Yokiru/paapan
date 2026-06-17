import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { isBlockedUser } from '@/lib/authState';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import {
    buildWorkspaceShareUrl,
    generateShareNonce,
    getLegacyDuplicateValueForShareRole,
    getShareRoleFromLegacyDuplicateValue,
    normalizeWorkspaceShareAccessRole,
    normalizeWorkspaceShareVisibility,
} from '@/lib/workspaceSharing';
import { fetchServerSubscriptionTier, isPaidCollabTier } from '@/lib/serverSubscription';
import type { WorkspaceShareVisibility } from '@/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type RouteContext = {
    params: Promise<{ workspaceId: string }>;
};

type ShareWorkspaceRow = {
    id: string;
    user_id: string;
    name: string;
    share_visibility?: string | null;
    share_token_nonce?: string | null;
    allow_public_duplicate?: boolean | null;
    shared_at?: string | null;
    share_updated_at?: string | null;
};

const SHARE_SELECT =
    'id,user_id,name,share_visibility,share_token_nonce,allow_public_duplicate,shared_at,share_updated_at';

const isShareVisibility = (value: unknown): value is WorkspaceShareVisibility => (
    value === 'private' || value === 'link_view'
);

const getAuthToken = (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.replace('Bearer ', '');
};

const buildShareResponse = (request: NextRequest, workspace: ShareWorkspaceRow) => {
    const visibility = normalizeWorkspaceShareVisibility(workspace.share_visibility);
    const shareUrl = visibility === 'link_view' && workspace.share_token_nonce
        ? buildWorkspaceShareUrl(request.nextUrl.origin, workspace.id, workspace.share_token_nonce)
        : null;

    return {
        boardId: workspace.id,
        boardName: workspace.name,
        visibility,
        accessRole: getShareRoleFromLegacyDuplicateValue(workspace.allow_public_duplicate),
        allowDuplicate: false,
        isEnabled: visibility === 'link_view' && Boolean(workspace.share_token_nonce),
        shareUrl,
        sharedAt: workspace.shared_at ?? null,
        shareUpdatedAt: workspace.share_updated_at ?? null,
    };
};

const requireOwnerWorkspace = async (request: NextRequest, workspaceId: string) => {
    const token = getAuthToken(request);
    if (!token) {
        return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return { errorResponse: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    if (isBlockedUser(user)) {
        return { errorResponse: NextResponse.json({ error: 'Account blocked', code: 'ACCOUNT_BLOCKED' }, { status: 403 }) };
    }

    const rl = checkRateLimit(`share-manage:user:${user.id}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return { errorResponse: NextResponse.json({ error: 'Rate limited' }, { status: 429 }) };
    }

    const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select(SHARE_SELECT)
        .eq('id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        return { errorResponse: NextResponse.json({ error: 'Failed to load board share settings' }, { status: 500 }) };
    }

    if (!workspace) {
        return { errorResponse: NextResponse.json({ error: 'Board not found' }, { status: 404 }) };
    }

    return { user, workspace: workspace as ShareWorkspaceRow };
};

const updateShareWorkspace = async (workspaceId: string, userId: string, updates: Record<string, unknown>) => {
    const { data, error } = await supabaseAdmin
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId)
        .eq('user_id', userId)
        .select(SHARE_SELECT)
        .single();

    if (error) {
        throw error;
    }

    return data as ShareWorkspaceRow;
};

const requirePaidRealtimeCollab = async (userId: string) => {
    const tier = await fetchServerSubscriptionTier(supabaseAdmin, userId);
    if (isPaidCollabTier(tier)) return null;

    return NextResponse.json(
        { error: 'Realtime collaboration requires a paid plan' },
        { status: 402 }
    );
};

export async function GET(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const result = await requireOwnerWorkspace(request, workspaceId);
    if ('errorResponse' in result) return result.errorResponse;

    return NextResponse.json(buildShareResponse(request, result.workspace));
}

export async function POST(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const result = await requireOwnerWorkspace(request, workspaceId);
    if ('errorResponse' in result) return result.errorResponse;

    const body = await request.json().catch(() => ({}));
    const accessRole = normalizeWorkspaceShareAccessRole(body?.accessRole);
    const nonce = result.workspace.share_token_nonce?.trim() || generateShareNonce();
    const nowIso = new Date().toISOString();

    if (accessRole === 'editor') {
        const errorResponse = await requirePaidRealtimeCollab(result.user.id);
        if (errorResponse) return errorResponse;
    }

    try {
        const updated = await updateShareWorkspace(workspaceId, result.user.id, {
            share_visibility: 'link_view',
            share_token_nonce: nonce,
            allow_public_duplicate: getLegacyDuplicateValueForShareRole(accessRole),
            shared_at: result.workspace.shared_at ?? nowIso,
            share_updated_at: nowIso,
        });

        return NextResponse.json(buildShareResponse(request, updated));
    } catch (error) {
        console.error('Enable board sharing failed:', error);
        return NextResponse.json({ error: 'Failed to enable board sharing' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const result = await requireOwnerWorkspace(request, workspaceId);
    if ('errorResponse' in result) return result.errorResponse;

    const body = await request.json().catch(() => ({}));
    const nextVisibility = body?.visibility;
    const accessRole = body?.accessRole === undefined
        ? getShareRoleFromLegacyDuplicateValue(result.workspace.allow_public_duplicate)
        : normalizeWorkspaceShareAccessRole(body.accessRole);

    if (nextVisibility !== undefined && !isShareVisibility(nextVisibility)) {
        return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
    }

    if (accessRole === 'editor') {
        const errorResponse = await requirePaidRealtimeCollab(result.user.id);
        if (errorResponse) return errorResponse;
    }

    const visibility = nextVisibility ?? normalizeWorkspaceShareVisibility(result.workspace.share_visibility);
    const nowIso = new Date().toISOString();
    const updates: Record<string, unknown> = {
        share_visibility: visibility,
        allow_public_duplicate: getLegacyDuplicateValueForShareRole(accessRole),
        share_updated_at: nowIso,
    };

    if (visibility === 'link_view') {
        updates.share_token_nonce = result.workspace.share_token_nonce?.trim() || generateShareNonce();
        updates.shared_at = result.workspace.shared_at ?? nowIso;
    } else {
        updates.share_token_nonce = null;
    }

    try {
        const updated = await updateShareWorkspace(workspaceId, result.user.id, updates);
        return NextResponse.json(buildShareResponse(request, updated));
    } catch (error) {
        console.error('Update board sharing failed:', error);
        return NextResponse.json({ error: 'Failed to update board sharing' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const result = await requireOwnerWorkspace(request, workspaceId);
    if ('errorResponse' in result) return result.errorResponse;

    try {
        const updated = await updateShareWorkspace(workspaceId, result.user.id, {
            share_visibility: 'private',
            share_token_nonce: null,
            share_updated_at: new Date().toISOString(),
        });

        return NextResponse.json(buildShareResponse(request, updated));
    } catch (error) {
        console.error('Disable board sharing failed:', error);
        return NextResponse.json({ error: 'Failed to disable board sharing' }, { status: 500 });
    }
}
