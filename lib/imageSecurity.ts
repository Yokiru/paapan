const SAFE_DATA_IMAGE_MIME_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,/i;
const SAFE_UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'] as const;

export const SAFE_BROWSER_IMAGE_MIME_TYPES = [...SAFE_UPLOAD_MIME_TYPES];

export const isSafeUploadImageMimeType = (value: string | undefined | null) => (
    typeof value === 'string' && SAFE_UPLOAD_MIME_TYPES.includes(value.toLowerCase() as typeof SAFE_UPLOAD_MIME_TYPES[number])
);

export const sanitizeCanvasImageSrc = (value: string | undefined | null) => {
    if (!value || typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('blob:')) {
        return trimmed;
    }

    if (SAFE_DATA_IMAGE_MIME_PATTERN.test(trimmed)) {
        return trimmed;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        return '';
    }

    return '';
};
