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
export type PlanType = 'free' | 'plus' | 'pro';

export interface AIModel {
    id: string;           // Exact Gemini API model ID
    name: string;         // Short, user-facing name
    description: string;  // Brief capability description
    requiredTier: ModelTier; // Minimum plan required to use
    badge?: string;          // Optional badge label (e.g. "New", "Cepat")
}

export const AI_MODELS: AIModel[] = [
    {
        id: 'gemini-2.0-flash-lite',
        name: 'Flash Lite',
        description: 'Cepat & hemat, cocok untuk percakapan umum',
        requiredTier: 'free',
        badge: 'Gratis',
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Flash',
        description: 'Lebih cerdas, pengetahuan lebih baru',
        requiredTier: 'plus',
        badge: 'Plus',
    },
    {
        id: 'gemini-2.0-pro-exp-02-05',
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

/**
 * Checks if a plan tier has access to a specific model tier.
 * Plus can access free+plus, Pro can access all.
 */
export function canAccessModel(userPlan: PlanType, modelRequiredTier: ModelTier): boolean {
    const tierRank: Record<PlanType | ModelTier, number> = {
        free: 0,
        plus: 1,
        pro: 2,
    };
    return tierRank[userPlan] >= tierRank[modelRequiredTier];
}
