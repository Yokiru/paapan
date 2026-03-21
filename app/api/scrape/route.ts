import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

// Init Supabase Admin for auth verification
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * SECURITY: Validate URL to prevent SSRF attacks
 */
function isSafeUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        
        const hostname = url.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return false;
        
        const parts = hostname.split('.');
        if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
            const [a, b] = parts.map(Number);
            if (a === 10) return false;
            if (a === 172 && b >= 16 && b <= 31) return false;
            if (a === 192 && b === 168) return false;
            if (a === 169 && b === 254) return false;
            if (a === 0) return false;
        }
        
        return true;
    } catch {
        return false;
    }
}

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

        // SECURITY: Authenticated rate limiting keyed by verified user ID.
        const rateLimitResult = checkRateLimit(`scrape:user:${user.id}`, RATE_LIMITS.scrape);
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

        // Validate URL format
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // SECURITY: Block SSRF
        if (!isSafeUrl(url)) {
            console.warn(`[SECURITY] Blocked SSRF attempt by user ${user.id}: ${url}`);
            return NextResponse.json(
                { error: 'URL not allowed for security reasons' },
                { status: 403 }
            );
        }

        // Fetch the URL
        const response = await fetch(parsedUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SpatialAI/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch URL: ${response.status}` },
                { status: response.status }
            );
        }

        const html = await response.text();

        // Extract text content from HTML
        const textContent = extractTextFromHtml(html);

        // Get page title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

        return NextResponse.json({
            success: true,
            title,
            content: textContent,
            url: parsedUrl.toString(),
        });

    } catch (error) {
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
