import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getModelById, canAccessModel, PlanType, DEFAULT_MODEL } from '@/lib/aiModels';
import { getCreditCost } from '@/lib/creditCosts';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';

// Init Supabase Service Role (Admin) client untuk mem-bypass RLS
// Kita perlukan Service Role Key untuk mengatur balance User tanpa login NextAuth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const API_KEY = process.env.GEMINI_API_KEY || '';

const MAX_GENERATE_REQUEST_BYTES = 100_000;
const COST_WEB_SEARCH = 10;
const COST_SCRAPE = 7;

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
        if (!['http:', 'https:'].includes(url.protocol)) return false;

        const hostname = url.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
            return false;
        }

        const parts = hostname.split('.');
        if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
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
 * Convert image URL to base64
 */
async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
            if (matches) return { base64: matches[2], mimeType: matches[1] };
        }

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
    if (!API_KEY && !req.headers.get('x-custom-api-key')) {
        return NextResponse.json(
            { error: 'Kunci API Gemini belum dipasang di Server (.env.local). Silakan periksa pengaturan Vercel atau file lokal Anda.' },
            { status: 400 }
        );
    }

    try {
        const contentLengthHeader = req.headers.get('content-length');
        const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
        if (Number.isFinite(contentLength) && contentLength > MAX_GENERATE_REQUEST_BYTES) {
            return NextResponse.json(
                { error: 'Request terlalu besar.', code: 'PAYLOAD_TOO_LARGE' },
                { status: 413 }
            );
        }

        // Low-trust pre-auth throttle to protect body parsing and auth lookups.
        const clientFingerprint = `${getClientIP(req)}:${req.headers.get('user-agent')?.slice(0, 80) || 'unknown'}`;
        const preAuthRateLimit = checkRateLimit(`generate-preauth:${clientFingerprint}`, RATE_LIMITS.generatePreAuth);
        if (!preAuthRateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((preAuthRateLimit.resetAt - Date.now()) / 1000)) } }
            );
        }

        // Verify auth before parsing the JSON body.
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Fitur AI hanya untuk pengguna terdaftar. Daftar gratis untuk mulai!', code: 'GUEST_LIMIT_REACHED' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '');
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Sesi login tidak valid. Silakan masuk lagi.', code: 'INVALID_TOKEN' },
                { status: 401 }
            );
        }

        const userId = user.id;

        const rateLimitResult = checkRateLimit(`generate:user:${userId}`, RATE_LIMITS.generate);
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
            );
        }

        const body = await req.json();
        const { question, context, imageUrls, actionType, aiSettings, selectedModelId, webSearchEnabled } = body;

        // Resolved user tier (set inside user credit/subscription block, used later for model selection)
        let resolvedTier: PlanType = 'free';

        // 1. EXTRACT CUSTOM API KEY from HEADER (BYOK Feature)
        const customApiKey = req.headers.get('x-custom-api-key');
        const activeApiKey = customApiKey && customApiKey.trim() !== '' ? customApiKey.trim() : API_KEY;
        const usingCustomKey = !!(customApiKey && customApiKey.trim() !== '');

        // 2. EVALUATE COST FIRST
        const safeActionType = actionType || 'chat_simple';
        let calculatedCost = getCreditCost(safeActionType);
        if (imageUrls && imageUrls.length > 0) {
            calculatedCost = getCreditCost('image_analysis');
        }
        if (webSearchEnabled) {
            calculatedCost = Math.max(calculatedCost, COST_WEB_SEARCH);
        }

        const urls = extractUrls(question);
        if (urls.length > 0 && !webSearchEnabled) {
            calculatedCost = Math.max(calculatedCost, COST_SCRAPE);
        }

        // 3. SERVER-SIDE DEDUCTION (RPC)
        // Bypass deduction completely if the user is API Pro and uses their own key.
        let shouldDeductCredits = true;

        if (userId && supabaseServiceKey) {
            const { data: existingSub } = await supabaseAdmin
                .from('subscriptions')
                .select('id, tier')
                .eq('user_id', userId)
                .single();

            const currentTier = existingSub?.tier || 'free';
            resolvedTier = currentTier as PlanType;

            if (currentTier === 'api-pro' && usingCustomKey) {
                shouldDeductCredits = false;
            }
        }

        if (userId && supabaseServiceKey && shouldDeductCredits) {
            const { data: existingBalance } = await supabaseAdmin
                .from('credit_balances')
                .select('id')
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
                    bonus_credits_used: 0,
                });
            }

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
                        status: 'active',
                    });
                }
            }

            // Never refill or resync monthly credits during generation.
            const pType = resolvedTier === 'free' ? 'daily_free' : 'monthly';

            let deducted = false;

            const { data: deductPlan } = await supabaseAdmin.rpc('deduct_credits', {
                p_user_id: userId,
                p_cost: calculatedCost,
                p_credit_type: pType,
            });

            if (deductPlan) {
                deducted = true;
            } else {
                if (pType === 'monthly') {
                    const { data: deductDaily } = await supabaseAdmin.rpc('deduct_credits', {
                        p_user_id: userId,
                        p_cost: calculatedCost,
                        p_credit_type: 'daily_free',
                    });
                    if (deductDaily) deducted = true;
                }

                if (!deducted) {
                    const { data: deductBonus } = await supabaseAdmin.rpc('deduct_credits', {
                        p_user_id: userId,
                        p_cost: calculatedCost,
                        p_credit_type: 'bonus',
                    });
                    if (deductBonus) deducted = true;
                }
            }

            if (!deducted) {
                return NextResponse.json(
                    { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
                    { status: 402 }
                );
            }
        }

        // 4. EXECUTE AI - Select model based on user tier and their selection
        const requestedModel = selectedModelId ? getModelById(selectedModelId) : DEFAULT_MODEL;
        const allowedModel = canAccessModel(resolvedTier, requestedModel.requiredTier)
            ? requestedModel
            : DEFAULT_MODEL;
        const genAI = new GoogleGenerativeAI(activeApiKey);

        const tools = webSearchEnabled ? [{ googleSearch: {} }] : undefined;
        const model = genAI.getGenerativeModel({
            model: allowedModel.id,
            ...(tools && { tools: tools as any }),
        });

        const parts: any[] = [];
        let scrapedContent = '';

        if (urls.length > 0) {
            for (const url of urls.slice(0, 2)) {
                try {
                    if (!isSafeUrl(url)) {
                        console.warn(`[SECURITY] Blocked unsafe scrape URL: ${url}`);
                        continue;
                    }
                    const scraperResponse = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const text = await scraperResponse.text();
                    scrapedContent += `\n\n--- Content from (${url}) ---\n${text.substring(0, 3000)}\n`;
                } catch {
                    // Silently skip failed scrapes in production
                }
            }
        }

        if (imageUrls && imageUrls.length > 0) {
            for (const imageUrl of imageUrls) {
                const imageData = await imageUrlToBase64(imageUrl);
                if (imageData) {
                    parts.push({
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.base64,
                        },
                    });
                }
            }
        }

        let styleInstruction = '';
        if (aiSettings) {
            if (aiSettings.style === 'professional') styleInstruction = 'Respond in a highly professional, structured, and formal manner. ';
            if (aiSettings.style === 'friendly') styleInstruction = 'Respond in a warm, friendly, and conversational tone. ';
            if (aiSettings.style === 'concise') styleInstruction = 'Respond concisely, getting straight to the point without fluff. ';
        }

        const languageMap = {
            en: 'English',
            id: 'Indonesian',
        };
        const preferredLang = aiSettings?.language
            ? languageMap[aiSettings.language as keyof typeof languageMap]
            : undefined;

        const languageInstruction = preferredLang
            ? `\n\nIMPORTANT: You MUST respond in ${preferredLang}.`
            : '\n\nIMPORTANT: Always respond in the same language as the user\'s question.';

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

        const result = await model.generateContent(parts);
        let text = result.response.text();

        if (process.env.NODE_ENV === 'development') {
            text += `\n\n--- \n*[Debug Info: Generated using ${allowedModel.name} (${allowedModel.id})]*`;
        }

        return NextResponse.json({ result: text });
    } catch (error: any) {
        console.error('API Error Generate Route:', error?.message || 'Unknown error');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
