import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';
import {
    type PublicWorkspaceBoardPayload,
    normalizeWorkspaceShareVisibility,
} from '@/lib/workspaceSharing';
import type { WorkspaceShareAccessRole } from '@/types';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const FRAME_NODE_TYPE = '__frame_region__';

type RouteContext = {
    params: Promise<{ workspaceId: string }>;
};

type PublicWorkspaceRow = {
    id: string;
    name: string;
    nodes?: unknown[];
    edges?: unknown[];
    strokes?: unknown[];
    arrows?: unknown[];
    updated_at?: string | null;
    share_updated_at?: string | null;
    share_visibility?: string | null;
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

const buildPublicBoardPayload = (
    workspace: PublicWorkspaceRow,
    accessRole: WorkspaceShareAccessRole = 'viewer'
): PublicWorkspaceBoardPayload => {
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
        shareUpdatedAt: workspace.share_updated_at ?? null,
        accessRole,
        allowDuplicate: workspace.allow_public_duplicate === true,
    };
};

const jsonNoStore = (body: unknown, init?: ResponseInit) => {
    const headers = new Headers(init?.headers);
    headers.set('Cache-Control', 'no-store, max-age=0');
    return NextResponse.json(body, {
        ...init,
        headers,
    });
};

export async function GET(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const rl = checkRateLimit(`public-board-by-id:${getClientIP(request)}:${workspaceId}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select('id,name,nodes,edges,strokes,arrows,updated_at,share_updated_at,share_visibility,allow_public_duplicate')
        .eq('id', workspaceId)
        .maybeSingle();

    if (error) {
        console.error('Public board by id lookup failed:', error);
        return NextResponse.json({ error: 'Failed to load public board' }, { status: 500 });
    }

    if (!workspace) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const typedWorkspace = workspace as PublicWorkspaceRow;

    if (normalizeWorkspaceShareVisibility(typedWorkspace.share_visibility) !== 'link_view') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return jsonNoStore({
        board: buildPublicBoardPayload(typedWorkspace),
    });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const { workspaceId } = await context.params;
    const rl = checkRateLimit(`public-board-by-id-edit:${getClientIP(request)}:${workspaceId}`, RATE_LIMITS.general);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    return NextResponse.json({ error: 'Public boards are view-only' }, { status: 403 });
}
