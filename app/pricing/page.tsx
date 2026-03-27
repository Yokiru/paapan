"use client";

import React from 'react';
import Link from 'next/link';
import { 
    Check, ArrowLeft, Sparkles, Crown, Key, 
    Coins, Bot, Layers, PenTool, Image as ImageIcon, 
    Cloud, Link2, Download, Headphones 
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { useCreditStore } from '@/store/useCreditStore';

const getFeatureIcon = (text: string) => {
    const t = text.toLowerCase();
    
    const iconColor = 'text-black';

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
            {children}
        </div>
    );

    const iconClass = `w-3 h-3 ${iconColor}`;

    let icon = <Check strokeWidth={3} className={iconClass} />;
    if (t.includes('kredit')) icon = <Coins strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('byok') || t.includes('api key')) icon = <Key strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('model')) icon = <Bot strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('workspace')) icon = <Layers strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('drawing') || t.includes('pen tool')) icon = <PenTool strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('image node')) icon = <ImageIcon strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('cloud sync')) icon = <Cloud strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('url scraping')) icon = <Link2 strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('export')) icon = <Download strokeWidth={2.5} className={iconClass} />;
    else if (t.includes('support')) icon = <Headphones strokeWidth={2.5} className={iconClass} />;
    
    return <Wrapper>{icon}</Wrapper>;
};

export default function PricingPage() {
    const currentTier = useCreditStore(state => state.currentTier);

    const isComingSoonPlan = (tierId: string) => tierId !== 'free';

    const getPlanPriceMeta = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
        if (plan.id === 'free') {
            return {
                primary: 'Gratis',
                secondary: 'Selama public test',
                caption: 'Mulai eksplorasi fitur dasar Paapan tanpa biaya.',
            };
        }

        return {
            primary: 'Segera hadir',
            secondary: '',
            caption: 'Harga final akan diumumkan saat paket berbayar resmi dibuka.',
        };
    };

    const getButtonConfig = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
        if (currentTier === plan.id) {
            return {
                text: 'Paket Saat Ini',
                disabled: true,
                className: 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed shadow-none',
                onClick: undefined
            };
        }

        if (isComingSoonPlan(plan.id)) {
            return {
                text: 'Segera hadir',
                disabled: true,
                className: 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed shadow-none',
                onClick: undefined
            };
        }

        return {
            text: 'Mulai Gratis',
            disabled: false,
            className: 'bg-[#0a0a0a] hover:bg-black text-white border-black shadow-md hover:shadow-lg',
            onClick: undefined
        };
    };

    const getGradientTheme = (id: string, isOuter: boolean) => {
        switch (id) {
            case 'free':
                return isOuter 
                    ? 'from-blue-100/60 to-blue-50/30 border-blue-200/30' 
                    : 'from-white via-white to-blue-50/60 border-blue-100/50 shadow-blue-900/5 ring-1 ring-inset ring-blue-50/50';
            case 'plus':
                return isOuter 
                    ? 'from-pink-100/60 to-pink-50/30 border-pink-200/30' 
                    : 'from-white via-white to-pink-50/60 border-pink-100/50 shadow-pink-900/5 ring-1 ring-inset ring-pink-50/50';
            case 'pro':
                return isOuter 
                    ? 'from-purple-100/60 to-purple-50/30 border-purple-200/30' 
                    : 'from-white via-white to-purple-50/60 border-purple-100/50 shadow-purple-900/5 ring-1 ring-inset ring-purple-50/50';
            default: // API & BYOK (emerald/green)
                return isOuter 
                    ? 'from-emerald-100/60 to-emerald-50/30 border-emerald-200/30' 
                    : 'from-white via-white to-emerald-50/60 border-emerald-100/50 shadow-emerald-900/5 ring-1 ring-inset ring-emerald-50/50';
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 overflow-hidden">
            {/* Back Button */}
            <div className="absolute top-6 left-6 z-50">
                <Link
                    href="/"
                    className="flex items-center justify-center w-10 h-10 bg-white/80 backdrop-blur-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 shadow-sm transition-all"
                    title="Kembali ke Aplikasi"
                >
                    <ArrowLeft size={20} />
                </Link>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center">
                {/* Header Subtitle */}
                <div className="text-center mb-16 relative z-10 w-full max-w-2xl px-4 sm:px-0">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-6">
                        Tingkatkan Produktivitas Anda.
                    </h1>
                    <p className="text-lg text-gray-500 font-medium">
                        Eksplorasi gratis saat public test. Paket berbayar sedang kami siapkan dan akan dibuka bertahap.
                    </p>
                </div>

                {/* Credit Plans (Top) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl items-stretch">
                    {SUBSCRIPTION_PLANS.filter(p => !p.id.startsWith('api-')).map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col h-full p-[3px] sm:p-2.5 bg-gradient-to-br ${getGradientTheme(plan.id, true)} rounded-[32px] transition-all duration-300 hover:shadow-md ${plan.popular ? 'shadow-sm -translate-y-1' : ''}`}
                        >
                            {/* Inner Card Wrapper */}
                            <div className={`bg-gradient-to-br ${getGradientTheme(plan.id, false)} rounded-[30px] sm:rounded-[24px] flex-1 flex flex-col h-full shadow-sm relative overflow-hidden`}>
                                {/* Popular Badge */}
                                {plan.popular && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-b-xl shadow-sm z-10 w-max">
                                        Paling Populer
                                    </div>
                                )}

                                {/* Card Content */}
                                <div className={`p-6 sm:p-7 pt-10 sm:pt-11 flex-1 flex flex-col h-full`}>
                                    {/* Header Block to ensure button alignment */}
                                    <div className="flex flex-col min-h-[150px] sm:min-h-[160px]">
                                        {/* Badge Title */}
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider bg-white/60 backdrop-blur-sm text-gray-800 border border-gray-100/50 shadow-sm`}>
                                                {plan.id === 'pro' && <Crown size={12} />}
                                                {plan.id === 'plus' && <Sparkles size={12} />}
                                                {plan.name.toUpperCase()}
                                            </span>
                                        </div>

                                    {(() => {
                                        const priceMeta = getPlanPriceMeta(plan);
                                        return (
                                            <>
                                        {/* Price */}
                                        <div className="mb-1 flex items-baseline flex-wrap gap-x-1">
                                            <span className="text-4xl font-extrabold text-gray-900 tracking-tight">
                                                {priceMeta.primary}
                                            </span>
                                            {priceMeta.secondary && <span className="text-gray-500 font-medium whitespace-nowrap">{priceMeta.secondary}</span>}
                                        </div>
                                        <p className="text-sm text-gray-500 mb-4 leading-snug">
                                            {priceMeta.caption}
                                        </p>
                                            </>
                                        );
                                    })()}
                                    </div>

                                    {/* Action Button */}
                                    <div className="w-full mb-6">
                                        <button
                                            onClick={getButtonConfig(plan).onClick}
                                            disabled={getButtonConfig(plan).disabled}
                                            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 border border-solid ${getButtonConfig(plan).className}`}
                                        >
                                            {!getButtonConfig(plan).disabled && plan.popular && <Sparkles size={16} />}
                                            {getButtonConfig(plan).text}
                                        </button>
                                    </div>

                                    {/* Features List */}
                                    <div className="space-y-3 flex-1">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                {getFeatureIcon(feature)}
                                                <span className="text-sm text-gray-700 font-medium">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* API / BYOK Plans (Bottom horizontal stack) */}
                <div className="mt-12 w-full max-w-5xl">
                    <div className="flex flex-col gap-6">
                        {SUBSCRIPTION_PLANS.filter(p => p.id.startsWith('api-')).map((plan) => (
                            <div
                                key={plan.id}
                                className={`p-[3px] sm:p-2.5 bg-gradient-to-br ${getGradientTheme(plan.id, true)} rounded-[32px] transition-all duration-300 hover:shadow-md hover:-translate-y-1`}
                            >
                                <div className={`flex flex-col sm:flex-row items-center gap-6 p-6 sm:p-8 rounded-[30px] sm:rounded-[24px] bg-gradient-to-br ${getGradientTheme(plan.id, false)} shadow-sm relative overflow-hidden`}>
                                    {/* Left Side: Title, Desc, & Button */}
                                    <div className="flex-[1.5] text-center sm:text-left flex flex-col h-full">
                                        <div className="mb-2 flex items-center justify-center sm:justify-start gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider bg-gray-100 text-gray-700`}>
                                                <Key size={12} />
                                                {plan.name.toUpperCase()}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-extrabold text-gray-900 mb-1">
                                            {getPlanPriceMeta(plan).primary}
                                            {getPlanPriceMeta(plan).secondary && <span className="text-base text-gray-500 font-medium"> {getPlanPriceMeta(plan).secondary}</span>}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {getPlanPriceMeta(plan).caption}
                                        </p>

                                        {/* Action Button */}
                                        <div className="w-full mt-6 sm:mt-8">
                                            <button
                                                onClick={getButtonConfig(plan).onClick}
                                                disabled={getButtonConfig(plan).disabled}
                                                className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm transition-all active:scale-95 border border-solid ${getButtonConfig(plan).className}`}
                                            >
                                                {!getButtonConfig(plan).disabled && plan.id === 'api-pro' && <Sparkles size={16} />}
                                                {getButtonConfig(plan).text}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Side: Features List */}
                                    <div className="flex-[2.5] flex flex-wrap gap-x-6 gap-y-3 justify-center sm:justify-start sm:border-l border-gray-100 py-4 sm:py-0 sm:pl-8">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="flex items-center gap-3 w-full sm:w-[calc(50%-12px)]">
                                                {getFeatureIcon(feature)}
                                                <span className="text-sm text-gray-700 font-medium">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* FAQ or Info Section */}
                <div className="mt-20 text-center">
                    <p className="text-gray-500 text-sm">
                        Pertanyaan tentang paket atau ingin masuk waiting list lebih dulu? <br />
                        <a href="https://wa.me/62895360148909" target="_blank" rel="noreferrer" className="text-gray-900 font-bold hover:underline transition-colors mt-2 inline-block">Hubungi kami via WhatsApp</a>.
                    </p>
                </div>
            </main>
        </div>
    );
}
