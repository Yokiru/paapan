import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkPersistentRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { isBlockedUser } from '@/lib/authState';
import { SafeFetchError, safeFetchText } from '@/lib/safeFetch';

// Init Supabase Admin for auth verification
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MAX_SCRAPE_RESPONSE_BYTES = 500_000;
const SCRAPE_TIMEOUT_MS = 8_000;

/**
 * API Route for scraping URL content
 * SECURITY: Requires authentication + SSRF protection + Rate limiting
 */
export async function POST(request: NextRequest) {
    try {
        // SECURITY: Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError || !user) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        if (isBlockedUser(user)) {
            return NextResponse.json(
                { error: 'Account blocked', code: 'ACCOUNT_BLOCKED' },
                { status: 403 }
            );
        }

        // SECURITY: Authenticated rate limiting keyed by verified user ID.
        const rateLimitResult = await checkPersistentRateLimit(
            `scrape:user:${user.id}`,
            RATE_LIMITS.scrape,
            supabaseAdmin
        );
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
                { status: 429 }
            );
        }

        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        const response = await safeFetchText(url, {
            maxBytes: MAX_SCRAPE_RESPONSE_BYTES,
            timeoutMs: SCRAPE_TIMEOUT_MS,
            headers: {
                'User-Agent': 'PaapanBot/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (response.status < 200 || response.status >= 300) {
            return NextResponse.json(
                { error: `Failed to fetch URL: ${response.status}` },
                { status: response.status }
            );
        }

        const html = response.text;
        const finalUrl = new URL(response.finalUrl);

        // Extract text content from HTML
        const textContent = extractTextFromHtml(html);

        // Get page title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : finalUrl.hostname;

        return NextResponse.json({
            success: true,
            title,
            content: textContent,
            url: finalUrl.toString(),
        });

    } catch (error) {
        if (error instanceof SafeFetchError) {
            console.warn(`[SECURITY] Blocked scrape request (${error.code}): ${error.message}`);
            return NextResponse.json(
                { error: 'URL not allowed for security reasons', code: error.code },
                { status: error.status }
            );
        }

        console.error('Scrape error:', error);
        return NextResponse.json(
            { error: 'Failed to scrape URL' },
            { status: 500 }
        );
    }
}

/**
 * Extract readable text from HTML
 * Removes scripts, styles, and HTML tags
 */
function extractTextFromHtml(html: string): string {
    // Remove script and style tags with content
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');

    // Replace common block elements with newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // Limit to first ~5000 characters to avoid token limits
    if (text.length > 5000) {
        text = text.substring(0, 5000) + '...\n[Content truncated]';
    }

    return text;
}
