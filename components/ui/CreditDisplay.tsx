'use client';
import { useCreditStore } from '@/store/useCreditStore';
import { Sparkles, Crown, User } from 'lucide-react';

export default function CreditDisplay() {
    const { currentTier, isLoading } = useCreditStore();

    if (isLoading) {
        return <span className="text-xs text-zinc-400 animate-pulse">— plan</span>;
    }

    // Mapping colors and icons per tier
    const tierConfig = {
        free: {
            label: 'Free Plan',
            icon: <User size={12} className="text-zinc-500" />,
            style: 'text-zinc-500 bg-zinc-100/50 border-zinc-200'
        },
        plus: {
            label: 'Plus Plan',
            icon: <Sparkles size={12} className="text-blue-500" />,
            style: 'text-blue-600 bg-blue-50/80 border-blue-200/50'
        },
        pro: {
            label: 'Pro Plan',
            icon: <Crown size={12} className="text-amber-500" />,
            style: 'text-amber-600 bg-amber-50/80 border-amber-200/50'
        }
    };

    const activeTier = tierConfig[currentTier] || tierConfig.free;

    return (
        <div className="flex items-center mt-1">
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border backdrop-blur-sm transition-colors ${activeTier.style}`}>
                {activeTier.icon}
                <span className="text-[10px] font-semibold tracking-wide uppercase">
                    {activeTier.label}
                </span>
            </div>
        </div>
    );
}
