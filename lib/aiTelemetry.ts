type AILogLevel = 'info' | 'warn' | 'error';

type AILogPayload = {
    requestId: string;
    event: string;
    route: 'api.generate';
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
