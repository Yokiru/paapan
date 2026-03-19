/**
 * Credit Cost Configuration
 * Defines how many credits each action costs
 */

import { CreditActionType, CreditCost, CreditPackage, SubscriptionPlan } from '@/types/credit';

// Credit costs per action
export const CREDIT_COSTS: Record<CreditActionType, CreditCost> = {
    chat_simple: {
        action: 'chat_simple',
        credits: 1,
        model: 'gemini-2.0-flash-lite',
        description: 'Simple chat response',
    },
    chat_standard: {
        action: 'chat_standard',
        credits: 3,
        model: 'gemini-2.5-flash',
        description: 'Standard chat with better reasoning',
    },
    chat_advanced: {
        action: 'chat_advanced',
        credits: 10,
        model: 'gemini-2.5-pro',
        description: 'Advanced reasoning and analysis',
    },
    image_analysis: {
        action: 'image_analysis',
        credits: 5,
        model: 'gemini-2.5-flash',
        description: 'Analyze and describe images',
    },
    code_generation: {
        action: 'code_generation',
        credits: 8,
        model: 'gemini-2.5-flash',
        description: 'Generate code snippets',
    },
    long_response: {
        action: 'long_response',
        credits: 2,
        model: 'any',
        description: 'Extended response (2000+ tokens)',
    },
};

// ===== NEW: 3-Tier Subscription Plans =====
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: 'free',
        name: 'Free',
        description: 'Mulai eksplorasi atau bawa API Key',
        priceIDR: 0,
        priceUSD: 0,
        creditsPerMonth: 0,     // Free tier uses daily reset, not monthly
        creditsPerDay: 5,
        bonusCredits: 25,       // Welcome bonus
        models: ['gemini-2.0-flash-lite'],
        maxWorkspaces: 3,
        maxNodes: 50,           // Max nodes per workspace
        cloudSync: false,
        byok: true,
        urlScraping: false,
        exportFormats: [],
        maxImageNodes: 5,
        features: [
            '5 kredit / hari ATAU',
            'Sistem BYOK (Bawa API Key)',
            'Model Flash-Lite',
            '3 workspace',
            'Drawing & Pen tool',
            'Maks. 5 image node',
        ],
    },
    {
        id: 'plus',
        name: 'Plus',
        description: 'Untuk kreator & mahasiswa',
        priceIDR: 29000,
        priceUSD: 5,
        creditsPerMonth: 300,
        creditsPerDay: 0,       // Monthly allocation, not daily
        bonusCredits: 50,
        models: ['gemini-2.0-flash-lite', 'gemini-2.5-flash'],
        maxWorkspaces: 10,
        maxNodes: 300,
        cloudSync: true,
        byok: true,
        urlScraping: true,
        exportFormats: ['png', 'pdf'],
        maxImageNodes: -1,
        popular: true,
        features: [
            '300 kredit AI / bulan',
            'Model Flash-Lite + Flash',
            '10 workspace',
            'Cloud sync',
            'BYOK (Bring Your Own Key)',
            'URL scraping',
            'Export PNG & PDF',
            'Image node unlimited',
        ],
    },

    {
        id: 'api-pro',
        name: 'API Pro',
        description: 'Bawa API Key Anda sendiri',
        priceIDR: 49000,
        priceUSD: 9,
        creditsPerMonth: 0,     // No system credits, they use their own key
        creditsPerDay: 0,
        bonusCredits: 0,
        models: ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
        maxWorkspaces: -1,      // Unlimited
        maxNodes: -1,           // Unlimited
        cloudSync: true,
        byok: true,             // This is the core feature
        urlScraping: true,
        exportFormats: ['png', 'pdf'],
        maxImageNodes: -1,
        features: [
            'Gunakan API Key Pribadi',
            '0 kredit dari sistem',
            'Workspace unlimited',
            'Cloud sync',
            'URL scraping',
            'Export PNG & PDF',
            'Image node unlimited',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        description: 'Untuk profesional & power user',
        priceIDR: 79000,
        priceUSD: 15,
        creditsPerMonth: 1500,
        creditsPerDay: 0,
        bonusCredits: 200,
        models: ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
        maxWorkspaces: -1,
        maxNodes: -1,           // Unlimited
        cloudSync: true,
        byok: true,
        urlScraping: true,
        exportFormats: ['png', 'pdf', 'json'],
        maxImageNodes: -1,
        features: [
            '1.500 kredit AI / bulan',
            'Semua model AI (termasuk Pro)',
            'Workspace unlimited',
            'Cloud sync',
            'BYOK (Bring Your Own Key)',
            'URL scraping',
            'Export PNG, PDF & JSON',
            'Image node unlimited',
            'Prioritas support',
        ],
    },
];

// Legacy: keep CREDIT_PACKAGES for backward compatibility
export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: 'plus',
        name: 'Plus',
        credits: 300,
        bonusCredits: 50,
        price: 29000,
        pricePerCredit: 97,
        popular: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        credits: 1500,
        bonusCredits: 200,
        price: 79000,
        pricePerCredit: 53,
    },
];

// Free tier configuration
export const FREE_TIER_CONFIG = {
    dailyCredits: 5,
    welcomeBonus: 25,
    resetHour: 0,
};

// Credit expiry configuration
export const CREDIT_EXPIRY_DAYS = 30;

// Helper functions
export function getCreditCost(action: CreditActionType): number {
    return CREDIT_COSTS[action]?.credits || 0;
}

export function getModelForAction(action: CreditActionType): string {
    return CREDIT_COSTS[action]?.model || 'gemini-2.0-flash-lite';
}

export function formatCredits(credits: number): string {
    return credits.toLocaleString('id-ID');
}

export function formatPrice(price: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(price);
}

import { SubscriptionTier } from '@/types/credit';

let cachedTier: SubscriptionTier = 'free';

// Set current tier in memory (called by Supabase auth listener / store)
export function setGlobalTier(tier: SubscriptionTier) {
    cachedTier = tier;
    if (typeof window !== 'undefined') {
        localStorage.setItem('paapan-tier', tier);
    }
}

// Get current user subscription tier (sync for UI)
export function getCurrentTier(): SubscriptionTier {
    if (typeof window === 'undefined') return 'free';
    if (cachedTier !== 'free') return cachedTier;
    return (localStorage.getItem('paapan-tier') as SubscriptionTier) || 'free';
}

// Get workspace limit for current tier
export function getWorkspaceLimit(): number {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === getCurrentTier());
    return plan?.maxWorkspaces ?? 3; // Default to free tier
}

// Get image node limit for current tier
export function getImageNodeLimit(): number {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === getCurrentTier());
    return plan?.maxImageNodes ?? 5; // Default to 5 for free tier
}

// Get node limit per workspace for current tier
export function getNodeLimit(): number {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === getCurrentTier());
    return plan?.maxNodes ?? 50; // Default to 50 for free tier
}

// Get node limit for guest (not logged in) - stricter than free
export const GUEST_NODE_LIMIT = 10;
// Get guest AI credit cap (stored in localStorage, NOT shown in UI)
export const GUEST_AI_CREDIT_CAP = 3;
export const GUEST_AI_CREDIT_KEY = 'paapan-guest-ai-used';

// Get credit limit type and amount
export function getCreditLimit(): { type: 'daily' | 'monthly', amount: number } {
    const tier = getCurrentTier();
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
    if (tier === 'free' || !plan) {
        return { type: 'daily', amount: plan?.creditsPerDay ?? 5 };
    }
    return { type: 'monthly', amount: plan.creditsPerMonth };
}
