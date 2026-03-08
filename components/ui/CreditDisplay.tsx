'use client';
import { useCreditStore } from '@/store/useCreditStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { getCreditLimit } from '@/lib/creditCosts';

export default function CreditDisplay() {
    const { balance, isLoading } = useCreditStore();
    const userId = useWorkspaceStore(state => state.userId);
    const limitInfo = getCreditLimit();

    if (isLoading) {
        return <span className="text-xs text-gray-400 animate-pulse">— credits</span>;
    }

    let remaining = 0;
    let total = 0;
    let suffix = '';

    if (limitInfo.type === 'daily') {
        remaining = Math.max(0, balance.freeCreditsToday - balance.freeCreditsUsedToday);
        total = balance.freeCreditsToday;
        suffix = '/day';
    } else {
        remaining = Math.max(0, balance.monthlyCredits - balance.monthlyCreditsUsed);
        total = balance.monthlyCredits;
        suffix = '/mo';
    }

    const isLow = remaining <= Math.floor(total * 0.2);

    return (
        <div className="flex items-center gap-1 min-w-0">
            {/* Credit icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                className="shrink-0 text-gray-400" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l2 2" strokeLinecap="round" />
            </svg>
            <span
                className={`text-xs font-medium truncate ${isLow ? 'text-orange-400' : 'text-gray-400'}`}
                title={`${remaining} dari ${total} kredit AI${suffix}`}
            >
                {remaining}
                <span className="text-gray-400 font-normal">/{total}{suffix}</span>
            </span>
            {balance.remaining > 0 && (
                <span className="shrink-0 text-[10px] bg-blue-50 text-blue-400 px-1 rounded-full leading-4 font-medium">
                    +{balance.remaining}
                </span>
            )}
        </div>
    );
}
