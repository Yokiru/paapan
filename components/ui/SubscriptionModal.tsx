import React, { useMemo } from 'react';
import { Check, X, MessageCircle, Bell } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal = ({ isOpen, onClose }: SubscriptionModalProps) => {

    const tiers = useMemo(() => [
        {
            name: 'Basic',
            credits: '275',
            description: 'Untuk pengguna baru',
            features: [
                '250 + 25 bonus kredit',
                'Chat AI sederhana',
                'Chat AI standar',
            ],
            buttonText: 'Hubungi Kami',
            buttonIcon: 'whatsapp',
            popular: false,
            bgColor: 'bg-white',
        },
        {
            name: 'Plus',
            credits: '700',
            description: 'Untuk pengguna aktif',
            features: [
                '600 + 100 bonus kredit',
                'AI reasoning lanjutan',
                'Analisis gambar',
                'Pembuatan kode',
            ],
            buttonText: 'Beritahu Saya',
            buttonIcon: 'notify',
            popular: true,
            bgColor: 'bg-blue-50',
        },
        {
            name: 'Pro',
            credits: '1500',
            description: 'Untuk power user',
            features: [
                '1200 + 300 bonus kredit',
                'Semua fitur AI',
                'Proses prioritas',
                'Nilai terbaik',
            ],
            buttonText: 'Hubungi Kami',
            buttonIcon: 'whatsapp',
            popular: false,
            bgColor: 'bg-white',
        },
    ], []);

    const handleContact = () => {
        window.open('https://wa.me/62895360148909?text=Halo%20Admin%20Paapan!%20%F0%9F%91%8B%0A%0ASaya%20tertarik%20untuk%20mendapatkan%20kuota%20kredit%20tambahan.%20Bisa%20bantu%3F', '_blank');
    };

    const handleNotify = () => {
        window.open('https://forms.gle/ERqfEuzFrwBsBsEY7', '_blank');
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            {/* Outer Card - Double Layer Design (thick border) */}
            <div
                className="relative w-full max-w-4xl bg-zinc-200 rounded-2xl p-2.5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Inner Card */}
                <div className="bg-white rounded-xl overflow-hidden">

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-600 z-10"
                    >
                        <X size={20} />
                    </button>

                    {/* Header */}
                    <div className="px-8 pt-6 pb-5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold mb-3">
                            🚀 Open Beta
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 mb-1">
                            Paket Kredit
                        </h2>
                        <p className="text-zinc-500 text-sm">
                            Pilih paket yang sesuai kebutuhanmu
                        </p>
                    </div>

                    {/* Pricing Cards Grid */}
                    <div className="px-6 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {tiers.map((tier) => (
                                <div
                                    key={tier.name}
                                    className={`relative flex flex-col rounded-xl border border-zinc-200 ${tier.bgColor}`}
                                >
                                    {/* Card Content */}
                                    <div className="p-5">
                                        {/* Badge */}
                                        <div className="mb-4">
                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider ${tier.popular
                                                ? 'bg-zinc-800 text-white'
                                                : 'bg-zinc-100 text-zinc-600'
                                                }`}>
                                                {tier.name.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Credits */}
                                        <div className="mb-1">
                                            <span className="text-3xl font-bold text-zinc-900">
                                                {tier.credits}
                                            </span>
                                            <span className="text-zinc-400 text-sm ml-1">kredit</span>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-3">
                                            <span className="text-sm font-medium text-amber-600">
                                                Coming Soon
                                            </span>
                                        </div>

                                        {/* Description */}
                                        <p className="text-zinc-500 text-sm mb-4">
                                            {tier.description}
                                        </p>

                                        {/* Button */}
                                        <button
                                            onClick={tier.buttonIcon === 'notify' ? handleNotify : handleContact}
                                            className={`w-full py-2.5 px-4 rounded-full font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${tier.buttonIcon === 'notify'
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                                }`}
                                        >
                                            {tier.buttonIcon === 'notify' ? (
                                                <Bell size={14} />
                                            ) : (
                                                <MessageCircle size={14} />
                                            )}
                                            {tier.buttonText}
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div className="mx-5 border-t border-zinc-200" />

                                    {/* Features */}
                                    <ul className="p-5 pt-4 space-y-2">
                                        {tier.features.map((feature) => (
                                            <li key={feature} className="flex items-center text-sm text-zinc-600">
                                                <Check className="w-4 h-4 text-zinc-400 mr-2.5 flex-shrink-0" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Beta Notice */}
                        <div className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-100">
                            <p className="text-sm text-amber-800 text-center">
                                🎉 <strong>Open Beta:</strong> Pembayaran belum aktif. Hubungi kami untuk kuota tambahan.
                            </p>
                        </div>

                        {/* Footer */}
                        <p className="mt-4 text-xs text-zinc-400 text-center">
                            Kredit berlaku 30 hari • QRIS, GoPay, OVO, Dana (segera hadir)
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
