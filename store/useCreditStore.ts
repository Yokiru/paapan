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
    CREDIT_EXPIRY_DAYS,
    getCreditLimit,
    setGlobalTier
} from '@/lib/creditCosts';
import {
    fetchUserSubscription,
    fetchUserCreditBalance,
    updateUserCreditBalance,
    logCreditTransaction,
    deductCreditsAtomic,
    addBonusCreditsAtomic
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
    addCredits: (amount: number, description: string, packageId?: string) => void;
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
            addCredits: (amount, description, packageId) => {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + CREDIT_EXPIRY_DAYS);
                const userId = useWorkspaceStore.getState().userId;

                const transaction: CreditTransaction = {
                    id: generateId(),
                    type: 'purchase',
                    amount,
                    description,
                    createdAt: new Date(),
                    metadata: { packageId },
                };

                // Optimistic Local State Update
                set((state) => ({
                    balance: {
                        ...state.balance,
                        total: state.balance.total + amount,
                        remaining: state.balance.remaining + amount,
                        expiresAt,
                    },
                    transactions: [transaction, ...state.transactions],
                }));

                // Cloud Background Sync
                if (userId) {
                    addBonusCreditsAtomic(userId, amount);
                    logCreditTransaction(userId, transaction);
                }
            },

            // Use credits for an action (Optimistic Sync to keep canvas fast!)
            useCredits: (action, nodeId) => {
                const cost = getCreditCost(action);
                const state = get();
                const limitInfo = getCreditLimit();
                const userId = useWorkspaceStore.getState().userId;

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

                // 2. Background Cloud Sync (Asynchronous)
                if (userId) {
                    const syncCloud = async () => {
                        let success = true;

                        // Potong plan credits secara atomik
                        if (planUsed > 0) {
                            const pType = limitInfo.type === 'daily' ? 'daily_free' : 'monthly';
                            const ok = await deductCreditsAtomic(userId, planUsed, pType);
                            if (!ok) success = false;
                        }

                        // Potong bonus credits secara atomik
                        if (paidUsed > 0) {
                            const ok = await deductCreditsAtomic(userId, paidUsed, 'bonus');
                            if (!ok) success = false;
                        }

                        // Opsional: Jika success=false, artinya di database saldo aslinya sudah habis (termakan tab lain).
                        // Di sini kita bisa reload state atau biarkan Optimistic UI berjalan (karena toh transaksi gagal di Cloud).

                        logCreditTransaction(userId, transaction);
                    };

                    syncCloud();
                }

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
                const userId = useWorkspaceStore.getState().userId;

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

                if (userId) {
                    updateUserCreditBalance(userId, {
                        daily_free_used: 0,
                        last_daily_reset: new Date().toISOString()
                    });
                }
            },

            // Reset monthly subscription credits
            resetMonthlyCredits: () => {
                const limitInfo = getCreditLimit();
                const currentMonth = new Date().getMonth() + '-' + new Date().getFullYear();
                localStorage.setItem('lastMonthlyCreditsReset', currentMonth);
                const userId = useWorkspaceStore.getState().userId;

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

                if (userId) {
                    updateUserCreditBalance(userId, {
                        monthly_credits_used: 0,
                        last_monthly_reset: new Date().toISOString()
                    });
                }
            },

            // Check and expire old credits
            checkAndExpireCredits: () => {
                const state = get();
                if (state.balance.expiresAt && new Date() > state.balance.expiresAt) {
                    const expiredAmount = state.balance.remaining;
                    const userId = useWorkspaceStore.getState().userId;

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

                        if (userId) {
                            updateUserCreditBalance(userId, { bonus_credits: 0, bonus_credits_used: 0 });
                            logCreditTransaction(userId, transaction);
                        }
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
