/**
 * Simple in-memory rate limiter for Next.js API routes
 * No external dependencies required (Redis not needed)
 * 
 * SECURITY: Prevents abuse by limiting requests per IP per time window
 * NOTE: In serverless (Vercel), each cold start resets the map.
 *       For production at scale, consider @upstash/ratelimit + Redis.
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

interface RateLimitConfig {
    /** Maximum number of requests allowed within the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

/**
 * Check if a request from the given identifier is within rate limits
 * @param identifier - Unique identifier (usually IP address or userId)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const key = identifier;

    const existing = rateLimitMap.get(key);

    // If no existing entry or window expired, start fresh
    if (!existing || now > existing.resetAt) {
        rateLimitMap.set(key, {
            count: 1,
            resetAt: now + windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetAt: now + windowMs,
        };
    }

    // Within window: check count
    if (existing.count >= config.maxRequests) {
        return {
            allowed: false,
            remaining: 0,
            resetAt: existing.resetAt,
        };
    }

    // Increment and allow
    existing.count += 1;
    return {
        allowed: true,
        remaining: config.maxRequests - existing.count,
        resetAt: existing.resetAt,
    };
}

/**
 * Best-effort client IP extraction for logging or low-trust guest fallbacks only.
 * Do not use this as the primary identifier for authenticated rate limits.
 */
export function getClientIP(req: Request): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}

// Pre-configured rate limit profiles
export const RATE_LIMITS = {
    /** AI generation: 20 requests per minute */
    generate: { maxRequests: 20, windowSeconds: 60 } as RateLimitConfig,
    /** URL scraping: 10 requests per minute */
    scrape: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
    /** General API: 60 requests per minute */
    general: { maxRequests: 60, windowSeconds: 60 } as RateLimitConfig,
};
