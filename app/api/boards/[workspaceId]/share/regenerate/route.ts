import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { isBlockedUser } from '@/lib/authState';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { buildWorkspaceShareUrl, generateShareNonce, getShareRoleFromLegacyDuplicateValue } from '@/lib/workspaceSharing';

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

const getAuthToken = (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.replace('Bearer ', '');
};

const buildShareResponse = (request: NextRequest, workspace: ShareWorkspaceRow) => ({
    boardId: workspace.id,
    boardName: workspace.name,
    visibility: workspace.share_visibility === 'link_view' ? 'link_view' : 'private',
    accessRole: getShareRoleFromLegacyDuplicateValue(workspace.allow_public_duplicate),
    allowDuplicate: false,
    isEnabled: workspace.share_visibility === 'link_view' && Boolean(workspace.share_token_nonce),
    shareUrl: workspace.share_visibility === 'link_view' && workspace.share_token_nonce
        ? buildWorkspaceShareUrl(request.nextUrl.origin, workspace.id, workspace.share_token_nonce)
        : null,
    sharedAt: workspace.shared_at ?? null,
    shareUpdatedAt: workspace.share_updated_at ?? null,
});

export async function POST(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const token = getAuthToken(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (isBlockedUser(user)) {
        return NextResponse.json({ error: 'Account blocked', code: 'ACCOUNT_BLOCKED' }, { status: 403 });
    }

    const rl = checkRateLimit(`share-regenerate:user:${user.id}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .select(SHARE_SELECT)
        .eq('id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

    if (workspaceError) {
        return NextResponse.json({ error: 'Failed to load board share settings' }, { status: 500 });
    }

    if (!workspace) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const typedWorkspace = workspace as ShareWorkspaceRow;

    if (typedWorkspace.share_visibility !== 'link_view') {
        return NextResponse.json({ error: 'Board sharing is not enabled' }, { status: 400 });
    }

    try {
        const { data: updated, error } = await supabaseAdmin
            .from('workspaces')
            .update({
                share_token_nonce: generateShareNonce(),
                share_updated_at: new Date().toISOString(),
            })
            .eq('id', workspaceId)
            .eq('user_id', user.id)
            .select(SHARE_SELECT)
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json(buildShareResponse(request, updated as ShareWorkspaceRow));
    } catch (error) {
        console.error('Regenerate board share link failed:', error);
        return NextResponse.json({ error: 'Failed to regenerate share link' }, { status: 500 });
    }
}
