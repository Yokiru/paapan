'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/lib/i18n';
import { useCreditStore } from '@/store/useCreditStore';
import { useAISettingsStore, AIResponseStyle, AIResponseLanguage } from '@/store/useAISettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { getCreditLimit } from '@/lib/creditCosts';
import { Sparkles, Crown, Zap, Coins } from 'lucide-react';

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
    const { t } = useTranslation();
    const { currentSettings, saveSettings, loadSettingsFromProfile } = useAISettingsStore();
    const { balance, currentTier } = useCreditStore();
    const { userId } = useWorkspaceStore();
    const limitInfo = getCreditLimit();

    const [responseStyle, setResponseStyle] = useState<AIResponseStyle>(currentSettings.responseStyle);
    const [responseLanguage, setResponseLanguage] = useState<AIResponseLanguage>(currentSettings.responseLanguage);
    const [userName, setUserName] = useState(currentSettings.userName);
    const [customInstructions, setCustomInstructions] = useState(currentSettings.customInstructions);
    const [isSaving, setIsSaving] = useState(false);

    // Sync form with store when modal opens or user changes
    useEffect(() => {
        if (isOpen) {
            // Load fresh from Supabase when modal opens
            if (userId) {
                loadSettingsFromProfile(userId).then(() => {
                    const fresh = useAISettingsStore.getState().currentSettings;
                    setResponseStyle(fresh.responseStyle);
                    setResponseLanguage(fresh.responseLanguage);
                    setUserName(fresh.userName);
                    setCustomInstructions(fresh.customInstructions);
                });
            } else {
                setResponseStyle(currentSettings.responseStyle);
                setResponseLanguage(currentSettings.responseLanguage);
                setUserName(currentSettings.userName);
                setCustomInstructions(currentSettings.customInstructions);
            }
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        if (userId) {
            // Save to Supabase (cloud) — persists across browsers
            await saveSettings(userId, {
                responseStyle,
                responseLanguage,
                userName,
                customInstructions
            });
        }

        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 500);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-[600px] max-h-[90vh] p-3 bg-zinc-100 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full bg-white rounded-[20px] p-8 relative overflow-y-auto max-h-[calc(90vh-24px)]">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{t.aiSettingsModal.title}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t.aiSettingsModal.subtitle}</p>
                    </div>

                    {/* Settings */}
                    <div className="space-y-6">
                        {/* ======================= */}
                        {/* 1. Credit Information    */}
                        {/* ======================= */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Detail Kuota AI
                            </label>
                            <p className="text-xs text-gray-500 mb-3">Sisa kredit kognitif untuk Paapan AI Anda.</p>

                            <div className="p-5 border-2 border-gray-100 rounded-2xl bg-white shadow-sm flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                            {currentTier === 'pro' ? <Crown size={18} className="text-amber-500" /> : currentTier === 'plus' ? <Sparkles size={18} /> : <Zap size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{currentTier} PLAN</p>
                                            <h3 className="text-xl font-bold flex items-baseline gap-1 text-gray-900">
                                                {limitInfo.type === 'daily'
                                                    ? Math.max(0, balance.freeCreditsToday - balance.freeCreditsUsedToday).toLocaleString('id-ID')
                                                    : Math.max(0, balance.monthlyCredits - balance.monthlyCreditsUsed).toLocaleString('id-ID')}
                                                <span className="text-sm font-medium text-gray-400">
                                                    / {limitInfo.type === 'daily' ? balance.freeCreditsToday.toLocaleString('id-ID') : balance.monthlyCredits.toLocaleString('id-ID')} {limitInfo.type === 'daily' ? 'harian' : 'bulanan'}
                                                </span>
                                            </h3>
                                        </div>
                                    </div>

                                    {balance.remaining > 0 && (
                                        <div className="flex flex-col items-end text-right">
                                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Top-up Bonus</span>
                                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-100/50">
                                                <Coins size={14} />
                                                <span className="font-bold text-sm tracking-tight">+{balance.remaining.toLocaleString('id-ID')}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {(() => {
                                    const used = limitInfo.type === 'daily' ? balance.freeCreditsUsedToday : balance.monthlyCreditsUsed;
                                    const total = limitInfo.type === 'daily' ? balance.freeCreditsToday : balance.monthlyCredits;
                                    const percentage = Math.min(100, Math.max(0, (used / total) * 100)) || 0;
                                    const isLow = percentage > 80;
                                    return (
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                            <div
                                                className={`h-full transition-all duration-500 ease-out rounded-full ${isLow ? 'bg-red-500' : 'bg-blue-500'}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* Response Style */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                {t.aiSettingsModal.responseStyle}
                            </label>
                            <p className="text-xs text-gray-500 mb-3">{t.aiSettingsModal.responseStyleDesc}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'professional', label: t.aiSettingsModal.professional, icon: '💼', desc: t.aiSettingsModal.professionalDesc },
                                    { value: 'friendly', label: t.aiSettingsModal.friendly, icon: '😊', desc: t.aiSettingsModal.friendlyDesc },
                                    { value: 'concise', label: t.aiSettingsModal.concise, icon: '⚡', desc: t.aiSettingsModal.conciseDesc },
                                ].map((style) => (
                                    <button
                                        key={style.value}
                                        onClick={() => setResponseStyle(style.value as AIResponseStyle)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${responseStyle === style.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="text-xl mb-2 block">{style.icon}</span>
                                        <p className={`text-sm font-medium ${responseStyle === style.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                            {style.label}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{style.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Response Language */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                {t.aiSettingsModal.responseLanguage}
                            </label>
                            <p className="text-xs text-gray-500 mb-3">{t.aiSettingsModal.responseLanguageDesc}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'en', label: t.aiSettingsModal.english, flag: '🇺🇸' },
                                    { value: 'id', label: t.aiSettingsModal.indonesian, flag: '🇮🇩' },
                                ].map((lang) => (
                                    <button
                                        key={lang.value}
                                        onClick={() => setResponseLanguage(lang.value as AIResponseLanguage)}
                                        className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${responseLanguage === lang.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="text-2xl">{lang.flag}</span>
                                        <span className={`text-sm font-medium ${responseLanguage === lang.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                            {lang.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Your Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                {t.aiSettingsModal.yourName}
                            </label>
                            <p className="text-xs text-gray-500 mb-3">{t.aiSettingsModal.yourNameDesc}</p>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                placeholder={t.aiSettingsModal.yourNamePlaceholder}
                            />
                        </div>

                        {/* Custom Instructions */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                {t.aiSettingsModal.customInstructions}
                            </label>
                            <p className="text-xs text-gray-500 mb-3">{t.aiSettingsModal.customInstructionsDesc}</p>
                            <textarea
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                rows={4}
                                className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                                placeholder={t.aiSettingsModal.customInstructionsPlaceholder}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70"
                        >
                            {isSaving ? t.common.saving : t.aiSettingsModal.savePreferences}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
