'use client';

/**
 * Insufficient Credits Modal
 * Shows when user tries to perform action without enough credits
 */

import { getCreditCost, formatCredits, CREDIT_PACKAGES } from '@/lib/creditCosts';
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

    const cheapestPackage = CREDIT_PACKAGES[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
                {/* Icon */}
                <div className="flex justify-center pt-8">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Insufficient Credits
                    </h3>
                    <p className="text-gray-600 mb-4">
                        You need <span className="font-semibold text-blue-600">{cost} credits</span> for this action,
                        but you only have <span className="font-semibold">{formatCredits(totalAvailable)}</span>.
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
                        Get {cheapestPackage.credits} credits starting at just{' '}
                        <span className="font-semibold">Rp {cheapestPackage.price.toLocaleString('id-ID')}</span>
                    </p>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            onBuyCredits();
                        }}
                        className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                        Buy Credits
                    </button>
                </div>
            </div>
        </div>
    );
}
