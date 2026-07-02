'use client';

/**
 * Credit Purchase Modal
 * Shows Open Beta credit/contact options
 */

import { useState } from 'react';
import { CREDIT_PACKAGES, formatCredits } from '@/lib/creditCosts';
import { CreditPackage } from '@/types/credit';

interface CreditPurchaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreditPurchaseModal({ isOpen, onClose }: CreditPurchaseModalProps) {
    const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);

    if (!isOpen) return null;

    const handleContact = () => {
        if (!selectedPackage) return;

        const whatsappUrl =
            'https://wa.me/62895360148909?text=' +
            encodeURIComponent(
                `Halo tim Paapan! Saya tertarik dengan paket ${selectedPackage.name} saat Open Beta. Bisa bantu info akses atau kuota tambahannya?`
            );

        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/40"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Opsi Kredit Open Beta
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Payment belum aktif. Pilih paket referensi lalu hubungi tim Paapan.
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
                                    Coming Soon
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
                                    Akses manual selama Open Beta
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-gray-600">
                                <p className="font-medium text-gray-700 mb-1">Info Open Beta</p>
                                <ul className="space-y-1">
                                    <li>- Paket berbayar belum checkout otomatis</li>
                                    <li>- Tim Paapan bisa bantu tambah kuota beta</li>
                                    <li>- BYOK tetap bisa dipakai jika sesuai tier atau flow yang tersedia</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t bg-gray-50">
                    <button
                        onClick={handleContact}
                        disabled={!selectedPackage}
                        className={`
                            w-full py-3 rounded-xl font-medium text-white transition-all duration-200
                            ${selectedPackage
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm hover:shadow'
                                : 'bg-gray-300 cursor-not-allowed'
                            }
                        `}
                    >
                        {selectedPackage ? `Hubungi Tim untuk ${selectedPackage.name}` : 'Pilih Paket Dulu'}
                    </button>
                </div>
            </div>
        </div>
    );
}
