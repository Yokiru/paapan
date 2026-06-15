import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';
import {
    type PublicWorkspaceBoardPayload,
    getShareRoleFromLegacyDuplicateValue,
    getLegacyDuplicateValueForShareRole,
    normalizeWorkspaceShareVisibility,
    parseWorkspaceShareToken,
    verifyWorkspaceShareToken,
} from '@/lib/workspaceSharing';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const FRAME_NODE_TYPE = '__frame_region__';

type RouteContext = {
    params: Promise<{ token: string }>;
};

type PublicWorkspaceRow = {
    id: string;
    name: string;
    nodes?: unknown[];
    edges?: unknown[];
    strokes?: unknown[];
    arrows?: unknown[];
    updated_at?: string | null;
    share_visibility?: string | null;
    share_token_nonce?: string | null;
    allow_public_duplicate?: boolean | null;
};

type PersistedFrameCarrier = {
    type: typeof FRAME_NODE_TYPE;
    data?: {
        frame?: unknown;
    };
};

const isPersistedFrameCarrier = (node: unknown): node is PersistedFrameCarrier => (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: unknown }).type === FRAME_NODE_TYPE
);

const extractFramesFromPersistedNodes = (nodes: unknown): { nodes: unknown[]; frames: unknown[] } => {
    if (!Array.isArray(nodes)) {
        return { nodes: [], frames: [] };
    }

    const visibleNodes: unknown[] = [];
    const frames: unknown[] = [];

    nodes.forEach((node) => {
        if (isPersistedFrameCarrier(node)) {
            if (node.data?.frame) {
                frames.push(node.data.frame);
            }
            return;
        }

        visibleNodes.push(node);
    });

    return { nodes: visibleNodes, frames };
};

const sanitizePublicNodes = (nodes: unknown[]) => (
    nodes.map((node) => {
        if (typeof node !== 'object' || node === null) return node;

        const nextNode = { ...(node as Record<string, unknown>) };
        if (typeof nextNode.data !== 'object' || nextNode.data === null) {
            return nextNode;
        }

        if (nextNode.type !== 'imageNode') {
            return nextNode;
        }

        const nextData = { ...(nextNode.data as Record<string, unknown>) };
        delete nextData.storagePath;
        delete nextData.storageBucket;
        nextNode.data = nextData;
        return nextNode;
    })
);

const buildPublicBoardPayload = (workspace: PublicWorkspaceRow): PublicWorkspaceBoardPayload => {
    const extracted = extractFramesFromPersistedNodes(workspace.nodes);

    return {
        boardId: workspace.id,
        name: workspace.name,
        nodes: sanitizePublicNodes(extracted.nodes),
        edges: Array.isArray(workspace.edges) ? workspace.edges : [],
        frames: extracted.frames,
        strokes: Array.isArray(workspace.strokes) ? workspace.strokes : [],
        arrows: Array.isArray(workspace.arrows) ? workspace.arrows : [],
        updatedAt: workspace.updated_at ?? new Date(0).toISOString(),
        accessRole: getShareRoleFromLegacyDuplicateValue(workspace.allow_public_duplicate),
        allowDuplicate: false,
    };
};

export async function GET(request: NextRequest, context: RouteContext) {
    const { token } = await context.params;
    const parsed = parseWorkspaceShareToken(token);
    if (!parsed) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rl = checkRateLimit(`public-board:${getClientIP(request)}:${parsed.nonce}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select('id,name,nodes,edges,strokes,arrows,updated_at,share_visibility,share_token_nonce,allow_public_duplicate')
        .eq('share_token_nonce', parsed.nonce)
        .maybeSingle();

    if (error) {
        console.error('Public board lookup failed:', error);
        return NextResponse.json({ error: 'Failed to load public board' }, { status: 500 });
    }

    if (!workspace) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const typedWorkspace = workspace as PublicWorkspaceRow;

    if (normalizeWorkspaceShareVisibility(typedWorkspace.share_visibility) !== 'link_view') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!verifyWorkspaceShareToken(typedWorkspace.id, token)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
        board: buildPublicBoardPayload(typedWorkspace),
    });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { token } = await context.params;
    const parsed = parseWorkspaceShareToken(token);
    if (!parsed) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const rl = checkRateLimit(`public-board-edit:${getClientIP(request)}:${parsed.nonce}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select('id,share_visibility,share_token_nonce,allow_public_duplicate')
        .eq('share_token_nonce', parsed.nonce)
        .maybeSingle();

    if (error) {
        console.error('Public board edit lookup failed:', error);
        return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
    }

    if (!workspace) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const typedWorkspace = workspace as PublicWorkspaceRow;

    if (
        normalizeWorkspaceShareVisibility(typedWorkspace.share_visibility) !== 'link_view' ||
        getShareRoleFromLegacyDuplicateValue(typedWorkspace.allow_public_duplicate) !== 'editor' ||
        !verifyWorkspaceShareToken(typedWorkspace.id, token)
    ) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const nodes = Array.isArray(body?.nodes) ? body.nodes : [];
    const edges = Array.isArray(body?.edges) ? body.edges : [];
    const strokes = Array.isArray(body?.strokes) ? body.strokes : [];
    const arrows = Array.isArray(body?.arrows) ? body.arrows : [];
    const viewport = typeof body?.viewport === 'object' && body.viewport !== null ? body.viewport : {};

    const viewportX = typeof viewport.x === 'number' && Number.isFinite(viewport.x) ? viewport.x : 0;
    const viewportY = typeof viewport.y === 'number' && Number.isFinite(viewport.y) ? viewport.y : 0;
    const viewportZoom = typeof viewport.zoom === 'number' && Number.isFinite(viewport.zoom) && viewport.zoom > 0
        ? viewport.zoom
        : 1;

    const updatedAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
        .from('workspaces')
        .update({
            nodes,
            edges,
            strokes,
            arrows,
            viewport_x: viewportX,
            viewport_y: viewportY,
            viewport_zoom: viewportZoom,
            allow_public_duplicate: getLegacyDuplicateValueForShareRole('editor'),
            updated_at: updatedAt,
        })
        .eq('id', typedWorkspace.id);

    if (updateError) {
        console.error('Public board edit failed:', updateError);
        return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt });
}
