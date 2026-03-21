'use client';

/**
 * Credit Store (Zustand)
 * Manages user's credit balance, transactions, and usage
 * Now connected to Supabase for logged-in users via optimistic cloud sync!
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    CreditBalance,
    CreditTransaction,
    CreditActionType,
    UserCreditState,
    SubscriptionTier
} from '@/types/credit';
import {
    getCreditCost,
    FREE_TIER_CONFIG,
    getCreditLimit,
    setGlobalTier
} from '@/lib/creditCosts';
import {
    fetchUserSubscription,
    fetchUserCreditBalance,
} from '@/lib/supabaseCredits';
import { useWorkspaceStore } from './useWorkspaceStore';

// Safe UUID generator
function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

interface CreditStore extends UserCreditState {
    currentTier: SubscriptionTier;
    // Actions
    initializeCredits: () => Promise<void>;
    addCredits: (amount: number, description: string, packageId?: string) => boolean;
    useCredits: (action: CreditActionType, nodeId?: string) => boolean;
    canAfford: (action: CreditActionType) => boolean;
    resetDailyFreeCredits: () => void;
    resetMonthlyCredits: () => void;
    checkAndExpireCredits: () => void;
    getTransactionHistory: () => CreditTransaction[];
}

const getInitialBalance = (): CreditBalance => ({
    total: 0,
    used: 0,
    remaining: 0,
    freeCreditsToday: FREE_TIER_CONFIG.dailyCredits,
    freeCreditsUsedToday: 0,
    monthlyCredits: 0,
    monthlyCreditsUsed: 0,
    expiresAt: null,
});

export const useCreditStore = create<CreditStore>()(
    persist(
        (set, get) => ({
            // Initial state
            balance: getInitialBalance(),
            transactions: [],
            currentTier: 'free' as const,
            isLoading: false,
            error: null,

            // Initialize credits (called on app load or login)
            initializeCredits: async () => {
                const state = get();
                const userId = useWorkspaceStore.getState().userId;

                // If logged in, fetch from Supabase
                if (userId) {
                    try {
                        const tier = await fetchUserSubscription(userId);
                        setGlobalTier(tier); // update global memory & UI state
                        set({ currentTier: tier }); // React reactive state

                        const cloudBalance = await fetchUserCreditBalance(userId);
                        if (cloudBalance) {
                            set({
                                balance: {
                                    ...state.balance,
                                    monthlyCredits: cloudBalance.monthly_credits || 0,
                                    monthlyCreditsUsed: cloudBalance.monthly_credits_used || 0,
                                    freeCreditsToday: cloudBalance.daily_free_credits || 5,
                                    freeCreditsUsedToday: cloudBalance.daily_free_used || 0,
                                    remaining: (cloudBalance.bonus_credits || 0) - (cloudBalance.bonus_credits_used || 0),
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Failed to sync credits with cloud', e);
                    } finally {
                        set({ isLoading: false });
                    }

                    return;
                }

                // Process daily/monthly resets as usual (optimistic / fallback)
                const limitInfo = getCreditLimit();
                const lastReset = localStorage.getItem('lastFreeCreditsReset');
                const today = new Date().toDateString();

                if (lastReset !== today) {
                    get().resetDailyFreeCredits();
                }

                const lastMonthlyReset = localStorage.getItem('lastMonthlyCreditsReset');
                const currentMonth = new Date().getMonth() + '-' + new Date().getFullYear();

                if (lastMonthlyReset !== currentMonth) {
                    get().resetMonthlyCredits();
                }

                // Ensure balance reflects current tier limits if upgraded/downgraded
                set((state) => ({
                    balance: {
                        ...state.balance,
                        monthlyCredits: limitInfo.type === 'monthly' ? limitInfo.amount : state.balance.monthlyCredits,
                        freeCreditsToday: limitInfo.type === 'daily' ? limitInfo.amount : state.balance.freeCreditsToday,
                    }
                }));

                get().checkAndExpireCredits();
            },

            // Add credits (from purchase)
            addCredits: (_amount, _description, packageId) => {
                const purchaseContext = packageId ? `package "${packageId}"` : 'an unverified package';

                console.warn(
                    `[SECURITY] Blocked client-side credit grant for ${purchaseContext}. ` +
                    'Credits must only be granted after a server-verified payment flow.'
                );

                set({
                    error: 'Credit purchase belum aktif. Kredit hanya bisa ditambahkan lewat payment server-side yang terverifikasi.',
                });

                return false;
            },

            // Use credits for an action (Optimistic Sync to keep canvas fast!)
            useCredits: (action, nodeId) => {
                const cost = getCreditCost(action);
                const state = get();
                const limitInfo = getCreditLimit();

                // Check affordability locally first
                let available = state.balance.remaining;
                if (limitInfo.type === 'daily') {
                    available += (state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday);
                } else {
                    available += (state.balance.monthlyCredits - state.balance.monthlyCreditsUsed);
                }

                if (cost > available) {
                    set({ error: 'Insufficient credits' });
                    return false;
                }

                // Deduct from regular plan first, then paid top-up credits
                let planUsed = 0;
                let paidUsed = 0;
                let planAvailable = 0;

                if (limitInfo.type === 'daily') {
                    planAvailable = state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday;
                } else {
                    planAvailable = state.balance.monthlyCredits - state.balance.monthlyCreditsUsed;
                }

                if (planAvailable >= cost) {
                    planUsed = cost;
                } else {
                    planUsed = planAvailable;
                    paidUsed = cost - planAvailable;
                }

                const transaction: CreditTransaction = {
                    id: generateId(),
                    type: 'usage',
                    amount: -cost,
                    description: `Used for ${action.replace('_', ' ')}`,
                    createdAt: new Date(),
                    metadata: { actionType: action, nodeId },
                };

                // 1. Optimistic UI update (Instant, synchronous)
                set((state) => ({
                    balance: {
                        ...state.balance,
                        used: state.balance.used + paidUsed,
                        remaining: state.balance.remaining - paidUsed,
                        freeCreditsUsedToday: limitInfo.type === 'daily'
                            ? state.balance.freeCreditsUsedToday + planUsed
                            : state.balance.freeCreditsUsedToday,
                        monthlyCreditsUsed: limitInfo.type === 'monthly'
                            ? state.balance.monthlyCreditsUsed + planUsed
                            : state.balance.monthlyCreditsUsed,
                    },
                    transactions: [transaction, ...state.transactions],
                    error: null,
                }));

                // SECURITY: Credit mutations are server-authoritative.
                // The client only updates local UI optimistically; the actual deduction
                // must happen in the verified server flow (for example /api/generate).

                return true;
            },

            // Check if user can afford an action
            canAfford: (action) => {
                const limitInfo = getCreditLimit();
                const cost = getCreditCost(action);
                const state = get();

                let available = state.balance.remaining;
                if (limitInfo.type === 'daily') {
                    available += (state.balance.freeCreditsToday - state.balance.freeCreditsUsedToday);
                } else {
                    available += (state.balance.monthlyCredits - state.balance.monthlyCreditsUsed);
                }

                return available >= cost;
            },

            // Reset daily free credits
            resetDailyFreeCredits: () => {
                const limitInfo = getCreditLimit();
                localStorage.setItem('lastFreeCreditsReset', new Date().toDateString());
                const transaction: CreditTransaction = {
                    id: generateId(),
                    type: 'free_daily',
                    amount: limitInfo.type === 'daily' ? limitInfo.amount : 0,
                    description: 'Daily free credits',
                    createdAt: new Date(),
                };

                set((state) => ({
                    balance: {
                        ...state.balance,
                        freeCreditsToday: limitInfo.type === 'daily' ? limitInfo.amount : 0,
                        freeCreditsUsedToday: 0,
                    },
                    transactions: [transaction, ...state.transactions],
                }));

            },

            // Reset monthly subscription credits
            resetMonthlyCredits: () => {
                const limitInfo = getCreditLimit();
                const currentMonth = new Date().getMonth() + '-' + new Date().getFullYear();
                localStorage.setItem('lastMonthlyCreditsReset', currentMonth);
                const transaction: CreditTransaction = {
                    id: generateId(),
                    type: 'free_daily',
                    amount: limitInfo.type === 'monthly' ? limitInfo.amount : 0,
                    description: 'Monthly subscription credits',
                    createdAt: new Date(),
                };

                set((state) => ({
                    balance: {
                        ...state.balance,
                        monthlyCredits: limitInfo.type === 'monthly' ? limitInfo.amount : 0,
                        monthlyCreditsUsed: 0,
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
                            id: generateId(),
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
