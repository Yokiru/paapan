import { lookup } from 'node:dns/promises';
import net from 'node:net';

export type SafeFetchResult = {
    finalUrl: string;
    status: number;
    headers: Headers;
    contentType: string;
    bytes: Uint8Array;
};

export type SafeFetchOptions = {
    headers?: HeadersInit;
    maxBytes: number;
    timeoutMs: number;
    maxRedirects?: number;
    allowedContentTypes?: string[];
};

export class SafeFetchError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status = 400) {
        super(message);
        this.name = 'SafeFetchError';
        this.code = code;
        this.status = status;
    }
}

const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain',
    '0',
]);

const BLOCKED_HOST_SUFFIXES = [
    '.localhost',
    '.local',
    '.internal',
    '.lan',
    '.home',
];

const normalizeHostname = (hostname: string) => (
    hostname
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.$/, '')
);

const parseIPv4 = (address: string): number[] | null => {
    const parts = address.split('.');
    if (parts.length !== 4) return null;

    const octets = parts.map((part) => {
        if (!/^\d{1,3}$/.test(part)) return NaN;
        const value = Number(part);
        return value >= 0 && value <= 255 ? value : NaN;
    });

    return octets.every(Number.isFinite) ? octets : null;
};

const isBlockedIPv4 = (address: string) => {
    const octets = parseIPv4(address);
    if (!octets) return false;

    const [a, b, c, d] = octets;

    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    return false;
};

const isBlockedIPv6 = (address: string) => {
    const normalized = normalizeHostname(address);
    const mappedIPv4 = normalized.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedIPv4) return isBlockedIPv4(mappedIPv4[1]);

    return (
        normalized === '::' ||
        normalized === '::1' ||
        normalized.startsWith('fc') ||
        normalized.startsWith('fd') ||
        normalized.startsWith('fe8') ||
        normalized.startsWith('fe9') ||
        normalized.startsWith('fea') ||
        normalized.startsWith('feb') ||
        normalized.startsWith('ff')
    );
};

const isBlockedIPAddress = (address: string) => {
    const normalized = normalizeHostname(address);
    const ipVersion = net.isIP(normalized);

    if (ipVersion === 4) return isBlockedIPv4(normalized);
    if (ipVersion === 6) return isBlockedIPv6(normalized);

    return false;
};

export const assertSafeExternalUrl = async (urlString: string): Promise<URL> => {
    let url: URL;
    try {
        url = new URL(urlString);
    } catch {
        throw new SafeFetchError('INVALID_URL', 'Invalid URL format');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new SafeFetchError('UNSUPPORTED_PROTOCOL', 'Only HTTP and HTTPS URLs are allowed');
    }

    if (url.username || url.password) {
        throw new SafeFetchError('URL_CREDENTIALS_BLOCKED', 'URL credentials are not allowed', 403);
    }

    const hostname = normalizeHostname(url.hostname);
    if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
        throw new SafeFetchError('HOST_BLOCKED', 'This host is not allowed', 403);
    }

    if (!hostname.includes('.') && net.isIP(hostname) === 0) {
        throw new SafeFetchError('INTRANET_HOST_BLOCKED', 'Single-label hosts are not allowed', 403);
    }

    if (isBlockedIPAddress(hostname)) {
        throw new SafeFetchError('IP_BLOCKED', 'This IP address is not allowed', 403);
    }

    if (net.isIP(hostname) === 0) {
        let addresses: Array<{ address: string }> = [];
        try {
            addresses = await lookup(hostname, { all: true, verbatim: true });
        } catch {
            throw new SafeFetchError('DNS_LOOKUP_FAILED', 'Unable to resolve host');
        }

        if (addresses.length === 0 || addresses.some((entry) => isBlockedIPAddress(entry.address))) {
            throw new SafeFetchError('DNS_PRIVATE_IP_BLOCKED', 'Host resolves to a blocked IP address', 403);
        }
    }

    return url;
};

const joinRedirectUrl = (location: string, baseUrl: string) => {
    try {
        return new URL(location, baseUrl).toString();
    } catch {
        throw new SafeFetchError('INVALID_REDIRECT', 'Invalid redirect URL');
    }
};

const readResponseBytes = async (response: Response, maxBytes: number) => {
    if (!response.body) {
        return new Uint8Array(await response.arrayBuffer());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            await reader.cancel();
            throw new SafeFetchError('RESPONSE_TOO_LARGE', 'Response is too large', 413);
        }

        chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return bytes;
};

export const safeFetchBytes = async (
    urlString: string,
    options: SafeFetchOptions,
    redirectCount = 0
): Promise<SafeFetchResult> => {
    const maxRedirects = options.maxRedirects ?? 3;
    const url = await assertSafeExternalUrl(urlString);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
        const response = await fetch(url.toString(), {
            headers: options.headers,
            redirect: 'manual',
            signal: controller.signal,
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
            if (redirectCount >= maxRedirects) {
                throw new SafeFetchError('TOO_MANY_REDIRECTS', 'Too many redirects');
            }

            const location = response.headers.get('location');
            if (!location) {
                throw new SafeFetchError('INVALID_REDIRECT', 'Redirect missing location header');
            }

            return safeFetchBytes(joinRedirectUrl(location, url.toString()), options, redirectCount + 1);
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';
        if (
            options.allowedContentTypes?.length &&
            !options.allowedContentTypes.some((allowed) => contentType.startsWith(allowed.toLowerCase()))
        ) {
            throw new SafeFetchError('CONTENT_TYPE_BLOCKED', 'Response content type is not allowed', 415);
        }

        const contentLength = response.headers.get('content-length');
        const declaredSize = contentLength ? Number(contentLength) : 0;
        if (Number.isFinite(declaredSize) && declaredSize > options.maxBytes) {
            throw new SafeFetchError('RESPONSE_TOO_LARGE', 'Response is too large', 413);
        }

        const bytes = await readResponseBytes(response, options.maxBytes);

        return {
            finalUrl: url.toString(),
            status: response.status,
            headers: response.headers,
            contentType,
            bytes,
        };
    } catch (error) {
        if (error instanceof SafeFetchError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
            throw new SafeFetchError('FETCH_TIMEOUT', 'Fetch timed out', 408);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export const safeFetchText = async (urlString: string, options: SafeFetchOptions) => {
    const result = await safeFetchBytes(urlString, {
        ...options,
        allowedContentTypes: options.allowedContentTypes ?? [
            'text/',
            'application/json',
            'application/xml',
            'application/xhtml+xml',
        ],
    });

    return {
        ...result,
        text: new TextDecoder('utf-8', { fatal: false }).decode(result.bytes),
    };
};
