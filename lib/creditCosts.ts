/**
 * Credit Cost Configuration
 * Defines how many credits each action costs
 */

import { CreditActionType, CreditCost, CreditPackage } from '@/types/credit';

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

// Available credit packages
export const CREDIT_PACKAGES: CreditPackage[] = [
    {
        id: 'starter',
        name: 'Starter',
        credits: 100,
        bonusCredits: 0,
        price: 15000,
        pricePerCredit: 150,
    },
    {
        id: 'basic',
        name: 'Basic',
        credits: 250,
        bonusCredits: 25,
        price: 29000,
        pricePerCredit: 105,
        popular: true,
    },
    {
        id: 'plus',
        name: 'Plus',
        credits: 600,
        bonusCredits: 100,
        price: 59000,
        pricePerCredit: 84,
    },
    {
        id: 'pro',
        name: 'Pro',
        credits: 1200,
        bonusCredits: 300,
        price: 99000,
        pricePerCredit: 66,
    },
    {
        id: 'business',
        name: 'Business',
        credits: 3000,
        bonusCredits: 1000,
        price: 199000,
        pricePerCredit: 50,
    },
];

// Free tier configuration
export const FREE_TIER_CONFIG = {
    dailyCredits: 5,
    welcomeBonus: 25, // Beta: one-time bonus for new users
    resetHour: 0, // Midnight local time
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
