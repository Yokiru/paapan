import type { SupabaseClient } from '@supabase/supabase-js';
import { IMAGE_UPLOAD_BUCKET } from '@/lib/creditCosts';

export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 7;
export const ACCOUNT_DELETION_REAUTH_WINDOW_MINUTES = 10;

type AdminSupabaseClient = SupabaseClient<any, 'public', any>;

type AuthUserLike = {
    id: string;
    email?: string | null;
    identities?: Array<{ provider?: string | null }> | null;
    app_metadata?: Record<string, unknown> | null;
    last_sign_in_at?: string | null;
};

const isMissingRelationError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? error.code : '';
    const maybeMessage = 'message' in error ? error.message : '';
    const code = typeof maybeCode === 'string' ? maybeCode : '';
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';

    return code === '42P01' || (message.includes('relation') && message.includes('does not exist'));
};

const isMissingStoragePathError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeMessage = 'message' in error ? error.message : '';
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';

    return message.includes('not found') || message.includes('no such file') || message.includes('does not exist');
};

function listIdentityProviders(user: AuthUserLike) {
    const identityProviders = (user.identities ?? [])
        .map((identity) => identity.provider)
        .filter((provider): provider is string => typeof provider === 'string' && provider.length > 0);

    if (identityProviders.length > 0) {
        return Array.from(new Set(identityProviders));
    }

    const metadataProviders = user.app_metadata?.providers;
    if (Array.isArray(metadataProviders)) {
        return metadataProviders.filter((provider): provider is string => typeof provider === 'string' && provider.length > 0);
    }

    return user.email ? ['email'] : [];
}

export function accountSupportsPasswordReauth(user: AuthUserLike) {
    return listIdentityProviders(user).includes('email');
}

export function hasRecentSignIn(user: AuthUserLike, now = Date.now()) {
    if (!user.last_sign_in_at) return false;

    const lastSignIn = new Date(user.last_sign_in_at).getTime();
    if (!Number.isFinite(lastSignIn)) return false;

    return now - lastSignIn <= ACCOUNT_DELETION_REAUTH_WINDOW_MINUTES * 60 * 1000;
}

export function getDeletionEffectiveAt(baseDate = new Date()) {
    const effectiveAt = new Date(baseDate);
    effectiveAt.setDate(effectiveAt.getDate() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS);
    return effectiveAt;
}

export function buildDeletionAppMetadata(
    currentMetadata: Record<string, unknown> | null | undefined,
    requestedAtIso: string,
    effectiveAtIso: string
) {
    return {
        ...(currentMetadata || {}),
        deletion_requested_at: requestedAtIso,
        deletion_effective_at: effectiveAtIso,
        deletion_state: 'scheduled',
        deletion_source: 'self_service',
    };
}

export function clearDeletionAppMetadata(currentMetadata: Record<string, unknown> | null | undefined) {
    const nextMetadata = { ...(currentMetadata || {}) } as Record<string, unknown>;

    delete nextMetadata.deletion_requested_at;
    delete nextMetadata.deletion_effective_at;
    delete nextMetadata.deletion_state;
    delete nextMetadata.deletion_source;

    return nextMetadata;
}

async function listStoragePaths(
    supabaseAdmin: AdminSupabaseClient,
    bucket: string,
    prefix: string
): Promise<string[]> {
    const storage = supabaseAdmin.storage.from(bucket);
    const collected: string[] = [];
    let offset = 0;

    while (true) {
        const { data, error } = await storage.list(prefix, {
            limit: 1000,
            offset,
            sortBy: { column: 'name', order: 'asc' },
        });

        if (error) {
            if (isMissingStoragePathError(error)) {
                return collected;
            }

            throw error;
        }

        if (!data || data.length === 0) {
            return collected;
        }

        for (const item of data) {
            const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
            const isFolder = !item.id;

            if (isFolder) {
                const nested = await listStoragePaths(supabaseAdmin, bucket, fullPath);
                collected.push(...nested);
                continue;
            }

            collected.push(fullPath);
        }

        if (data.length < 1000) {
            return collected;
        }

        offset += 1000;
    }
}

async function deleteIfExists(
    supabaseAdmin: AdminSupabaseClient,
    table: string,
    column: string,
    value: string
) {
    const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq(column, value);

    if (error && !isMissingRelationError(error)) {
        throw error;
    }
}

export async function hardDeleteAccount(supabaseAdmin: AdminSupabaseClient, userId: string) {
    const storagePaths = await listStoragePaths(supabaseAdmin, IMAGE_UPLOAD_BUCKET, userId);
    if (storagePaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
            .from(IMAGE_UPLOAD_BUCKET)
            .remove(storagePaths);

        if (storageError && !isMissingStoragePathError(storageError)) {
            throw storageError;
        }
    }

    await deleteIfExists(supabaseAdmin, 'ai_events', 'user_id', userId);
    await deleteIfExists(supabaseAdmin, 'credit_transactions', 'user_id', userId);
    await deleteIfExists(supabaseAdmin, 'credit_balances', 'user_id', userId);
    await deleteIfExists(supabaseAdmin, 'subscriptions', 'user_id', userId);
    await deleteIfExists(supabaseAdmin, 'workspaces', 'user_id', userId);
    await deleteIfExists(supabaseAdmin, 'profiles', 'id', userId);

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
        throw deleteUserError;
    }
}
