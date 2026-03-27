'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, CreditBalance } from '@/lib/supabase';
import { CreditActionType } from '@/types/credit';
import { getCreditCost } from '@/lib/creditCosts';

type CreditBalanceRow = {
    bonus_credits?: number | null;
    bonus_credits_used?: number | null;
    daily_free_credits?: number | null;
    daily_free_used?: number | null;
    monthly_credits?: number | null;
    monthly_credits_used?: number | null;
};

interface UseCreditReturn {
    balance: CreditBalance | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    refreshBalance: () => Promise<void>;
    useCredits: (action: CreditActionType, nodeId?: string) => Promise<boolean>;
    canAfford: (action: CreditActionType) => boolean;
    claimWelcomeBonus: () => Promise<boolean>;
    getTotalRemaining: () => number;
}

function mapCreditBalance(row: CreditBalanceRow | null): CreditBalance | null {
    if (!row) {
        return null;
    }

    const purchasedCredits = row.bonus_credits || 0;
    const usedCredits = row.bonus_credits_used || 0;
    const freeCreditsToday = row.daily_free_credits || 0;
    const freeCreditsUsedToday = row.daily_free_used || 0;
    const monthlyCredits = row.monthly_credits || 0;
    const monthlyCreditsUsed = row.monthly_credits_used || 0;

    return {
        purchased_credits: purchasedCredits,
        used_credits: usedCredits,
        remaining_purchased: Math.max(0, purchasedCredits - usedCredits),
        free_credits_today: freeCreditsToday,
        free_credits_used_today: freeCreditsUsedToday,
        free_credits_remaining: Math.max(0, freeCreditsToday - freeCreditsUsedToday),
        total_remaining: Math.max(0, purchasedCredits - usedCredits)
            + Math.max(0, freeCreditsToday - freeCreditsUsedToday)
            + Math.max(0, monthlyCredits - monthlyCreditsUsed),
        credits_expires_at: null,
        welcome_bonus_claimed: false,
    };
}

export function useCredits(): UseCreditReturn {
    const [balance, setBalance] = useState<CreditBalance | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch balance from Supabase
    const refreshBalance = useCallback(async () => {
        if (!userId) {
            setBalance(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Missing session');
            }

            const response = await fetch('/api/credits', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to load credits');
            }

            setBalance(mapCreditBalance(payload?.balance || null));
        } catch (err: any) {
            console.error('Error fetching balance:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Auto-fetch balance when userId changes
    useEffect(() => {
        if (userId) {
            refreshBalance();
        }
    }, [userId, refreshBalance]);

    // Use credits for an action
    const useCredits = useCallback(async (action: CreditActionType, nodeId?: string): Promise<boolean> => {
        void action;
        void nodeId;
        setError('Credit deduction hanya boleh diproses oleh server saat permintaan AI tervalidasi.');
        return false;
    }, []);

    // Check if user can afford an action
    const canAfford = useCallback((action: CreditActionType): boolean => {
        if (!balance) return false;
        const cost = getCreditCost(action);
        return balance.total_remaining >= cost;
    }, [balance]);

    // Claim welcome bonus
    const claimWelcomeBonus = useCallback(async (): Promise<boolean> => {
        setError('Welcome bonus hanya boleh diklaim lewat alur server-side yang tervalidasi.');
        return false;
    }, []);

    // Get total remaining credits
    const getTotalRemaining = useCallback((): number => {
        return balance?.total_remaining || 0;
    }, [balance]);

    return {
        balance,
        isLoading,
        error,
        refreshBalance,
        useCredits,
        canAfford,
        claimWelcomeBonus,
        getTotalRemaining
    };
}
