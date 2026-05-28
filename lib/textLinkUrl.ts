"use client";

export const sanitizeTextLinkUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('/')) return trimmed;
    if (trimmed.startsWith('#')) return trimmed;

    const normalized = trimmed.startsWith('www.')
        ? `https://${trimmed}`
        : trimmed;

    try {
        const parsed = new URL(normalized);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
            return parsed.toString();
        }
    } catch {
        return '';
    }

    return '';
};
