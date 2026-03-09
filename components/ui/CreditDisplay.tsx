'use client';
import { useCreditStore } from '@/store/useCreditStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { getCreditLimit } from '@/lib/creditCosts';
import { Sparkles, Crown } from 'lucide-react';

export default function CreditDisplay() {
    const { balance, currentTier, isLoading } = useCreditStore();
    const userId = useWorkspaceStore(state => state.userId);
    const limitInfo = getCreditLimit();

    if (isLoading) {
        return <span className="text-xs text-gray-400 animate-pulse">— credits</span>;
    }

    let planRemaining = 0;

    if (limitInfo.type === 'daily') {
        planRemaining = Math.max(0, balance.freeCreditsToday - balance.freeCreditsUsedToday);
    } else {
        planRemaining = Math.max(0, balance.monthlyCredits - balance.monthlyCreditsUsed);
    }

    const totalRemaining = planRemaining + balance.remaining;
    const isLow = totalRemaining <= Math.floor(limitInfo.amount * 0.2);

    return (
        <div className="flex items-center gap-1.5 min-w-0 bg-white/50 hover:bg-white/80 transition-colors border border-zinc-200/50 rounded-full px-2.5 py-1 backdrop-blur-sm cursor-default">
            {/* Tier Badge */}
            {currentTier === 'pro' && <Crown size={12} className="text-amber-500 shrink-0" />}
            {currentTier === 'plus' && <Sparkles size={12} className="text-blue-500 shrink-0" />}

            {/* Credit Amount */}
            <span
                className={`text-xs font-semibold truncate tracking-tight pt-0.5 ${isLow ? 'text-red-500' : 'text-zinc-700'}`}
                title={`${planRemaining} kredit paket + ${balance.remaining} kredit bonus`}
            >
                {totalRemaining.toLocaleString('id-ID')}
            </span>

            <span className="text-[10px] font-medium text-zinc-400 capitalize hidden sm:inline-block">
                kredit
            </span>
        </div>
    );
}
