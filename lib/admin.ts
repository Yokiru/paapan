export const ADMIN_EMAIL_ALLOWLIST = ['yosiamanullang@gmail.com'] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAIL_ALLOWLIST.includes(email.toLowerCase() as (typeof ADMIN_EMAIL_ALLOWLIST)[number]);
}
