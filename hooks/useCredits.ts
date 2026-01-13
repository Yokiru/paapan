'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, CreditBalance } from '@/lib/supabase';
import { CreditActionType } from '@/types/credit';
import { getCreditCost } from '@/lib/creditCosts';

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
            const { data, error: rpcError } = await supabase
                .rpc('get_credit_balance', { p_user_id: userId });

            if (rpcError) throw rpcError;

            if (data && data.length > 0) {
                setBalance(data[0]);
            }
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
        if (!userId) return false;

        const cost = getCreditCost(action);

        try {
            const { data, error: rpcError } = await supabase
                .rpc('use_credits', {
                    p_user_id: userId,
                    p_cost: cost,
                    p_action_type: action,
                    p_description: null,
                    p_node_id: nodeId || null
                });

            if (rpcError) throw rpcError;

            // Refresh balance after using credits
            await refreshBalance();

            return data === true;
        } catch (err: any) {
            console.error('Error using credits:', err);
            setError(err.message);
            return false;
        }
    }, [userId, refreshBalance]);

    // Check if user can afford an action
    const canAfford = useCallback((action: CreditActionType): boolean => {
        if (!balance) return false;
        const cost = getCreditCost(action);
        return balance.total_remaining >= cost;
    }, [balance]);

    // Claim welcome bonus
    const claimWelcomeBonus = useCallback(async (): Promise<boolean> => {
        if (!userId) return false;

        try {
            const { data, error: rpcError } = await supabase
                .rpc('claim_welcome_bonus', { p_user_id: userId });

            if (rpcError) throw rpcError;

            // Refresh balance after claiming
            await refreshBalance();

            return data === true;
        } catch (err: any) {
            console.error('Error claiming bonus:', err);
            setError(err.message);
            return false;
        }
    }, [userId, refreshBalance]);

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
