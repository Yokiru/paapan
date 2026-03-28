type MaybeBannedUser = {
    banned_until?: string | null;
};

export function isBlockedUser(user: MaybeBannedUser | null | undefined): boolean {
    if (!user?.banned_until) return false;

    const bannedUntil = new Date(user.banned_until).getTime();
    if (!Number.isFinite(bannedUntil)) return false;

    return bannedUntil > Date.now();
}
