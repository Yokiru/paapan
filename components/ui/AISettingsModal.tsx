'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, CircleHelp, Coins, Crown, Eye, EyeOff, Globe, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getModelById } from '@/lib/aiModels';
import { useCreditStore } from '@/store/useCreditStore';
import type { AIProvider } from '@/store/useAISettingsStore';
import { useAISettingsStore, AIResponseLanguage, AIResponseStyle } from '@/store/useAISettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function InfoTip({ text }: { text: string }) {
    return (
        <div className="group relative inline-flex">
            <div className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 text-zinc-400 transition-colors group-hover:border-zinc-400 group-hover:text-zinc-600">
                <CircleHelp size={12} />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg group-hover:block">
                {text}
            </div>
        </div>
    );
}

const formatDate = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const responseStyleOptions: Array<{ value: AIResponseStyle; label: string; hint: string }> = [
    { value: 'concise', label: 'Ringkas', hint: 'Cepat dan langsung ke inti' },
    { value: 'balanced', label: 'Seimbang', hint: 'Jelas tanpa terlalu panjang' },
    { value: 'detailed', label: 'Mendalam', hint: 'Lebih rinci dan lengkap' },
];

const responseLanguageOptions: Array<{ value: AIResponseLanguage; label: string; hint: string }> = [
    { value: 'id', label: 'Indonesia', hint: 'Bahasa utama untuk jawaban AI' },
    { value: 'en', label: 'English', hint: 'Useful for prompts and outputs in English' },
];

const providerOptions: Array<{ id: AIProvider; label: string; status: 'active' | 'coming-soon'; description: string }> = [
    {
        id: 'gemini',
        label: 'Gemini',
        status: 'active',
        description: 'Tersedia',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        status: 'coming-soon',
        description: 'Segera hadir',
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        status: 'coming-soon',
        description: 'Segera hadir',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        status: 'coming-soon',
        description: 'Segera hadir',
    },
];

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
    const { t } = useTranslation();
    const { userId } = useWorkspaceStore();
    const { balance, currentTier } = useCreditStore();
    const {
        currentSettings,
        saveSettings,
        loadSettingsFromProfile,
        selectedModelId,
        customApiKey,
        setCustomApiKey,
        validateCustomApiKey,
        byokProvider,
        setByokProvider,
        byokValidationState,
        byokError,
        byokLastValidatedAt,
        aiProviderMode,
        setAIProviderMode,
        byokAvailableModels,
        byokVisibleModelIds,
        toggleByokVisibleModel,
        hasActiveCustomKey,
    } = useAISettingsStore();

    const [responseStyle, setResponseStyle] = useState<AIResponseStyle>(currentSettings.responseStyle);
    const [responseLanguage, setResponseLanguage] = useState<AIResponseLanguage>(currentSettings.responseLanguage);
    const [userName, setUserName] = useState(currentSettings.userName);
    const [customInstructions, setCustomInstructions] = useState(currentSettings.customInstructions);
    const [allowWebSearch, setAllowWebSearch] = useState(currentSettings.allowWebSearch);
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
    const [showTransientByokSuccess, setShowTransientByokSuccess] = useState(false);
    const providerMenuRef = useRef<HTMLDivElement | null>(null);
    const previousByokValidationStateRef = useRef(byokValidationState);

    const isApiPro = currentTier === 'api-pro';
    const isByokMode = aiProviderMode === 'byok';
    const hasValidatedByok = hasActiveCustomKey();
    const validatedAtLabel = formatDate(byokLastValidatedAt);
    const planCreditsRemaining = currentTier === 'free'
        ? Math.max(0, balance.freeCreditsToday - balance.freeCreditsUsedToday)
        : Math.max(0, balance.monthlyCredits - balance.monthlyCreditsUsed);
    const planCreditsTotal = currentTier === 'free' ? balance.freeCreditsToday : balance.monthlyCredits;
    const planUsagePercent = planCreditsTotal > 0
        ? Math.min(100, Math.max(0, ((planCreditsTotal - planCreditsRemaining) / planCreditsTotal) * 100))
        : 0;

    const byokModels = byokAvailableModels;
    const selectedByokModel = byokModels.find((model) => model.id === selectedModelId) || getModelById(selectedModelId);
    const selectedProvider = providerOptions.find((provider) => provider.id === byokProvider) || providerOptions[0];

    useEffect(() => {
        if (!isOpen) return;

        if (userId) {
            loadSettingsFromProfile(userId).then(() => {
                const fresh = useAISettingsStore.getState().currentSettings;
                setResponseStyle(fresh.responseStyle);
                setResponseLanguage(fresh.responseLanguage);
                setUserName(fresh.userName);
                setCustomInstructions(fresh.customInstructions);
                setAllowWebSearch(fresh.allowWebSearch ?? false);
            });
            return;
        }

        setResponseStyle(currentSettings.responseStyle);
        setResponseLanguage(currentSettings.responseLanguage);
        setUserName(currentSettings.userName);
        setCustomInstructions(currentSettings.customInstructions);
        setAllowWebSearch(currentSettings.allowWebSearch ?? false);
    }, [isOpen, userId, currentSettings, loadSettingsFromProfile]);

    useEffect(() => {
        if (isOpen && isApiPro && aiProviderMode !== 'byok') {
            setAIProviderMode('byok');
        }
    }, [isOpen, isApiPro, aiProviderMode, setAIProviderMode]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!providerMenuRef.current?.contains(event.target as Node)) {
                setIsProviderMenuOpen(false);
            }
        };
        if (isProviderMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isProviderMenuOpen]);

    useEffect(() => {
        if (!isOpen) {
            setShowTransientByokSuccess(false);
            previousByokValidationStateRef.current = byokValidationState;
            return;
        }

        if (byokValidationState === 'valid' && previousByokValidationStateRef.current !== 'valid') {
            setShowTransientByokSuccess(true);
            previousByokValidationStateRef.current = byokValidationState;

            const timeoutId = window.setTimeout(() => {
                setShowTransientByokSuccess(false);
            }, 5000);

            return () => window.clearTimeout(timeoutId);
        }

        if (byokValidationState !== 'valid') {
            setShowTransientByokSuccess(false);
        }

        previousByokValidationStateRef.current = byokValidationState;
    }, [byokValidationState, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsSaving(true);
        if (userId) {
            await saveSettings(userId, {
                responseStyle,
                responseLanguage,
                userName,
                customInstructions,
                allowWebSearch,
            });
        }
        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 400);
    };

    const byokStatusTone = hasValidatedByok
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : byokValidationState === 'invalid'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : byokValidationState === 'checking'
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600';
    const shouldShowByokStatus = !userId || byokValidationState === 'checking' || byokValidationState === 'invalid' || showTransientByokSuccess;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[620px] rounded-[32px] bg-zinc-100 p-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative max-h-[calc(90vh-24px)] overflow-y-auto rounded-[22px] bg-white p-8">
                    <button onClick={onClose} className="absolute right-4 top-4 rounded-xl p-2 hover:bg-gray-100">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{t.aiSettingsModal.title}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t.aiSettingsModal.subtitle}</p>
                    </div>

                    <div className="space-y-5">
                        <section>
                            <div className="mb-3 flex items-center gap-2">
                                <label className="block text-sm font-semibold text-gray-900">Mode AI</label>
                                <InfoTip text="Pilih apakah ingin memakai kredit Paapan atau API key pribadi Anda sendiri." />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                                <button
                                    type="button"
                                    onClick={() => setAIProviderMode('paapan')}
                                    disabled={isApiPro}
                                    className={`rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all ${!isByokMode ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500 hover:bg-white/70'} ${isApiPro ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    Kredit Paapan
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAIProviderMode('byok')}
                                    className={`rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all ${isByokMode ? 'bg-white text-blue-700 shadow-sm' : 'text-zinc-500 hover:bg-white/70'}`}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>BYOK</span>
                                        <span className="group/byok-help relative inline-flex items-center">
                                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 text-[9px] leading-none text-zinc-400">
                                                ?
                                            </span>
                                            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/byok-help:opacity-100">
                                                Masukkan API key pribadi Anda. Key tetap tersimpan lokal di browser ini dan request AI akan memakai billing provider Anda sendiri.
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            </div>
                            {isApiPro && (
                                <p className="mt-2 text-xs text-amber-700">API Pro selalu memakai BYOK karena paket ini tidak menyediakan kredit sistem.</p>
                            )}
                        </section>

                        {!isByokMode ? (
                            <section className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                                <div className="mb-3 flex items-center gap-2">
                                    <label className="block text-sm font-semibold text-gray-900">Detail Kuota AI</label>
                                    <InfoTip text="Menampilkan sisa kredit plan dan bonus kredit yang masih bisa dipakai untuk request AI." />
                                </div>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                            {currentTier === 'pro' ? <Crown size={18} className="text-amber-500" /> : currentTier === 'plus' ? <Sparkles size={18} /> : <Zap size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{currentTier.toUpperCase()} PLAN</p>
                                            <h3 className="flex items-baseline gap-1 text-xl font-bold text-gray-900">
                                                <span>{planCreditsRemaining.toLocaleString('id-ID')}</span>
                                                <span className="text-sm font-medium text-gray-400">/ {planCreditsTotal.toLocaleString('id-ID')} {currentTier === 'free' ? 'harian' : 'bulanan'}</span>
                                            </h3>
                                        </div>
                                    </div>
                                    {balance.remaining > 0 && (
                                        <div className="flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-amber-600">
                                            <Coins size={14} />
                                            <span className="text-sm font-bold">+{balance.remaining.toLocaleString('id-ID')} bonus</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                                    <div className={`h-full rounded-full transition-all duration-500 ${planUsagePercent > 80 ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${planUsagePercent}%` }} />
                                </div>
                            </section>
                        ) : (
                            <section className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                                <div className="mb-4">
                                    <p className="text-sm font-semibold text-gray-900">Provider AI</p>
                                    <div ref={providerMenuRef} className="relative mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsProviderMenuOpen((prev) => !prev)}
                                            className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-all hover:border-zinc-300"
                                        >
                                            <div>
                                                <div className="text-sm font-semibold text-zinc-900">{selectedProvider.label}</div>
                                                <div className="mt-0.5 text-xs text-zinc-500">{selectedProvider.description}</div>
                                            </div>
                                            <ChevronDown size={16} className={`shrink-0 text-zinc-400 transition-transform ${isProviderMenuOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isProviderMenuOpen && (
                                            <div className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                                                {providerOptions.map((provider, index) => {
                                                    const isSelected = byokProvider === provider.id;
                                                    const isAvailable = provider.status === 'active';
                                                    return (
                                                        <button
                                                            key={provider.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isAvailable) {
                                                                    setByokProvider(provider.id);
                                                                }
                                                                setIsProviderMenuOpen(false);
                                                            }}
                                                            className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all ${index !== providerOptions.length - 1 ? 'border-b border-zinc-200' : ''} ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-zinc-50'} ${!isAvailable ? 'opacity-70' : ''}`}
                                                        >
                                                            <div>
                                                                <div className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-zinc-900'}`}>{provider.label}</div>
                                                                <div className="mt-0.5 text-xs text-zinc-500">{provider.description}</div>
                                                            </div>
                                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isAvailable ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                                                {provider.status === 'active' ? 'Aktif' : 'Coming soon'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative flex-1">
                                        <input
                                            type={showApiKey ? 'text' : 'password'}
                                            value={customApiKey}
                                            onChange={(e) => setCustomApiKey(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-4 pr-12 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                                            placeholder={byokProvider === 'gemini' ? 'Masukkan Gemini API key Anda' : 'Provider ini belum tersedia'}
                                        />
                                        <button type="button" onClick={() => setShowApiKey((prev) => !prev)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void validateCustomApiKey()}
                                        disabled={byokProvider !== 'gemini' || !userId || !customApiKey.trim() || byokValidationState === 'checking'}
                                        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                        {byokValidationState === 'checking' ? 'Memeriksa...' : 'Validasi'}
                                    </button>
                                </div>

                                {shouldShowByokStatus && (
                                    <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${byokStatusTone}`}>
                                    {!userId && (
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                            <p>Login dulu untuk memvalidasi API key pribadi Anda.</p>
                                        </div>
                                    )}
                                    {userId && byokValidationState === 'checking' && (
                                        <div className="flex items-start gap-2">
                                            <ShieldCheck size={16} className="mt-0.5 shrink-0 animate-pulse" />
                                            <p>Kami sedang memeriksa API key Anda ke provider.</p>
                                        </div>
                                    )}
                                        {userId && showTransientByokSuccess && (
                                        <div className="flex items-start gap-2">
                                            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-medium">BYOK aktif dan siap dipakai.</p>
                                                <p className="mt-1 text-xs">
                                                    Default model saat ini: {selectedByokModel.name}
                                                    {validatedAtLabel ? ` • terakhir divalidasi ${validatedAtLabel}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {userId && byokValidationState === 'invalid' && (
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-medium">BYOK belum aktif.</p>
                                                <p className="mt-1 text-xs">{byokError || 'Tambahkan key lalu validasi untuk mulai memakai BYOK.'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}

                                {hasValidatedByok && (
                                    <div className="mt-5 border-t border-zinc-200 pt-5">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Model AI</p>
                                            </div>
                                            <div className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-500">{byokVisibleModelIds.length}/3</div>
                                        </div>
                                        {byokModels.length > 0 ? (
                                            <div className="space-y-2">
                                                {byokModels.map((model) => {
                                                    const isSelected = byokVisibleModelIds.includes(model.id);
                                                    return (
                                                        <button
                                                            key={model.id}
                                                            type="button"
                                                            onClick={() => toggleByokVisibleModel(model.id)}
                                                            className={`flex w-full items-start justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-all ${isSelected ? 'border-blue-500 bg-white shadow-[0_0_0_1px_rgba(59,130,246,0.08)]' : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-zinc-900'}`}>
                                                                    {model.name}
                                                                </div>
                                                                <div className="mt-1 text-xs text-zinc-500">
                                                                    {model.description}
                                                                </div>
                                                            </div>
                                                            {isSelected && (
                                                                <div className="mt-0.5 inline-flex h-6 items-center justify-center rounded-lg border border-blue-500 bg-blue-50 px-2 text-[11px] font-semibold text-blue-700">
                                                                    Aktif
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-500">
                                                Belum ada model Gemini yang cocok terdeteksi dari key ini.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}

                        <section>
                            <label className="mb-2 block text-sm font-semibold text-gray-900">{t.aiSettingsModal.responseStyle}</label>
                            <div className="grid grid-cols-3 gap-2">
                                {responseStyleOptions.map((style) => (
                                    <button
                                        key={style.value}
                                        type="button"
                                        onClick={() => setResponseStyle(style.value)}
                                        className={`rounded-xl border p-4 text-left transition-all ${responseStyle === style.value ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}
                                    >
                                        <p className={`text-sm font-semibold ${responseStyle === style.value ? 'text-blue-700' : 'text-gray-900'}`}>{style.label}</p>
                                        <p className="mt-1 text-xs text-gray-500">{style.hint}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <label className="mb-2 block text-sm font-semibold text-gray-900">{t.aiSettingsModal.responseLanguage}</label>
                            <div className="grid grid-cols-2 gap-2">
                                {responseLanguageOptions.map((lang) => (
                                    <button
                                        key={lang.value}
                                        type="button"
                                        onClick={() => setResponseLanguage(lang.value)}
                                        className={`rounded-xl border p-4 text-left transition-all ${responseLanguage === lang.value ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white hover:bg-zinc-50'}`}
                                    >
                                        <p className={`text-sm font-semibold ${responseLanguage === lang.value ? 'text-blue-700' : 'text-gray-900'}`}>{lang.label}</p>
                                        <p className="mt-1 text-xs text-gray-500">{lang.hint}</p>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <label className="mb-2 block text-sm font-semibold text-gray-900">{t.aiSettingsModal.yourName}</label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder={t.aiSettingsModal.yourNamePlaceholder}
                            />
                        </section>

                        <section className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <div>
                                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                                    <Globe size={16} className={allowWebSearch ? 'text-blue-500' : 'text-gray-400'} />
                                    Aktifkan Web Search Otomatis
                                </h3>
                                <p className="mt-1 text-xs text-gray-500">Setiap membuat Canvas AI baru, fitur penelusuran internet langsung menyala.</p>
                            </div>
                            <button onClick={() => setAllowWebSearch(!allowWebSearch)} className={`relative inline-flex h-6 w-11 rounded-full border-2 border-transparent ${allowWebSearch ? 'bg-blue-600' : 'bg-gray-200'}`} role="switch" aria-checked={allowWebSearch}>
                                <span aria-hidden="true" className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${allowWebSearch ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </section>

                        <section>
                            <label className="mb-2 block text-sm font-semibold text-gray-900">{t.aiSettingsModal.customInstructions}</label>
                            <textarea
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                rows={4}
                                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                placeholder={t.aiSettingsModal.customInstructionsPlaceholder}
                            />
                        </section>
                    </div>

                    <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
                        <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100">{t.common.cancel}</button>
                        <button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70">{isSaving ? t.common.saving : t.aiSettingsModal.savePreferences}</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
