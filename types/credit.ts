/**
 * Credit System Types
 */

// Credit package definitions
export interface CreditPackage {
    id: string;
    name: string;
    credits: number;
    bonusCredits: number;
    price: number; // in IDR
    pricePerCredit: number;
    popular?: boolean;
}

// Subscription tier types
export type SubscriptionTier = 'free' | 'plus' | 'pro' | 'api-pro' | 'enterprise';

export interface SubscriptionPlan {
    id: SubscriptionTier;
    name: string;
    description: string;
    priceIDR: number;         // Harga dalam Rupiah (Midtrans)
    priceUSD: number;         // Harga dalam USD (Lemon Squeezy)
    creditsPerMonth: number;  // Total kredit per bulan (0 = daily reset)
    creditsPerDay: number;    // Kredit harian (hanya untuk Free tier)
    bonusCredits: number;     // Bonus kredit pertama kali
    models: string[];         // Model AI yang tersedia
    maxWorkspaces: number;    // -1 = unlimited
    maxNodes: number;         // -1 = unlimited, max nodes per workspace
    cloudSync: boolean;
    byok: boolean;            // Bring Your Own Key
    urlScraping: boolean;
    exportFormats: string[];  // e.g. ['png', 'pdf', 'json']
    maxImageNodes: number;    // -1 = unlimited
    features: string[];       // Daftar fitur untuk UI
    popular?: boolean;
}

export interface CreditBalance {
    total: number;
    used: number;
    remaining: number;
    freeCreditsToday: number;
    freeCreditsUsedToday: number;
    monthlyCredits: number;
    monthlyCreditsUsed: number;
    expiresAt: Date | null;
}

// Credit transaction record
export interface CreditTransaction {
    id: string;
    type: 'purchase' | 'usage' | 'free_daily' | 'bonus' | 'expired';
    amount: number; // positive for additions, negative for usage
    description: string;
    createdAt: Date;
    metadata?: {
        packageId?: string;
        actionType?: CreditActionType;
        nodeId?: string;
    };
}

// Actions that consume credits
export type CreditActionType =
    | 'chat_simple'      // 1 credit
    | 'chat_standard'    // 3 credits
    | 'chat_advanced'    // 10 credits
    | 'image_analysis'   // 5 credits
    | 'code_generation'  // 8 credits
    | 'long_response';   // +2 credits (addon)

// Credit cost configuration
export interface CreditCost {
    action: CreditActionType;
    credits: number;
    model: string;
    description: string;
}

// User credit state (for store)
export interface UserCreditState {
    balance: CreditBalance;
    transactions: CreditTransaction[];
    isLoading: boolean;
    error: string | null;
}
