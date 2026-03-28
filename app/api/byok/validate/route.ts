import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getCanonicalByokModelId, getPreferredByokDefaultModelId, PREFERRED_BYOK_MODEL_IDS, toDisplayModelDescription, toDisplayModelName } from '@/lib/aiModels';
import { createAIRequestId, logAIEvent, persistAIEvent } from '@/lib/aiTelemetry';
import { isBlockedUser } from '@/lib/authState';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MAX_BYOK_VALIDATE_REQUEST_BYTES = 8_000;
const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiModelListItem {
    name?: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
}

const validateKeyFormat = (apiKey: string) => {
    const trimmed = apiKey.trim();

    if (!trimmed) {
        return 'Masukkan API key Gemini Anda terlebih dahulu.';
    }

    if (trimmed.length < 24) {
        return 'API key terlihat terlalu pendek. Periksa lagi key Gemini Anda.';
    }

    return null;
};

const getFriendlyError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    const normalized = message.toLowerCase();

    if (
        normalized.includes('api key not valid') ||
        normalized.includes('invalid api key') ||
        normalized.includes('api_key_invalid') ||
        normalized.includes('permission denied')
    ) {
        return 'API key Gemini tidak valid atau belum aktif. Cek lagi key Anda di Google AI Studio.';
    }

    if (
        normalized.includes('quota') ||
        normalized.includes('rate limit') ||
        normalized.includes('resource exhausted')
    ) {
        return 'API key valid, tetapi kuota provider sedang habis atau kena limit. Coba lagi sebentar lagi.';
    }

    return 'API key belum bisa divalidasi saat ini. Coba lagi sebentar lagi.';
};

const normalizeModelId = (value: string | undefined) => (value || '').replace(/^models\//, '').trim();

const isUsableTextModel = (model: GeminiModelListItem) => {
    const modelId = normalizeModelId(model.name);
    if (!modelId.startsWith('gemini-')) return false;

    const supportedMethods = Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods.map((method) => method.toLowerCase())
        : [];

    const supportsGenerateContent = supportedMethods.includes('generatecontent');
    if (!supportsGenerateContent) return false;

    const blockedKeywords = ['embedding', 'aqa', 'image', 'tts', 'transcribe', 'vision-preview'];
    return !blockedKeywords.some((keyword) => modelId.includes(keyword));
};

const fetchAvailableGeminiModels = async (apiKey: string) => {
    const response = await fetch(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        cache: 'no-store',
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text || `Failed to list Gemini models (${response.status})`);
    }

    const payload = await response.json() as { models?: GeminiModelListItem[] };
    const models = Array.isArray(payload.models) ? payload.models : [];

    const availableModels = models
        .filter(isUsableTextModel)
        .map((model) => {
            const rawModelId = normalizeModelId(model.name);
            const modelId = getCanonicalByokModelId(rawModelId);
            if (!modelId) {
                return null;
            }

            return {
                id: modelId,
                name: toDisplayModelName(modelId, model.displayName),
                description: toDisplayModelDescription(modelId, model.description),
                requiredTier: 'free' as const,
                badge: 'BYOK',
            };
        })
        .filter((model): model is NonNullable<typeof model> => Boolean(model))
        .sort((a, b) => {
            const aPriority = PREFERRED_BYOK_MODEL_IDS.indexOf(a.id);
            const bPriority = PREFERRED_BYOK_MODEL_IDS.indexOf(b.id);
            const aRank = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
            const bRank = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;

            if (aRank !== bRank) return aRank - bRank;
            return a.name.localeCompare(b.name);
        })
        .filter((model, index, array) => array.findIndex((item) => item.id === model.id) === index);

    return availableModels;
};

export async function POST(req: Request) {
    const requestId = createAIRequestId();
    const startedAt = Date.now();
    let userId: string | null = null;

    const respond = async (
        level: 'info' | 'warn' | 'error',
        event: string,
        payload: Record<string, unknown>,
        status: number,
        extra?: Record<string, unknown>
    ) => {
        const telemetryPayload = {
            requestId,
            event,
            route: 'api.byok.validate' as const,
            status,
            durationMs: Date.now() - startedAt,
            userId,
            requestedAiMode: 'byok' as const,
            requestedAiProvider: 'gemini',
            ...(extra || {}),
        };

        logAIEvent(level, telemetryPayload);
        await persistAIEvent(supabaseAdmin, telemetryPayload);

        return NextResponse.json(payload, { status });
    };

    const contentLengthHeader = req.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;

    if (Number.isFinite(contentLength) && contentLength > MAX_BYOK_VALIDATE_REQUEST_BYTES) {
        return respond(
            'warn',
            'payload_rejected',
            { error: 'Request terlalu besar.', code: 'PAYLOAD_TOO_LARGE' },
            413,
            { code: 'PAYLOAD_TOO_LARGE', reason: 'content_length_limit' }
        );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return respond(
            'warn',
            'auth_missing',
            { error: 'Silakan login dulu untuk memvalidasi API key pribadi Anda.', code: 'AUTH_REQUIRED' },
            401,
            { code: 'AUTH_REQUIRED', reason: 'missing_bearer_token' }
        );
    }

    const token = authHeader.replace('Bearer ', '');
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

    try {
        const body = await req.json();
        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
        const provider = typeof body?.provider === 'string' ? body.provider : 'gemini';
        const keyFormatError = validateKeyFormat(apiKey);

        if (provider !== 'gemini') {
            return respond(
                'warn',
                'provider_unsupported',
                { error: 'Provider ini sedang disiapkan dan belum bisa dipakai.', code: 'PROVIDER_UNSUPPORTED' },
                400,
                { code: 'PROVIDER_UNSUPPORTED', reason: 'provider_not_ready', requestedAiProvider: provider }
            );
        }

        if (keyFormatError) {
            return respond(
                'warn',
                'validation_failed',
                { error: keyFormatError, code: 'INVALID_INPUT' },
                400,
                { code: 'INVALID_INPUT', reason: 'key_format_invalid' }
            );
        }

        const availableModels = await fetchAvailableGeminiModels(apiKey);
        const availableModelIds = availableModels.map((availableModel) => availableModel.id);
        const recommendedModelId = getPreferredByokDefaultModelId(availableModelIds);

        if (!recommendedModelId) {
            return respond(
                'warn',
                'validation_failed',
                { error: 'API key valid, tetapi belum ada model Gemini teks yang tersedia untuk dipakai.', code: 'NO_TEXT_MODELS' },
                400,
                { code: 'NO_TEXT_MODELS', reason: 'no_usable_text_models' }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: recommendedModelId });
        const result = await model.generateContent('Reply with exactly OK.');
        const text = result.response.text().trim();

        if (!text) {
            return respond(
                'warn',
                'validation_failed',
                { error: 'API key belum bisa divalidasi saat ini. Coba lagi sebentar lagi.', code: 'VALIDATION_FAILED' },
                502,
                { code: 'VALIDATION_FAILED', reason: 'empty_validation_response', resolvedModelId: recommendedModelId, usingCustomKey: true }
            );
        }

        return respond(
            'info',
            'validation_success',
            {
                ok: true,
                provider: 'google-gemini',
                model: recommendedModelId,
                availableModels,
                recommendedModelId,
            },
            200,
            {
                resolvedModelId: recommendedModelId,
                usingCustomKey: true,
            }
        );
    } catch (error) {
        return respond(
            'warn',
            'validation_failed',
            { error: getFriendlyError(error), code: 'VALIDATION_FAILED' },
            400,
            {
                code: 'VALIDATION_FAILED',
                reason: 'provider_validation_error',
                error: error instanceof Error ? error.message : String(error || ''),
                usingCustomKey: true,
            }
        );
    }
}
