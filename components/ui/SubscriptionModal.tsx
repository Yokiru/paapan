import React, { useMemo } from 'react';
import { Check, X, Sparkles, Crown, Key } from 'lucide-react';
import { createPortal } from 'react-dom';
import { SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { useCreditStore } from '@/store/useCreditStore';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal = ({ isOpen, onClose }: SubscriptionModalProps) => {

    // Fetch reactive state from Zustand instead of hardcoding free
    const currentTier = useCreditStore((state) => state.currentTier);

    const handleUpgrade = (tierId: string) => {
        if (tierId === currentTier) return;
        // TODO: Integrate with Midtrans / Lemon Squeezy
        window.open('https://wa.me/62895360148909?text=Halo%20Admin%20Paapan!%20%F0%9F%91%8B%0A%0ASaya%20tertarik%20untuk%20upgrade%20ke%20paket%20' + tierId.toUpperCase() + '.%20Bisa%20bantu%3F', '_blank');
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Outer Card */}
            <div
                className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-200 rounded-2xl p-2.5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Inner Card */}
                <div className="bg-white rounded-xl overflow-y-auto max-h-[calc(90vh-20px)]">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 z-10"
                    >
                        <X size={20} />
                    </button>

                    {/* Header */}
                    <div className="px-8 pt-6 pb-5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold mb-3">
                            ✨ Pilih Paket
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 mb-1">
                            Paket Langganan
                        </h2>
                        <p className="text-zinc-500 text-sm">
                            Pilih paket yang sesuai kebutuhanmu. Upgrade kapan saja.
                        </p>
                    </div>

                    {/* Pricing Cards Grid */}
                    <div className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {SUBSCRIPTION_PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`relative flex flex-col rounded-xl border-2 transition-all duration-200 ${plan.popular
                                        ? 'border-blue-500 bg-blue-50/30 shadow-lg shadow-blue-100'
                                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                                        }`}
                                >
                                    {/* Popular or Developer Badge */}
                                    {plan.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
                                            Paling Populer
                                        </div>
                                    )}
                                    {plan.id === 'api-pro' && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
                                            Khusus Developer
                                        </div>
                                    )}

                                    {/* Card Content */}
                                    <div className="p-5 flex-1">
                                        {/* Badge */}
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${plan.id === 'pro'
                                                ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700'
                                                : plan.popular
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-zinc-100 text-zinc-600'
                                                }`}>
                                                {plan.id === 'pro' && <Crown size={10} />}
                                                {plan.id === 'api-pro' && <Key size={10} />}
                                                {plan.id === 'plus' && <Sparkles size={10} />}
                                                {plan.name.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-1">
                                            {plan.priceIDR === 0 ? (
                                                <span className="text-3xl font-bold text-zinc-900">Gratis</span>
                                            ) : (
                                                <>
                                                    <span className="text-3xl font-bold text-zinc-900">
                                                        Rp {plan.priceIDR.toLocaleString('id-ID')}
                                                    </span>
                                                    <span className="text-zinc-400 text-sm ml-1">/bulan</span>
                                                </>
                                            )}
                                        </div>

                                        {/* USD Price (for global customers) */}
                                        {plan.priceUSD > 0 && (
                                            <div className="mb-2">
                                                <span className="text-xs text-zinc-400">
                                                    atau ${plan.priceUSD}/mo (Global)
                                                </span>
                                            </div>
                                        )}

                                        {/* Description */}
                                        <p className="text-zinc-500 text-sm mb-4">
                                            {plan.description}
                                        </p>

                                        {/* Button */}
                                        <button
                                            onClick={() => handleUpgrade(plan.id)}
                                            disabled={plan.id === currentTier}
                                            className={`w-full py-2.5 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${plan.id === currentTier
                                                ? 'bg-zinc-100 text-zinc-400 cursor-default'
                                                : plan.popular
                                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                                                    : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                                }`}
                                        >
                                            {plan.id === currentTier
                                                ? 'Paket Saat Ini'
                                                : `Upgrade ke ${plan.name}`
                                            }
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div className="mx-5 border-t border-zinc-200" />

                                    {/* Features */}
                                    <ul className="p-5 pt-4 space-y-2.5">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-start text-sm text-zinc-600">
                                                <Check className={`w-4 h-4 mr-2.5 flex-shrink-0 mt-0.5 ${plan.popular ? 'text-blue-500' : 'text-zinc-400'
                                                    }`} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                        {plan.byok && (
                                            <li className="flex items-start text-sm font-medium text-emerald-600">
                                                <Key className="w-4 h-4 mr-2.5 flex-shrink-0 mt-0.5 text-emerald-500" />
                                                <span>BYOK — Unlimited AI dengan key sendiri</span>
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Footer Info */}
                        <div className="mt-5 p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                            <p className="text-sm text-zinc-600 text-center">
                                💳 Pembayaran via <strong>Midtrans</strong> (QRIS, GoPay, Transfer) untuk Indonesia
                                &nbsp;•&nbsp; <strong>Lemon Squeezy</strong> (Kartu Kredit) untuk Global
                            </p>
                        </div>

                        {/* Footer */}
                        <p className="mt-4 text-xs text-zinc-400 text-center">
                            Kredit reset setiap bulan • Bisa cancel kapan saja • Harga belum termasuk pajak
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
