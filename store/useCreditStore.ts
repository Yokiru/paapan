'use client';

/**
 * Credit Store (Zustand)
 * Manages user's credit balance, transactions, and usage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    CreditBalance,
    CreditTransaction,
    CreditActionType,
    UserCreditState
} from '@/types/credit';
import {
    getCreditCost,
    FREE_TIER_CONFIG,
    CREDIT_EXPIRY_DAYS
} from '@/lib/creditCosts';

interface CreditStore extends UserCreditState {
    // Actions
    initializeCredits: () => void;
    addCredits: (amount: number, description: string, packageId?: string) => void;
    useCredits: (action: CreditActionType, nodeId?: string) => boolean;
    canAfford: (action: CreditActionType) => boolean;
    resetDailyFreeCredits: () => void;
    checkAndExpireCredits: () => void;
    getTransactionHistory: () => CreditTransaction[];
}

const getInitialBalance = (): CreditBalance => ({
    total: 0,
    used: 0,
    remaining: 0,
    freeCreditsToday: FREE_TIER_CONFIG.dailyCredits,
    freeCreditsUsedToday: 0,
    expiresAt: null,
});

export const useCreditStore = create<CreditStore>()(
    persist(
        (set, get) => ({
            // Initial state
            balance: getInitialBalance(),
            transactions: [],
            isLoading: false,
            error: null,

            // Initialize credits (called on app load)
            initializeCredits: () => {
                const state = get();

                // Check if we need to reset daily free credits
                const lastReset = localStorage.getItem('lastFreeCreditsReset');
                const today = new Date().toDateString();

                if (lastReset !== today) {
                    get().resetDailyFreeCredits();
                }

                // Check for expired credits
                get().checkAndExpireCredits();
            },

            // Add credits (from purchase)
            addCredits: (amount, description, packageId) => {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + CREDIT_EXPIRY_DAYS);

                const transaction: CreditTransaction = {
                    id: crypto.randomUUID(),
                    type: 'purchase',
                    amount,
                    description,
                    createdAt: new Date(),
                    metadata: { packageId },
                };

                set((state) => ({
                    balance: {
                        ...state.balance,
                        total: state.balance.total + amount,
                        remaining: state.balance.remaining + amount,
                        expiresAt,
                    },
                    transactions: [transaction, ...state.transactions],
                }));
            },

            // Use credits for an action
            useCredits: (action, nodeId) => {
                const cost = getCreditCost(action);
                const state = get();

                // Check if user can afford
                const totalAvailable = state.balance.remaining +
                    (state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday);

                if (cost > totalAvailable) {
                    set({ error: 'Insufficient credits' });
                    return false;
                }

                // Deduct from free credits first, then paid credits
                let freeUsed = 0;
                let paidUsed = 0;
                const freeAvailable = state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday;

                if (freeAvailable >= cost) {
                    freeUsed = cost;
                } else {
                    freeUsed = freeAvailable;
                    paidUsed = cost - freeAvailable;
                }

                const transaction: CreditTransaction = {
                    id: crypto.randomUUID(),
                    type: 'usage',
                    amount: -cost,
                    description: `Used for ${action.replace('_', ' ')}`,
                    createdAt: new Date(),
                    metadata: { actionType: action, nodeId },
                };

                set((state) => ({
                    balance: {
                        ...state.balance,
                        used: state.balance.used + paidUsed,
                        remaining: state.balance.remaining - paidUsed,
                        freeCreditsUsedToday: state.balance.freeCreditsUsedToday + freeUsed,
                    },
                    transactions: [transaction, ...state.transactions],
                    error: null,
                }));

                return true;
            },

            // Check if user can afford an action
            canAfford: (action) => {
                const cost = getCreditCost(action);
                const state = get();
                const totalAvailable = state.balance.remaining +
                    (state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday);
                return cost <= totalAvailable;
            },

            // Reset daily free credits
            resetDailyFreeCredits: () => {
                localStorage.setItem('lastFreeCreditsReset', new Date().toDateString());

                const transaction: CreditTransaction = {
                    id: crypto.randomUUID(),
                    type: 'free_daily',
                    amount: FREE_TIER_CONFIG.dailyCredits,
                    description: 'Daily free credits',
                    createdAt: new Date(),
                };

                set((state) => ({
                    balance: {
                        ...state.balance,
                        freeCreditsToday: FREE_TIER_CONFIG.dailyCredits,
                        freeCreditsUsedToday: 0,
                    },
                    transactions: [transaction, ...state.transactions],
                }));
            },

            // Check and expire old credits
            checkAndExpireCredits: () => {
                const state = get();
                if (state.balance.expiresAt && new Date() > state.balance.expiresAt) {
                    const expiredAmount = state.balance.remaining;

                    if (expiredAmount > 0) {
                        const transaction: CreditTransaction = {
                            id: crypto.randomUUID(),
                            type: 'expired',
                            amount: -expiredAmount,
                            description: 'Credits expired',
                            createdAt: new Date(),
                        };

                        set((state) => ({
                            balance: {
                                ...state.balance,
                                remaining: 0,
                                expiresAt: null,
                            },
                            transactions: [transaction, ...state.transactions],
                        }));
                    }
                }
            },

            // Get transaction history
            getTransactionHistory: () => {
                return get().transactions;
            },
        }),
        {
            name: 'paapan-credits',
            partialize: (state) => ({
                balance: state.balance,
                transactions: state.transactions.slice(0, 100), // Keep last 100 transactions
            }),
        }
    )
);
