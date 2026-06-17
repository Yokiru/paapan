import { NextRequest, NextResponse } from 'next/server';
import { Liveblocks } from '@liveblocks/node';
import { createClient } from '@supabase/supabase-js';

import { isBlockedUser } from '@/lib/authState';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { fetchServerSubscriptionTier, isPaidCollabTier } from '@/lib/serverSubscription';
import { getShareRoleFromLegacyDuplicateValue, normalizeWorkspaceShareVisibility } from '@/lib/workspaceSharing';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY || '';
const liveblocks = liveblocksSecret ? new Liveblocks({ secret: liveblocksSecret }) : null;

type WorkspaceRow = {
    id: string;
    user_id: string;
    share_visibility?: string | null;
    allow_public_duplicate?: boolean | null;
};

const getAuthToken = (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.replace('Bearer ', '');
};

const getWorkspaceIdFromRoom = (room: unknown) => {
    if (typeof room !== 'string') return null;
    const prefix = 'paapan:board:';
    if (!room.startsWith(prefix)) return null;
    const workspaceId = room.slice(prefix.length);
    return workspaceId || null;
};

export async function POST(request: NextRequest) {
    if (!liveblocks) {
        return NextResponse.json({ error: 'Liveblocks is not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const room = typeof body?.room === 'string' ? body.room : '';
    const workspaceId = getWorkspaceIdFromRoom(room);
    if (!workspaceId) {
        return NextResponse.json({ error: 'Invalid room' }, { status: 400 });
    }

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

    const rl = checkRateLimit(`liveblocks-auth:user:${user.id}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .select('id,user_id,share_visibility,allow_public_duplicate')
        .eq('id', workspaceId)
        .maybeSingle();

    if (workspaceError) {
        console.error('Liveblocks workspace lookup failed:', workspaceError);
        return NextResponse.json({ error: 'Failed to load board' }, { status: 500 });
    }

    if (!workspace) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const typedWorkspace = workspace as WorkspaceRow;
    const isOwner = typedWorkspace.user_id === user.id;
    const shareVisibility = normalizeWorkspaceShareVisibility(typedWorkspace.share_visibility);
    const shareRole = getShareRoleFromLegacyDuplicateValue(typedWorkspace.allow_public_duplicate);
    const tier = await fetchServerSubscriptionTier(supabaseAdmin, user.id);

    if (!isPaidCollabTier(tier)) {
        return NextResponse.json({ error: 'Realtime collaboration requires a paid plan' }, { status: 402 });
    }

    if (shareVisibility !== 'link_view' || shareRole !== 'editor') {
        return NextResponse.json({ error: 'Realtime collaboration is not enabled for this board' }, { status: 403 });
    }

    const session = liveblocks.prepareSession(user.id, {
        userInfo: {
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pengguna baru',
            email: user.email || undefined,
            role: isOwner ? 'owner' : 'editor',
            tier,
        },
    });

    session.allow(room, session.FULL_ACCESS);

    const { body: responseBody, status } = await session.authorize();
    return new NextResponse(responseBody, { status });
}
