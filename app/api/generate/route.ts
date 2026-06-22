import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getModelById, canAccessModel, PlanType, DEFAULT_MODEL } from '@/lib/aiModels';
import { getCreditCost } from '@/lib/creditCosts';
import { checkPersistentRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';
import { getNormalizedCreditBalance, getOrCreateSubscriptionTier } from '@/lib/serverCredits';
import { createAIRequestId, logAIEvent, persistAIEvent } from '@/lib/aiTelemetry';
import { isBlockedUser } from '@/lib/authState';
import { CreditActionType, SubscriptionTier } from '@/types/credit';
import { PAAPAN_EXPERIMENT_HEADER, PAAPAN_EXPERIMENT_VALUE } from '@/lib/experimentMode';
import { SafeFetchError, assertSafeExternalUrl, safeFetchBytes, safeFetchText } from '@/lib/safeFetch';

// Init Supabase Service Role (Admin) client untuk mem-bypass RLS
// Kita perlukan Service Role Key untuk mengatur balance User tanpa login NextAuth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const API_KEY = process.env.GEMINI_API_KEY || '';

const MAX_GENERATE_REQUEST_BYTES = 100_000;
const MAX_REMOTE_IMAGE_BYTES = 8_000_000;
const MAX_REMOTE_SCRAPE_BYTES = 250_000;
const REMOTE_FETCH_TIMEOUT_MS = 8_000;
const COST_WEB_SEARCH = 10;
const COST_SCRAPE = 7;
const VALID_ACTION_TYPES: CreditActionType[] = [
    'chat_simple',
    'chat_standard',
    'chat_advanced',
    'image_analysis',
    'code_generation',
    'long_response',
];

/**
 * Detect urls in text
 */
function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    return text.match(urlRegex) || [];
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

        const response = await safeFetchBytes(imageUrl, {
            maxBytes: MAX_REMOTE_IMAGE_BYTES,
            timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
            headers: {
                'User-Agent': 'PaapanBot/1.0',
                'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
            },
            allowedContentTypes: ['image/'],
        });

        if (response.status < 200 || response.status >= 300) return null;

        const buffer = Buffer.from(response.bytes);
        const base64 = buffer.toString('base64');
        const mimeType = response.contentType || 'image/jpeg';

        return { base64, mimeType };
    } catch (error) {
        console.error('API Error converting image to base64:', error);
        return null;
    }
}

export async function POST(req: Request) {
    const requestId = createAIRequestId();
    const startedAt = Date.now();
    let userId: string | null = null;
    let subscriptionTier: SubscriptionTier = 'free';
    let resolvedTier: PlanType = 'free';
    let safeActionType: CreditActionType = 'chat_simple';
    let calculatedCost = 0;
    let usingCustomKey = false;
    let requestedAiMode: 'paapan' | 'byok' = 'paapan';
    let requestedAiProvider = 'gemini';
    let selectedModelId: string | undefined;
    let resolvedModelId = DEFAULT_MODEL.id;
    let webSearchEnabled = false;
    let imageCount = 0;
    let urlCount = 0;
    let questionLength = 0;
    let contextLength = 0;
    const isLocalExperimentRequest =
        process.env.NODE_ENV !== 'production' &&
        req.headers.get(PAAPAN_EXPERIMENT_HEADER) === PAAPAN_EXPERIMENT_VALUE;

    const responseHeaders = (headers?: HeadersInit) => ({
        ...(headers || {}),
        'X-Request-Id': requestId,
    });

    const respond = async (
        level: 'info' | 'warn' | 'error',
        event: string,
        payload: Record<string, unknown>,
        status: number,
        extra?: Record<string, unknown>,
        headers?: HeadersInit
    ) => {
        const telemetryPayload = {
            requestId,
            event,
            route: 'api.generate' as const,
            status,
            durationMs: Date.now() - startedAt,
            userId,
            subscriptionTier,
            actionType: safeActionType,
            requestedModelId: selectedModelId,
            resolvedModelId,
            usingCustomKey,
            requestedAiMode,
            requestedAiProvider,
            webSearchEnabled,
            imageCount,
            urlCount,
            cost: calculatedCost || undefined,
            questionLength: questionLength || undefined,
            contextLength: contextLength || undefined,
            ...(extra || {}),
        };

        logAIEvent(level, telemetryPayload);
        await persistAIEvent(supabaseAdmin, telemetryPayload);

        return NextResponse.json(payload, { status, headers: responseHeaders(headers) });
    };

    if (!API_KEY && !req.headers.get('x-custom-api-key')) {
        return respond(
            'error',
            'config_missing',
            {
                error: 'Layanan AI belum tersedia karena konfigurasi server belum lengkap.',
                code: 'AI_UNAVAILABLE'
            },
            503,
            { code: 'AI_UNAVAILABLE', reason: 'missing_api_key' }
        );
    }

    try {
        const contentLengthHeader = req.headers.get('content-length');
        const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
        if (Number.isFinite(contentLength) && contentLength > MAX_GENERATE_REQUEST_BYTES) {
            return respond(
                'warn',
                'payload_rejected',
                { error: 'Request terlalu besar.', code: 'PAYLOAD_TOO_LARGE' },
                413,
                { code: 'PAYLOAD_TOO_LARGE', reason: 'content_length_limit' }
            );
        }

        // Low-trust pre-auth throttle to protect body parsing and auth lookups.
        const clientFingerprint = `${getClientIP(req)}:${req.headers.get('user-agent')?.slice(0, 80) || 'unknown'}`;
        const preAuthRateLimit = await checkPersistentRateLimit(
            `generate-preauth:${clientFingerprint}`,
            RATE_LIMITS.generatePreAuth,
            supabaseAdmin
        );
        if (!preAuthRateLimit.allowed) {
            return respond(
                'warn',
                'rate_limited_preauth',
                { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
                429,
                { code: 'RATE_LIMITED', reason: 'preauth_limit' },
                { 'Retry-After': String(Math.ceil((preAuthRateLimit.resetAt - Date.now()) / 1000)) }
            );
        }

        // Verify auth before parsing the JSON body.
        const authHeader = req.headers.get('authorization');
        if (!isLocalExperimentRequest && (!authHeader || !authHeader.startsWith('Bearer '))) {
            return respond(
                'warn',
                'auth_missing',
                { error: 'Fitur AI hanya untuk pengguna terdaftar. Daftar gratis untuk mulai!', code: 'GUEST_LIMIT_REACHED' },
                401,
                { code: 'GUEST_LIMIT_REACHED', reason: 'missing_bearer_token' }
            );
        }

        if (!isLocalExperimentRequest) {
            const token = authHeader!.replace('Bearer ', '');
            const {
                data: { user },
                error: authError,
            } = await supabaseAdmin.auth.getUser(token);

            if (authError || !user) {
                return respond(
                    'warn',
                    'auth_invalid',
                    { error: 'Sesi login tidak valid. Silakan masuk lagi.', code: 'INVALID_TOKEN' },
                    401,
                    { code: 'INVALID_TOKEN', reason: 'supabase_auth_failed' }
                );
            }

            if (isBlockedUser(user)) {
                return respond(
                    'warn',
                    'auth_blocked',
                    { error: 'Akun ini sedang dibatasi aksesnya.', code: 'ACCOUNT_BLOCKED' },
                    403,
                    { code: 'ACCOUNT_BLOCKED', reason: 'user_banned', userId: user.id }
                );
            }

            userId = user.id;

            const rateLimitResult = await checkPersistentRateLimit(
                `generate:user:${userId}`,
                RATE_LIMITS.generate,
                supabaseAdmin
            );
            if (!rateLimitResult.allowed) {
                return respond(
                    'warn',
                    'rate_limited_user',
                    { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
                    429,
                    { code: 'RATE_LIMITED', reason: 'user_limit' },
                    { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) }
                );
            }
        }

        const body = await req.json();
        const {
            question,
            context,
            imageUrls,
            actionType,
            aiSettings,
            selectedModelId: requestedModelId,
            webSearchEnabled: requestedWebSearchEnabled
        } = body;
        selectedModelId = requestedModelId;
        webSearchEnabled = !!requestedWebSearchEnabled;
        questionLength = typeof question === 'string' ? question.length : 0;
        contextLength = typeof context === 'string' ? context.length : 0;
        imageCount = Array.isArray(imageUrls) ? imageUrls.length : 0;
        const safeQuestion = typeof question === 'string' ? question : '';
        const safeContext = typeof context === 'string' ? context : undefined;

        // 1. EXTRACT CUSTOM API KEY from HEADER (BYOK Feature)
        requestedAiMode = req.headers.get('x-ai-mode') === 'byok' ? 'byok' : 'paapan';
        requestedAiProvider = req.headers.get('x-ai-provider') || 'gemini';
        const customApiKey = req.headers.get('x-custom-api-key');
        const activeApiKey = customApiKey && customApiKey.trim() !== '' ? customApiKey.trim() : API_KEY;
        usingCustomKey = !!(customApiKey && customApiKey.trim() !== '');

        if (isLocalExperimentRequest) {
            subscriptionTier = 'pro';
            resolvedTier = 'pro';
        }

        // 2. EVALUATE COST FIRST
        safeActionType = VALID_ACTION_TYPES.includes(actionType as CreditActionType)
            ? (actionType as CreditActionType)
            : 'chat_simple';
        calculatedCost = getCreditCost(safeActionType);
        if (imageUrls && imageUrls.length > 0) {
            calculatedCost = getCreditCost('image_analysis');
        }
        if (webSearchEnabled) {
            calculatedCost = Math.max(calculatedCost, COST_WEB_SEARCH);
        }

        const urls = extractUrls(safeQuestion);
        urlCount = urls.length;
        for (const url of urls.slice(0, 2)) {
            try {
                await assertSafeExternalUrl(url);
            } catch (error) {
                if (error instanceof SafeFetchError) {
                    return respond(
                        'warn',
                        'url_rejected',
                        {
                            error: 'Link ini tidak bisa dibuka karena alasan keamanan.',
                            code: 'URL_NOT_ALLOWED',
                        },
                        400,
                        { code: 'URL_NOT_ALLOWED', reason: error.code }
                    );
                }

                throw error;
            }
        }
        if (urls.length > 0 && !webSearchEnabled) {
            calculatedCost = Math.max(calculatedCost, COST_SCRAPE);
        }

        // 3. SERVER-SIDE DEDUCTION (RPC)
        // BYOK bypasses Paapan credits entirely because usage is billed to the user's key.
        let shouldDeductCredits = !isLocalExperimentRequest;

        if (userId && supabaseServiceKey) {
            subscriptionTier = await getOrCreateSubscriptionTier(supabaseAdmin, userId);
            resolvedTier = subscriptionTier as PlanType;

            if (requestedAiMode === 'byok' && !usingCustomKey) {
                return respond(
                    'warn',
                    'byok_required',
                    {
                        error: 'Mode BYOK aktif, tetapi API key pribadi Anda belum valid atau belum tersedia. Tambahkan lalu validasi key Anda di Pengaturan AI.',
                        code: 'BYOK_REQUIRED'
                    },
                    403,
                    { code: 'BYOK_REQUIRED', reason: 'byok_mode_without_custom_key' }
                );
            }

            if (subscriptionTier === 'api-pro' && !usingCustomKey) {
                return respond(
                    'warn',
                    'byok_required',
                    {
                        error: 'Paket API Pro memerlukan API key Gemini pribadi yang valid. Tambahkan key Anda di Pengaturan AI.',
                        code: 'BYOK_REQUIRED'
                    },
                    403,
                    { code: 'BYOK_REQUIRED', reason: 'api_pro_without_custom_key' }
                );
            }

            if (usingCustomKey) {
                shouldDeductCredits = false;
            }
        }

        if (userId && supabaseServiceKey && shouldDeductCredits) {
            await getNormalizedCreditBalance(supabaseAdmin, userId, subscriptionTier);

            // Never refill or resync monthly credits during generation.
            const pType = subscriptionTier === 'free' ? 'daily_free' : 'monthly';

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
                return respond(
                    'warn',
                    'credits_rejected',
                    { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
                    402,
                    { code: 'INSUFFICIENT_CREDITS', reason: 'all_credit_buckets_exhausted' }
                );
            }
        }

        // 4. EXECUTE AI - Select model based on user tier and their selection
        const requestedModel = selectedModelId ? getModelById(selectedModelId) : DEFAULT_MODEL;
        const allowedModel = canAccessModel(resolvedTier, requestedModel.requiredTier, { hasByok: usingCustomKey })
            ? requestedModel
            : DEFAULT_MODEL;
        resolvedModelId = allowedModel.id;
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
                    const scraperResponse = await safeFetchText(url, {
                        maxBytes: MAX_REMOTE_SCRAPE_BYTES,
                        timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
                        headers: {
                            'User-Agent': 'PaapanBot/1.0',
                            'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5',
                        },
                    });

                    if (scraperResponse.status < 200 || scraperResponse.status >= 300) continue;

                    const text = scraperResponse.text;
                    scrapedContent += `\n\n--- Content from (${url}) ---\n${text.substring(0, 3000)}\n`;
                } catch (error) {
                    if (error instanceof SafeFetchError) {
                        console.warn(`[SECURITY] Blocked unsafe scrape URL (${error.code}): ${url}`);
                    }
                    // Skip failed scrapes so the main AI request can still continue.
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
            textPrompt = `The user is asking about web content. Here is the raw HTML/text from the URL(s):\n${scrapedContent}\n\nUser question: ${safeQuestion}\n\nPlease analyze the content and provide a helpful response based on what was found.${finalSystemPrompt}`;
        } else if (safeContext) {
            textPrompt = `Previous context:\n${safeContext}\n\nUser: ${safeQuestion}\n\nPlease provide a helpful response.${finalSystemPrompt}`;
        } else if (imageUrls && imageUrls.length > 0) {
            textPrompt = `User is asking about the image(s): ${safeQuestion}\n\nPlease analyze the image(s) and provide a helpful response.${finalSystemPrompt}`;
        } else {
            textPrompt = `${safeQuestion}${finalSystemPrompt}`;
        }

        parts.push({ text: textPrompt });

        const result = await model.generateContent(parts);
        let text = result.response.text();

        if (process.env.NODE_ENV === 'development') {
            text += `\n\n--- \n*[Debug Info: Generated using ${allowedModel.name} (${allowedModel.id})]*`;
        }

        return respond(
            'info',
            'success',
            { result: text },
            200
        );
    } catch (error: any) {
        return respond(
            'error',
            'provider_failed',
            { error: 'Layanan AI sedang bermasalah atau tidak tersedia.', code: 'AI_UNAVAILABLE' },
            503,
            {
                code: 'AI_UNAVAILABLE',
                error: error?.message || 'Unknown error',
                reason: 'generate_route_exception',
            }
        );
    }
}
