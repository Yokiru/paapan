/**
 * AI Model Registry for Paapan
 * Defines all available Gemini models and their access tiers.
 *
 * Access Tiers:
 * - 'free'  → Only available to Free plan users
 * - 'plus'  → Requires Plus or Pro plan
 * - 'pro'   → Requires Pro plan only
 */

export type ModelTier = 'free' | 'plus' | 'pro';
export type PlanType = 'free' | 'plus' | 'pro' | 'api-pro';

export interface AIModel {
    id: string;           // Exact Gemini API model ID
    name: string;         // Short, user-facing name
    description: string;  // Brief capability description
    requiredTier: ModelTier; // Minimum plan required to use
    badge?: string;          // Optional badge label (e.g. "New", "Cepat")
}

export const PREFERRED_BYOK_MODEL_IDS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
];

const BYOK_MODEL_FAMILIES: Record<string, Pick<AIModel, 'name' | 'description'>> = {
    'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash',
        description: 'Model cepat dan serbaguna untuk chat serta tugas harian.',
    },
    'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        description: 'Model paling kuat untuk analisis dan penalaran mendalam.',
    },
    'gemini-2.0-flash-lite': {
        name: 'Gemini 2.0 Flash-Lite',
        description: 'Varian ringan dan hemat untuk percakapan umum.',
    },
    'gemini-2.0-flash': {
        name: 'Gemini 2.0 Flash',
        description: 'Versi cepat Gemini 2.0 untuk chat dan tugas umum.',
    },
    'gemini-2.5-flash-lite': {
        name: 'Gemini 2.5 Flash-Lite',
        description: 'Lebih ringan dari Flash, cocok untuk penggunaan hemat.',
    },
};

export const AI_MODELS: AIModel[] = [
    {
        id: 'gemini-2.0-flash-lite',
        name: 'Flash Lite',
        description: 'Cepat & hemat, cocok untuk percakapan umum',
        requiredTier: 'free',
        badge: 'Gratis',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Flash',
        description: 'Lebih cerdas, pengetahuan lebih baru',
        requiredTier: 'plus',
        badge: 'Plus',
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Pro',
        description: 'Model terpintar, analisis mendalam',
        requiredTier: 'pro',
        badge: 'Pro',
    },
];

export const DEFAULT_MODEL = AI_MODELS[0]; // Flash Lite for everyone by default

/**
 * Returns the AI model by ID, or falls back to the default (free) model.
 */
export function getModelById(modelId: string): AIModel {
    return AI_MODELS.find(m => m.id === modelId) || DEFAULT_MODEL;
}

export function getPreferredByokDefaultModelId(modelIds: string[]): string | null {
    for (const preferredId of PREFERRED_BYOK_MODEL_IDS) {
        if (modelIds.includes(preferredId)) {
            return preferredId;
        }
    }

    return modelIds[0] || null;
}

export function getCanonicalByokModelId(modelId: string): string | null {
    const normalizedId = modelId.replace(/^models\//, '').trim();
    if (!normalizedId.startsWith('gemini-')) return null;

    if (normalizedId.includes('preview')) {
        return null;
    }

    if (normalizedId === 'gemini-flash-latest') return 'gemini-2.5-flash';
    if (normalizedId === 'gemini-flash-lite-latest') return 'gemini-2.5-flash-lite';
    if (normalizedId === 'gemini-pro-latest') return 'gemini-2.5-pro';

    if (normalizedId.startsWith('gemini-2.5-flash-lite')) return 'gemini-2.5-flash-lite';
    if (normalizedId.startsWith('gemini-2.5-flash')) return 'gemini-2.5-flash';
    if (normalizedId.startsWith('gemini-2.5-pro')) return 'gemini-2.5-pro';
    if (normalizedId.startsWith('gemini-2.0-flash-lite')) return 'gemini-2.0-flash-lite';
    if (normalizedId.startsWith('gemini-2.0-flash')) return 'gemini-2.0-flash';

    return normalizedId;
}

export function toDisplayModelName(modelId: string, fallbackName?: string): string {
    const byokFamily = BYOK_MODEL_FAMILIES[modelId];
    if (byokFamily) return byokFamily.name;

    const knownModel = AI_MODELS.find((model) => model.id === modelId);
    if (knownModel) return knownModel.name;

    if (fallbackName?.trim()) return fallbackName.trim();

    return modelId
        .replace(/^models\//, '')
        .replace(/^gemini-/, '')
        .split('-')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
}

export function toDisplayModelDescription(modelId: string, fallbackDescription?: string): string {
    const byokFamily = BYOK_MODEL_FAMILIES[modelId];
    if (byokFamily) return byokFamily.description;

    const knownModel = AI_MODELS.find((model) => model.id === modelId);
    if (knownModel) return knownModel.description;

    if (fallbackDescription?.trim()) return fallbackDescription.trim();

    return 'Model Gemini tersedia untuk percakapan dan generasi teks.';
}

/**
 * Checks if a plan tier has access to a specific model tier.
 * Plus can access free+plus, Pro can access all.
 */
export function getEffectiveModelAccessTier(
    userPlan: PlanType,
    options?: { hasByok?: boolean }
): ModelTier {
    if (options?.hasByok) {
        return 'pro';
    }

    if (userPlan === 'api-pro') {
        return 'pro';
    }

    return userPlan;
}

export function canAccessModel(
    userPlan: PlanType,
    modelRequiredTier: ModelTier,
    options?: { hasByok?: boolean }
): boolean {
    const tierRank: Record<ModelTier, number> = {
        free: 0,
        plus: 1,
        pro: 2,
    };

    const effectiveTier = getEffectiveModelAccessTier(userPlan, options);
    return tierRank[effectiveTier] >= tierRank[modelRequiredTier];
}
