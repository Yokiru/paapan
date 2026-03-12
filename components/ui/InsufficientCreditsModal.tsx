'use client';

/**
 * Insufficient Credits Modal
 * Shows when user tries to perform action without enough credits
 */

import { getCreditCost, formatCredits, SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { CreditActionType } from '@/types/credit';
import { useCreditStore } from '@/store/useCreditStore';

interface InsufficientCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    action: CreditActionType;
    onBuyCredits: () => void;
}

export default function InsufficientCreditsModal({
    isOpen,
    onClose,
    action,
    onBuyCredits,
}: InsufficientCreditsModalProps) {
    const { balance } = useCreditStore();

    if (!isOpen) return null;

    const cost = getCreditCost(action);
    const totalAvailable = balance.remaining +
        (balance.freeCreditsToday - balance.freeCreditsUsedToday);
    const shortage = cost - totalAvailable;

    const plusPlan = SUBSCRIPTION_PLANS.find(p => p.id === 'plus')!;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {/* Icon */}
                <div className="flex justify-center pt-2">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                <div className="pt-6 pb-6 text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Kredit Tidak Cukup
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Kamu butuh <span className="font-semibold text-blue-600">{cost} kredit</span> untuk aksi ini,
                        tapi kamu hanya punya <span className="font-semibold">{formatCredits(totalAvailable)}</span>.
                    </p>

                    {/* Shortage info */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Required</span>
                            <span className="font-medium">{cost} credits</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-gray-500">Available</span>
                            <span className="font-medium">{formatCredits(totalAvailable)} credits</span>
                        </div>
                        <div className="border-t mt-2 pt-2 flex items-center justify-between text-sm">
                            <span className="text-red-600 font-medium">Shortage</span>
                            <span className="font-semibold text-red-600">{shortage} credits</span>
                        </div>
                    </div>

                    {/* Suggestion */}
                    <p className="text-sm text-gray-500 mb-4">
                        Upgrade ke <span className="font-semibold text-blue-600">Plus</span> mulai{' '}
                        <span className="font-semibold">Rp {plusPlan.priceIDR.toLocaleString('id-ID')}/bulan</span>{' '}
                        untuk {plusPlan.creditsPerMonth} kredit/bulan
                    </p>
                </div>

                    {/* Actions */}
                    <div className="pt-2 flex gap-3 p-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            Tutup
                        </button>
                        <button
                            onClick={() => {
                                onClose();
                                onBuyCredits();
                            }}
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                        >
                            Upgrade Paket
                        </button>
                    </div>
                </div>
            </div>
    );
}
