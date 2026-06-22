const FALLBACK_ADMIN_EMAILS = ['yosiamanullang@gmail.com'];

export const ADMIN_EMAIL_ALLOWLIST = (process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const adminEmailSet = new Set(
    (ADMIN_EMAIL_ALLOWLIST.length > 0 ? ADMIN_EMAIL_ALLOWLIST : FALLBACK_ADMIN_EMAILS).map((email) =>
        email.toLowerCase()
    )
);

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return adminEmailSet.has(email.toLowerCase());
}
