'use client';
import { useEffect, useState } from 'react';
import { useCreditStore } from '@/store/useCreditStore';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

export default function CreditDisplay() {
    // Auth state to determine which store to use
    const { user, isLoading: isAuthLoading } = useAuth();

    // Guest store (LocalStorage)
    const { balance: localBalance, initializeCredits } = useCreditStore();

    // User store (Supabase)
    const { balance: remoteBalance, refreshBalance } = useCredits();

    // Initialize/Refresh based on auth state
    useEffect(() => {
        if (!isAuthLoading) {
            if (user) {
                refreshBalance();
            } else {
                initializeCredits();
            }
        }
    }, [user, isAuthLoading, refreshBalance, initializeCredits]);

    if (isAuthLoading) {
        return <span className="text-xs text-gray-400">Loading...</span>;
    }

    if (user && remoteBalance) {
        // Logged in user display
        const freeRemaining = remoteBalance.free_credits_remaining;

        return (
            <span className="text-xs text-gray-400">
                {freeRemaining}/{remoteBalance.free_credits_today} daily free chats
                {remoteBalance.remaining_purchased > 0 && ` • ${remoteBalance.remaining_purchased} credits`}
            </span>
        );
    }

    // Guest display
    const freeRemaining = localBalance.freeCreditsToday - localBalance.freeCreditsUsedToday;
    return (
        <span className="text-xs text-gray-400">
            Guest: {Math.max(0, freeRemaining)}/{localBalance.freeCreditsToday} daily free chats
        </span>
    );
}
