type MaybeRestrictedUser = {
    banned_until?: string | null;
    app_metadata?: Record<string, unknown> | null;
};

function getValidTimestamp(value: unknown) {
    if (typeof value !== 'string' || !value) return null;

    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return null;

    return timestamp;
}

export function getScheduledDeletionDate(user: MaybeRestrictedUser | null | undefined) {
    const appMetadata = user?.app_metadata;
    if (!appMetadata || typeof appMetadata !== 'object') return null;

    const rawValue = appMetadata.deletion_effective_at;
    if (typeof rawValue !== 'string' || !rawValue) return null;

    const timestamp = getValidTimestamp(rawValue);
    if (!timestamp) return null;

    return rawValue;
}

export function isDeletionScheduledUser(user: MaybeRestrictedUser | null | undefined): boolean {
    return Boolean(getScheduledDeletionDate(user));
}

export function isBlockedUser(user: MaybeRestrictedUser | null | undefined): boolean {
    const bannedUntil = getValidTimestamp(user?.banned_until);
    if (bannedUntil && bannedUntil > Date.now()) {
        return true;
    }

    return isDeletionScheduledUser(user);
}
