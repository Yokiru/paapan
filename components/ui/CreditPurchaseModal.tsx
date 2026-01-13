'use client';

/**
 * Credit Purchase Modal
 * Shows available credit packages for purchase
 */

import { useState } from 'react';
import { CREDIT_PACKAGES, formatCredits, formatPrice } from '@/lib/creditCosts';
import { useCreditStore } from '@/store/useCreditStore';
import { CreditPackage } from '@/types/credit';
import { useTranslation } from '@/lib/i18n';

interface CreditPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreditPurchaseModal({ isOpen, onClose }: CreditPurchaseModalProps) {
    const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const { addCredits } = useCreditStore();
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handlePurchase = async () => {
        if (!selectedPackage) return;

        setIsProcessing(true);

        // TODO: Integrate with payment gateway (Midtrans/Xendit)
        // For now, simulate purchase
        await new Promise(resolve => setTimeout(resolve, 1500));

        const totalCredits = selectedPackage.credits + selectedPackage.bonusCredits;
        addCredits(
            totalCredits,
            `Purchased ${selectedPackage.name} package`,
            selectedPackage.id
        );

        setIsProcessing(false);
        setSelectedPackage(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Buy Credits
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Choose a package that fits your needs
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Packages Grid */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {CREDIT_PACKAGES.map((pkg) => (
                            <button
                                key={pkg.id}
                                onClick={() => setSelectedPackage(pkg)}
                                className={`
                                    relative p-5 rounded-xl border-2 text-left transition-all duration-200
                                    ${selectedPackage?.id === pkg.id
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }
                                `}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium rounded-full">
                                        Popular
                                    </div>
                                )}

                                <div className="text-lg font-semibold text-gray-900 mb-1">
                                    {pkg.name}
                                </div>

                                <div className="text-2xl font-bold text-gray-900 mb-2">
                                    {formatPrice(pkg.price)}
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xl font-semibold text-blue-600">
                                        {formatCredits(pkg.credits)}
                                    </span>
                                    {pkg.bonusCredits > 0 && (
                                        <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                            +{formatCredits(pkg.bonusCredits)} bonus
                                        </span>
                                    )}
                                </div>

                                <div className="text-sm text-gray-500">
                                    {formatPrice(pkg.pricePerCredit)}/credit
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Info */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-gray-600">
                                <p className="font-medium text-gray-700 mb-1">Credit Information</p>
                                <ul className="space-y-1">
                                    <li>• Credits expire 30 days after purchase</li>
                                    <li>• Simple chat uses 1 credit</li>
                                    <li>• Advanced reasoning uses 10 credits</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50">
                    <button
                        onClick={handlePurchase}
                        disabled={!selectedPackage || isProcessing}
                        className={`
                            w-full py-3 rounded-xl font-medium text-white transition-all duration-200
                            ${selectedPackage && !isProcessing
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow'
                                : 'bg-gray-300 cursor-not-allowed'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Processing...
                            </span>
                        ) : selectedPackage ? (
                            `Buy ${selectedPackage.name} - ${formatPrice(selectedPackage.price)}`
                        ) : (
                            'Select a package'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
