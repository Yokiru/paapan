import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Rate limiter for Next.js API routes.
 *
 * `checkRateLimit` is the in-memory fallback.
 * `checkPersistentRateLimit` uses the Supabase `check_rate_limit` RPC when the
 * migration exists, so limits survive Vercel cold starts and multiple instances.
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

export interface RateLimitConfig {
    /** Maximum number of requests allowed within the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
}

export interface RateLimitResult {
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

const persistentRateLimitWarnings = new Set<string>();

const warnPersistentRateLimitFallback = (identifier: string, error: unknown) => {
    const key = error instanceof Error ? error.message : String(error);
    if (persistentRateLimitWarnings.has(key)) return;
    persistentRateLimitWarnings.add(key);
    console.warn(`[SECURITY] Persistent rate limit unavailable, falling back to memory for ${identifier}:`, error);
};

/**
 * Persistent rate limit backed by Supabase.
 *
 * Requires `docs/16_rate_limit_storage.sql` to be applied. If the RPC/table is
 * missing, we intentionally fall back to the in-memory limiter so local dev and
 * partially migrated environments stay usable.
 */
export async function checkPersistentRateLimit(
    identifier: string,
    config: RateLimitConfig,
    supabase?: SupabaseClient
): Promise<RateLimitResult> {
    if (!supabase) {
        return checkRateLimit(identifier, config);
    }

    try {
        const { data, error } = await supabase
            .rpc('check_rate_limit', {
                p_identifier: identifier,
                p_max_requests: config.maxRequests,
                p_window_seconds: config.windowSeconds,
            })
            .single();

        if (error || !data) {
            throw error ?? new Error('No rate limit response');
        }

        const row = data as {
            allowed?: unknown;
            remaining?: unknown;
            reset_at?: unknown;
        };
        const resetAtDate = typeof row.reset_at === 'string'
            ? new Date(row.reset_at)
            : null;

        return {
            allowed: row.allowed === true,
            remaining: typeof row.remaining === 'number' ? row.remaining : 0,
            resetAt: resetAtDate && Number.isFinite(resetAtDate.getTime())
                ? resetAtDate.getTime()
                : Date.now() + config.windowSeconds * 1000,
        };
    } catch (error) {
        warnPersistentRateLimitFallback(identifier, error);
        return checkRateLimit(identifier, config);
    }
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
    /** Pre-auth generate guard: 10 requests per minute per low-trust client fingerprint */
    generatePreAuth: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
    /** AI generation: 20 requests per minute */
    generate: { maxRequests: 20, windowSeconds: 60 } as RateLimitConfig,
    /** URL scraping: 10 requests per minute */
    scrape: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
    /** Feedback guest/client guard: 5 submissions per 10 minutes */
    feedbackClient: { maxRequests: 5, windowSeconds: 10 * 60 } as RateLimitConfig,
    /** Feedback authenticated guard: 3 submissions per 10 minutes */
    feedbackUser: { maxRequests: 3, windowSeconds: 10 * 60 } as RateLimitConfig,
    /** General API: 60 requests per minute */
    general: { maxRequests: 60, windowSeconds: 60 } as RateLimitConfig,
};
