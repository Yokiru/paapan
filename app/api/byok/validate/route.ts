import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { getCanonicalByokModelId, getPreferredByokDefaultModelId, PREFERRED_BYOK_MODEL_IDS, toDisplayModelDescription, toDisplayModelName } from '@/lib/aiModels';

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
    const contentLengthHeader = req.headers.get('content-length');
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;

    if (Number.isFinite(contentLength) && contentLength > MAX_BYOK_VALIDATE_REQUEST_BYTES) {
        return NextResponse.json(
            { error: 'Request terlalu besar.', code: 'PAYLOAD_TOO_LARGE' },
            { status: 413 }
        );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
            { error: 'Silakan login dulu untuk memvalidasi API key pribadi Anda.', code: 'AUTH_REQUIRED' },
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

    try {
        const body = await req.json();
        const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
        const provider = typeof body?.provider === 'string' ? body.provider : 'gemini';
        const keyFormatError = validateKeyFormat(apiKey);

        if (provider !== 'gemini') {
            return NextResponse.json(
                { error: 'Provider ini sedang disiapkan dan belum bisa dipakai.', code: 'PROVIDER_UNSUPPORTED' },
                { status: 400 }
            );
        }

        if (keyFormatError) {
            return NextResponse.json(
                { error: keyFormatError, code: 'INVALID_INPUT' },
                { status: 400 }
            );
        }

        const availableModels = await fetchAvailableGeminiModels(apiKey);
        const availableModelIds = availableModels.map((availableModel) => availableModel.id);
        const recommendedModelId = getPreferredByokDefaultModelId(availableModelIds);

        if (!recommendedModelId) {
            return NextResponse.json(
                { error: 'API key valid, tetapi belum ada model Gemini teks yang tersedia untuk dipakai.', code: 'NO_TEXT_MODELS' },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: recommendedModelId });
        const result = await model.generateContent('Reply with exactly OK.');
        const text = result.response.text().trim();

        if (!text) {
            return NextResponse.json(
                { error: 'API key belum bisa divalidasi saat ini. Coba lagi sebentar lagi.', code: 'VALIDATION_FAILED' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            ok: true,
            provider: 'google-gemini',
            model: recommendedModelId,
            availableModels,
            recommendedModelId,
        });
    } catch (error) {
        return NextResponse.json(
            { error: getFriendlyError(error), code: 'VALIDATION_FAILED' },
            { status: 400 }
        );
    }
}
