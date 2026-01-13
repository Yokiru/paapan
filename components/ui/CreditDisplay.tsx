'use client';

/**
 * Credit Display Component - Simple text version
 */

import { useCreditStore } from '@/store/useCreditStore';
import { useEffect } from 'react';

export default function CreditDisplay() {
    const { balance, initializeCredits } = useCreditStore();

    useEffect(() => {
        initializeCredits();
    }, [initializeCredits]);

    const freeRemaining = balance.freeCreditsToday - balance.freeCreditsUsedToday;

    return (
        <span className="text-xs text-gray-400">
            {freeRemaining}/{balance.freeCreditsToday} daily free chats
        </span>
    );
}
