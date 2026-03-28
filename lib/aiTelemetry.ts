import { SupabaseClient } from '@supabase/supabase-js';

type AILogLevel = 'info' | 'warn' | 'error';
type AILogRoute = 'api.generate' | 'api.byok.validate' | 'api.upload.image';

type AILogPayload = {
    requestId: string;
    event: string;
    route: AILogRoute;
    status?: number;
    code?: string;
    durationMs?: number;
    userId?: string | null;
    subscriptionTier?: string;
    actionType?: string;
    requestedModelId?: string;
    resolvedModelId?: string;
    requestedAiMode?: 'paapan' | 'byok';
    requestedAiProvider?: string;
    usingCustomKey?: boolean;
    webSearchEnabled?: boolean;
    imageCount?: number;
    urlCount?: number;
    cost?: number;
    questionLength?: number;
    contextLength?: number;
    error?: string;
    reason?: string;
};

type PersistableAIEvent = {
    request_id: string;
    event: string;
    route: AILogRoute;
    status?: number;
    code?: string;
    duration_ms?: number;
    user_id?: string | null;
    subscription_tier?: string;
    action_type?: string;
    requested_model_id?: string;
    resolved_model_id?: string;
    requested_ai_mode?: 'paapan' | 'byok';
    requested_ai_provider?: string;
    using_custom_key?: boolean;
    web_search_enabled?: boolean;
    image_count?: number;
    url_count?: number;
    cost?: number;
    question_length?: number;
    context_length?: number;
    error?: string;
    reason?: string;
    created_at: string;
};

const compactObject = <T extends Record<string, unknown>>(value: T): T => (
    Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as T
);

export const createAIRequestId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const logAIEvent = (level: AILogLevel, payload: AILogPayload) => {
    const structuredPayload = compactObject({
        timestamp: new Date().toISOString(),
        scope: 'ai.generate',
        ...payload,
    });

    const message = `[AI][${payload.event}]`;

    if (level === 'error') {
        console.error(message, structuredPayload);
        return;
    }

    if (level === 'warn') {
        console.warn(message, structuredPayload);
        return;
    }

    console.info(message, structuredPayload);
};

const isMissingRelationError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? error.code : '';
    const maybeMessage = 'message' in error ? error.message : '';
    const code = typeof maybeCode === 'string' ? maybeCode : '';
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';

    return code === '42P01' || message.includes('relation') && message.includes('does not exist');
};

export const persistAIEvent = async (
    supabaseAdmin: SupabaseClient,
    payload: AILogPayload
) => {
    const row: PersistableAIEvent = compactObject({
        request_id: payload.requestId,
        event: payload.event,
        route: payload.route,
        status: payload.status,
        code: payload.code,
        duration_ms: payload.durationMs,
        user_id: payload.userId,
        subscription_tier: payload.subscriptionTier,
        action_type: payload.actionType,
        requested_model_id: payload.requestedModelId,
        resolved_model_id: payload.resolvedModelId,
        requested_ai_mode: payload.requestedAiMode,
        requested_ai_provider: payload.requestedAiProvider,
        using_custom_key: payload.usingCustomKey,
        web_search_enabled: payload.webSearchEnabled,
        image_count: payload.imageCount,
        url_count: payload.urlCount,
        cost: payload.cost,
        question_length: payload.questionLength,
        context_length: payload.contextLength,
        error: payload.error,
        reason: payload.reason,
        created_at: new Date().toISOString(),
    });

    try {
        const { error } = await supabaseAdmin
            .from('ai_events')
            .insert(row);

        if (error && !isMissingRelationError(error)) {
            console.warn('[AI][persist_failed]', error);
        }
    } catch (error) {
        if (!isMissingRelationError(error)) {
            console.warn('[AI][persist_exception]', error);
        }
    }
};
