const DEFAULT_PRODUCTION_URL = 'https://paapan.com';

const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

export function getCanonicalAuthOrigin() {
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (typeof window !== 'undefined') {
        const { origin, hostname } = window.location;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return normalizeUrl(origin);
        }

        if (configuredUrl) {
            return normalizeUrl(configuredUrl);
        }

        if (hostname === 'paapan.com' || hostname === 'www.paapan.com') {
            return normalizeUrl(origin);
        }
    }

    if (configuredUrl) {
        return normalizeUrl(configuredUrl);
    }

    return DEFAULT_PRODUCTION_URL;
}

export function getAuthCallbackUrl(next = '/') {
    return `${getCanonicalAuthOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

export function getResetPasswordUrl() {
    return `${getCanonicalAuthOrigin()}/reset-password`;
}
