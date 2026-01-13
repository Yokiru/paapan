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

// Credit balance state
export interface CreditBalance {
    total: number;
    used: number;
    remaining: number;
    freeCreditsToday: number;
    freeCreditsUsedToday: number;
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
