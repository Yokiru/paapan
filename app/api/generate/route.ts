import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getModelById, canAccessModel, PlanType, DEFAULT_MODEL } from '@/lib/aiModels';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';


// Init Supabase Service Role (Admin) client untuk mem-bypass RLS
// Kita perlukan Service Role Key untuk mengatur balance User tanpa login NextAuth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const API_KEY = process.env.GEMINI_API_KEY || '';
// We initialize genAI dynamically per request now based on Custom Key vs System Key

// Define Cost Constants (harus sinkron dengan lib/creditCosts.ts)
const COST_TEXT = 5;
const COST_IMAGE = 10;
const COST_SCRAPE = 7;

// SECURITY: Server-side guest usage tracking by IP (resets when server restarts or every 24h)
const guestUsageMap = new Map<string, number>();
const GUEST_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => { guestUsageMap.clear(); }, GUEST_CLEANUP_INTERVAL);

/**
 * Detect urls in text
 */
function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    return text.match(urlRegex) || [];
}

/**
 * SECURITY: Validate URL to prevent SSRF attacks
 * Blocks internal IPs, loopback, metadata endpoints, and non-https protocols
 */
function isSafeUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        // Only allow http and https
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        
        const hostname = url.hostname.toLowerCase();
        
        // Block loopback
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return false;
        
        // Block private/internal IP ranges
        const parts = hostname.split('.');
        if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
            const [a, b] = parts.map(Number);
            if (a === 10) return false;                    // 10.0.0.0/8
            if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
            if (a === 192 && b === 168) return false;      // 192.168.0.0/16
            if (a === 169 && b === 254) return false;      // 169.254.0.0/16 (AWS metadata etc.)
            if (a === 0) return false;                     // 0.0.0.0/8
        }
        
        return true;
    } catch {
        return false;
    }
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
            if (matches) return { base64: matches[2], mimeType: matches[1] };
        }

        // SECURITY: Block SSRF attempts
        if (!isSafeUrl(imageUrl)) {
            console.warn(`[SECURITY] Blocked unsafe image URL: ${imageUrl}`);
            return null;
        }

        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        return { base64, mimeType };
    } catch (error) {
        console.error('API Error converting image to base64:', error);
        return null;
    }
}

export async function POST(req: Request) {
    // SECURITY: Rate limiting (20 requests per minute per IP)
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(`generate:${clientIP}`, RATE_LIMITS.generate);
    if (!rateLimitResult.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
            { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
        );
    }

    if (!API_KEY && !req.headers.get('x-custom-api-key')) {
        return NextResponse.json(
            { error: 'Kunci API Gemini belum dipasang di Server (.env.local). Silakan periksa pengaturan Vercel atau file lokal Anda.' },
            { status: 400 }
        );
    }

    try {
        const body = await req.json();
        const { question, context, imageUrls, actionType, aiSettings, planType, selectedModelId, webSearchEnabled } = body;

        // Resolved user tier (set inside userId block, used later for model selection)
        let resolvedTier: PlanType = 'free';

        // SECURITY: Verify userId via JWT token (not from body!)
        let userId: string | null = null;
        const authHeader = req.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (!authError && user) {
                userId = user.id;
            }
        }

        // 0. GUEST BLOCK — AI only for logged-in users
        if (!userId) {
            return NextResponse.json(
                { error: 'Fitur AI hanya untuk pengguna terdaftar. Daftar gratis untuk mulai!', code: 'GUEST_LIMIT_REACHED' },
                { status: 401 }
            );
        }

        // 1. EXTRACT CUSTOM API KEY from HEADER (BYOK Feature)
        const customApiKey = req.headers.get('x-custom-api-key');
        const activeApiKey = (customApiKey && customApiKey.trim() !== '') ? customApiKey.trim() : API_KEY;
        const usingCustomKey = !!(customApiKey && customApiKey.trim() !== '');

        // 2. EVALUATE COST FIRST!
        let calculatedCost = COST_TEXT;
        if (webSearchEnabled) calculatedCost = 10; // Extra charge for Google Search Grounding
        else if (imageUrls && imageUrls.length > 0) calculatedCost = COST_IMAGE;

        const urls = extractUrls(question);
        if (urls.length > 0 && !webSearchEnabled) calculatedCost = COST_SCRAPE;

        // 3. SERVER-SIDE DEDUCTION (RPC)
        // Bypass deduction completely IF the user is using API Pro tier with a Custom Key
        
        let shouldDeductCredits = true;
        
        if (userId && supabaseServiceKey) {
            // Check their actual subscription first to verify if they are allowed to bypass
            const { data: existingSub } = await supabaseAdmin
                .from('subscriptions')
                .select('id, tier')
                .eq('user_id', userId)
                .single();
                
            const currentTier = existingSub?.tier || 'free';
            resolvedTier = currentTier as PlanType;
            
            if (currentTier === 'api-pro' && usingCustomKey) {
                // BYOK User with valid key string -> unlimited!
                shouldDeductCredits = false;
            }
        }

        if (userId && supabaseServiceKey && shouldDeductCredits) {
            // 3a. Auto-provision: Pastikan credit_balances ADA
            const { data: existingBalance } = await supabaseAdmin
                .from('credit_balances')
                .select('id, monthly_credits, monthly_credits_used')
                .eq('user_id', userId)
                .single();

            if (!existingBalance) {
                await supabaseAdmin.from('credit_balances').insert({
                    user_id: userId,
                    bonus_credits: 25,
                    daily_free_credits: 5,
                    daily_free_used: 0,
                    monthly_credits: 0,
                    monthly_credits_used: 0,
                    bonus_credits_used: 0
                });
            }

            // 3b. Pastikan subscription ADA (Sudah di-fetch di atas)
            if (!resolvedTier || resolvedTier === 'free') {
                const { data: existingSubCheck } = await supabaseAdmin
                    .from('subscriptions')
                    .select('id')
                    .eq('user_id', userId)
                    .single();
                    
                if (!existingSubCheck) {
                    await supabaseAdmin.from('subscriptions').insert({
                        user_id: userId,
                        tier: 'free',
                        status: 'active'
                    });
                }
            }

            // 3c. KRITIS: Sinkronisasi monthly_credits berdasarkan tier!
            // Jika user Plus/Pro tapi monthly_credits = 0, isi otomatis
            const currentMonthly = existingBalance?.monthly_credits || 0;

            const TIER_MONTHLY_CREDITS: Record<string, number> = {
                'plus': 300,
                'pro': 1500,
                'api-pro': 0,
                'free': 0,
            };

            const expectedMonthly = TIER_MONTHLY_CREDITS[resolvedTier] || 0;

            if (currentMonthly !== expectedMonthly) {
                await supabaseAdmin.from('credit_balances').update({
                    monthly_credits: expectedMonthly,
                    monthly_credits_used: expectedMonthly === 0 ? 0 : Math.min(existingBalance?.monthly_credits_used || 0, expectedMonthly)
                }).eq('user_id', userId);
            }

            // 3d. Deduct credits via RPC
            const pType = planType || 'daily_free';

            let deducted = false;

            // Try plan credits first (daily_free or monthly)
            const { data: deductPlan, error: err1 } = await supabaseAdmin.rpc('deduct_credits', {
                p_user_id: userId,
                p_cost: calculatedCost,
                p_credit_type: pType
            });

            if (deductPlan) {
                deducted = true;
            } else {
                // If monthly failed, try daily_free
                if (pType === 'monthly') {
                    const { data: deductDaily } = await supabaseAdmin.rpc('deduct_credits', {
                        p_user_id: userId,
                        p_cost: calculatedCost,
                        p_credit_type: 'daily_free'
                    });
                    if (deductDaily) deducted = true;
                }

                // Try bonus credits
                if (!deducted) {
                    const { data: deductBonus, error: err2 } = await supabaseAdmin.rpc('deduct_credits', {
                        p_user_id: userId,
                        p_cost: calculatedCost,
                        p_credit_type: 'bonus'
                    });
                    if (deductBonus) deducted = true;
                }
            }

            // 3e. SECURITY: All RPC failed → block the request (no fallback to prevent race conditions)
            // The non-atomic fallback was vulnerable to TOCTOU race conditions

            if (!deducted) {
                return NextResponse.json(
                    { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
                    { status: 402 }
                );
            }
        }

        // 3. EXECUTE AI - Select model based on user tier and their selection
        // Server validates: if free tier tries to use a premium model, fall back to free model
        const requestedModel = selectedModelId ? getModelById(selectedModelId) : DEFAULT_MODEL;
        const allowedModel = canAccessModel(resolvedTier, requestedModel.requiredTier)
            ? requestedModel
            : DEFAULT_MODEL;
        // Initialize Gemini securely AFTER credit checks
        const genAI = new GoogleGenerativeAI(activeApiKey);
        
        // Log model selection without exposing user info
        if (false && process.env.NODE_ENV === 'development') {
            console.log(`[ModelGuard] Model: ${allowedModel.id}, Search: ${webSearchEnabled}`);
        }
        
        // Define Web Search tools if requested
        const tools = webSearchEnabled ? [{ googleSearch: {} }] : undefined;
        
        const model = genAI.getGenerativeModel({ 
            model: allowedModel.id,
            ...(tools && { tools: tools as any })
        });
        
        const parts: any[] = [];
        let scrapedContent = '';

        // Scrape logical URLs (using host protocol)
        if (urls.length > 0) {
            // Because we are on the server, we can fetch directly avoiding our own /api/scrape route loops
            // BUT for simplicity, we mock or fetch relative to req endpoint if needed.
            // Best approach: Use native node-fetch here if we merge scrape logic.
            // For now, since scrape might be complex, we just warn or implement basic fetch:
            for (const url of urls.slice(0, 2)) {
                try {
                    // SECURITY: Block SSRF on embedded scraping
                    if (!isSafeUrl(url)) {
                        console.warn(`[SECURITY] Blocked unsafe scrape URL: ${url}`);
                        continue;
                    }
                    const scraperResponse = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const text = await scraperResponse.text();
                    // Just take a snippet of HTML directly to summarize
                    scrapedContent += `\n\n--- Content from (${url}) ---\n${text.substring(0, 3000)}\n`;
                } catch (e) {
                    // Silently skip failed scrapes in production
                }
            }
        }

        // Add images
        if (imageUrls && imageUrls.length > 0) {
            for (const imageUrl of imageUrls) {
                const imageData = await imageUrlToBase64(imageUrl);
                if (imageData) {
                    parts.push({
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.base64
                        }
                    });
                }
            }
        }

        // Build System Instructions
        let styleInstruction = '';
        if (aiSettings) {
            if (aiSettings.style === 'professional') styleInstruction = 'Respond in a highly professional, structured, and formal manner. ';
            if (aiSettings.style === 'friendly') styleInstruction = 'Respond in a warm, friendly, and conversational tone. ';
            if (aiSettings.style === 'concise') styleInstruction = 'Respond concisely, getting straight to the point without fluff. ';
        }

        const languageMap = {
            en: 'English',
            id: 'Indonesian'
        };
        const preferredLang = aiSettings?.language ? languageMap[aiSettings.language as keyof typeof languageMap] : undefined;

        const languageInstruction = preferredLang
            ? `\n\nIMPORTANT: You MUST respond in ${preferredLang}.`
            : `\n\nIMPORTANT: Always respond in the same language as the user's question.`;

        const nameInstruction = aiSettings?.userName
            ? `\n\nAddress the user as "${aiSettings.userName}".`
            : '';

        const customInstruction = aiSettings?.customInstructions
            ? `\n\nAdditional user instructions you MUST follow: "${aiSettings.customInstructions}"`
            : '';

        const finalSystemPrompt = `${styleInstruction}${languageInstruction}${nameInstruction}${customInstruction}`;

        let textPrompt = '';

        if (scrapedContent) {
            textPrompt = `The user is asking about web content. Here is the raw HTML/text from the URL(s):\n${scrapedContent}\n\nUser question: ${question}\n\nPlease analyze the content and provide a helpful response based on what was found.${finalSystemPrompt}`;
        } else if (context) {
            textPrompt = `Previous context:\n${context}\n\nUser: ${question}\n\nPlease provide a helpful response.${finalSystemPrompt}`;
        } else if (imageUrls && imageUrls.length > 0) {
            textPrompt = `User is asking about the image(s): ${question}\n\nPlease analyze the image(s) and provide a helpful response.${finalSystemPrompt}`;
        } else {
            textPrompt = `${question}${finalSystemPrompt}`;
        }

        parts.push({ text: textPrompt });

        // Call Gemini
        const result = await model.generateContent(parts);
        let text = result.response.text();

        // Debug indicator for testing Model Selection
        if (process.env.NODE_ENV === 'development') {
            text += `\n\n--- \n*[🔍 Debug Info: Generated using ${allowedModel.name} (${allowedModel.id})]*`;
        }

        return NextResponse.json({ result: text });

    } catch (error: any) {
        console.error('API Error Generate Route:', error?.message || 'Unknown error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
