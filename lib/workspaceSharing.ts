import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { WorkspaceShareAccessRole, WorkspaceShareVisibility } from '@/types';

export const WORKSPACE_SHARE_VISIBILITIES = ['private', 'link_view'] as const;

const SHARE_TOKEN_NONCE_BYTES = 18;

const toBase64Url = (value: Buffer) => value.toString('base64url');

const getShareSecret = () => {
    const secret = process.env.PAAPAN_SHARE_SECRET
        || process.env.SHARE_LINK_SECRET
        || process.env.SUPABASE_SERVICE_ROLE_KEY
        || '';
    if (secret) return secret;

    if (process.env.NODE_ENV !== 'production') {
        return 'paapan-dev-share-secret-change-me';
    }

    throw new Error('PAAPAN_SHARE_SECRET is not configured');
};

const signShareNonce = (workspaceId: string, nonce: string) => (
    toBase64Url(
        createHmac('sha256', getShareSecret())
            .update(`${workspaceId}:${nonce}`)
            .digest()
    )
);

export const generateShareNonce = () => toBase64Url(randomBytes(SHARE_TOKEN_NONCE_BYTES));

export const buildWorkspaceShareToken = (workspaceId: string, nonce: string) => {
    const signature = signShareNonce(workspaceId, nonce);
    return `${nonce}.${signature}`;
};

export const parseWorkspaceShareToken = (token: string) => {
    const normalized = token.trim();
    const [nonce, signature, extra] = normalized.split('.');
    if (!nonce || !signature || extra) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(nonce) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;

    return { nonce, signature };
};

export const verifyWorkspaceShareToken = (workspaceId: string, token: string) => {
    const parsed = parseWorkspaceShareToken(token);
    if (!parsed) return false;

    const expectedSignature = signShareNonce(workspaceId, parsed.nonce);
    const provided = Buffer.from(parsed.signature);
    const expected = Buffer.from(expectedSignature);

    if (provided.length !== expected.length) return false;

    return timingSafeEqual(provided, expected);
};

export const normalizeWorkspaceShareVisibility = (value: unknown): WorkspaceShareVisibility => (
    value === 'link_view' ? 'link_view' : 'private'
);

export const normalizeWorkspaceShareAccessRole = (value: unknown): WorkspaceShareAccessRole => (
    value === 'editor' ? 'editor' : 'viewer'
);

export const getLegacyDuplicateValueForShareRole = (role: WorkspaceShareAccessRole) => (
    role !== 'editor'
);

export const getShareRoleFromLegacyDuplicateValue = (value: unknown): WorkspaceShareAccessRole => (
    value === false ? 'editor' : 'viewer'
);

export const buildWorkspaceShareUrl = (origin: string, workspaceId: string, _nonce: string) => {
    return `${origin.replace(/\/$/, '')}/board/${workspaceId}`;
};

export type PublicWorkspaceBoardPayload = {
    boardId: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
    frames: unknown[];
    strokes: unknown[];
    arrows: unknown[];
    updatedAt: string;
    accessRole: WorkspaceShareAccessRole;
    allowDuplicate: boolean;
};
