'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from '@/lib/accountDeletion';
import { useTranslation } from '@/lib/i18n';
import { getScheduledDeletionDate } from '@/lib/authState';
import { supabase } from '@/lib/supabase';
import { getResetPasswordUrl } from '@/lib/authUrls';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useCreditStore } from '@/store/useCreditStore';
import { useMindStore } from '@/store/useMindStore';
import { useAISettingsStore } from '@/store/useAISettingsStore';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SaveStatus = 'idle' | 'success' | 'error';
type ResetStatus = 'idle' | 'confirm' | 'sending' | 'sent' | 'error';
type DeleteStatus = 'idle' | 'confirm' | 'scheduling' | 'error';

const tierLabelMap = {
    free: 'Free',
    plus: 'Plus',
    pro: 'Pro',
    'api-pro': 'API Pro',
    enterprise: 'Enterprise',
} as const;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    return fallback;
};

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { t, language, setLanguage } = useTranslation();
    const { userId } = useWorkspaceStore();
    const currentTier = useCreditStore(state => state.currentTier);
    const initializeCredits = useCreditStore(state => state.initializeCredits);
    const clearCustomApiKey = useAISettingsStore(state => state.clearCustomApiKey);

    const [authUser, setAuthUser] = useState<User | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [resetStatus, setResetStatus] = useState<ResetStatus>('idle');
    const [resetMessage, setResetMessage] = useState<string | null>(null);
    const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>('idle');
    const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
    const [deletePassword, setDeletePassword] = useState('');

    useEffect(() => {
        if (!isOpen || !userId) return;

        let cancelled = false;

        const loadProfile = async () => {
            await initializeCredits();

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (cancelled) return;

            setAuthUser(user);
            setEmail(user?.email ?? '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', userId)
                .single();

            if (cancelled) return;

            if (profile?.full_name) {
                setName(profile.full_name);
            } else if (user?.user_metadata?.full_name) {
                setName(user.user_metadata.full_name);
            } else if (user?.email) {
                setName(user.email.split('@')[0]);
            } else {
                setName('');
            }

            setSaveStatus('idle');
            setResetStatus('idle');
            setResetMessage(null);
            setDeleteStatus('idle');
            setDeleteMessage(null);
            setDeletePassword('');
        };

        void loadProfile();

        return () => {
            cancelled = true;
        };
    }, [initializeCredits, isOpen, userId]);

    const initials = name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : '?');
    const avatarColors = ['bg-pink-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400'];
    const colorIndex = name ? name.charCodeAt(0) % avatarColors.length : 0;
    const avatarColor = avatarColors[colorIndex];

    const authProviders = useMemo(() => {
        const providers = Array.from(
            new Set((authUser?.identities ?? []).map((identity) => identity.provider).filter(Boolean))
        );

        if (providers.length === 0) return ['email'];
        return providers;
    }, [authUser]);

    const loginMethodLabel = useMemo(() => {
        const hasGoogle = authProviders.includes('google');
        const hasEmail = authProviders.includes('email');

        if (hasGoogle && hasEmail) return 'Google + Email & Password';
        if (hasGoogle) return 'Google';
        return 'Email & Password';
    }, [authProviders]);

    const passwordActionLabel = authProviders.includes('email') ? 'Ganti Kata Sandi' : 'Buat Kata Sandi';
    const planLabel = tierLabelMap[currentTier] ?? 'Free';
    const scheduledDeletionDate = getScheduledDeletionDate(authUser);
    const canSubmitDeletion = !authProviders.includes('email') || deletePassword.trim().length > 0;

    const handleSave = async () => {
        if (!userId) return;

        setIsSaving(true);
        setSaveStatus('idle');

        try {
            const trimmedName = name.trim();

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: trimmedName,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);

            if (profileError) throw profileError;

            await supabase.auth.updateUser({
                data: { full_name: trimmedName },
            });

            setSaveStatus('success');
        } catch (err) {
            console.error('[Profile] Save error:', err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendResetLink = async () => {
        if (!email) {
            setResetStatus('error');
            setResetMessage('Email akun belum tersedia. Coba tutup modal lalu buka lagi.');
            return;
        }

        setResetStatus('sending');
        setResetMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getResetPasswordUrl(),
            });

            if (error) throw error;

            setResetStatus('sent');
            setResetMessage(`Link ganti kata sandi sudah dikirim ke ${email}.`);
        } catch (error: unknown) {
            setResetStatus('error');
            setResetMessage(getErrorMessage(error, 'Kami belum berhasil mengirim email reset. Coba lagi sebentar lagi.'));
        }
    };

    const clearLocalAccountState = async () => {
        if (typeof window !== 'undefined') {
            const keysToRemove = [
                'spatial-ai-workspaces',
                'spatial-ai-active-workspace',
                'paapan-credits',
                'paapan-tier',
                'paapan-toolbar-tour-completed',
            ];

            keysToRemove.forEach((key) => window.localStorage.removeItem(key));
        }

        clearCustomApiKey();

        useMindStore.setState({
            nodes: [],
            edges: [],
            frames: [],
            selectedFrameId: null,
            strokes: [],
            arrows: [],
            strokeHistory: [],
            strokeFuture: [],
            pendingViewport: null,
            highlightedEdgeId: null,
            guestLimitReason: null,
        });

        useWorkspaceStore.setState({
            workspaces: [],
            activeWorkspaceId: null,
            isLoaded: false,
            userId: null,
            isLoading: false,
        });

        try {
            await supabase.auth.signOut();
        } catch {
            // Local cleanup is more important here than surfacing sign-out failures
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteStatus('scheduling');
        setDeleteMessage(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('Sesi Anda sudah tidak valid. Silakan login lagi lalu coba ulang.');
            }

            const response = await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: authProviders.includes('email') ? deletePassword : undefined,
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(
                    typeof payload.error === 'string'
                        ? payload.error
                        : 'Kami belum berhasil menjadwalkan penghapusan akun Anda. Coba lagi sebentar lagi.'
                );
            }

            await clearLocalAccountState();
            onClose();
            const deleteAfterParam =
                typeof payload.deleteAfter === 'string'
                    ? `&delete_after=${encodeURIComponent(payload.deleteAfter)}`
                    : '';
            window.location.replace(`/login?deletion_scheduled=1${deleteAfterParam}`);
        } catch (error: unknown) {
            setDeleteStatus('error');
            setDeleteMessage(getErrorMessage(error, 'Kami belum berhasil menjadwalkan penghapusan akun Anda. Coba lagi sebentar lagi.'));
        }
    };

    const startDeleteScheduling = () => {
        setDeleteMessage(null);
        setDeletePassword('');
        setDeleteStatus('confirm');
    };

    const cancelDeleteScheduling = () => {
        setDeleteMessage(null);
        setDeletePassword('');
        setDeleteStatus('idle');
    };

    const statusBanner = saveStatus === 'success'
        ? { tone: 'emerald', text: 'Profil berhasil disimpan.' }
        : saveStatus === 'error'
            ? { tone: 'red', text: 'Gagal menyimpan profil. Silakan coba lagi.' }
            : resetStatus === 'error'
                    ? { tone: 'red', text: resetMessage ?? 'Kami belum berhasil mengirim email reset.' }
                    : deleteStatus === 'error'
                        ? { tone: 'red', text: deleteMessage ?? 'Kami belum berhasil menjadwalkan penghapusan akun.' }
                        : scheduledDeletionDate
                            ? {
                                tone: 'amber',
                                text: `Akun ini sudah dijadwalkan untuk dihapus pada ${new Date(scheduledDeletionDate).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}.`,
                            }
                            : null;

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/28 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[640px] p-3 bg-zinc-100 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full max-h-[85vh] overflow-y-auto bg-white rounded-[20px] p-8 relative overflow-hidden">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Profil</h2>
                    </div>

                    <div className="flex items-center gap-5 mb-7 pb-7 border-b border-gray-100">
                        <div className={`w-20 h-20 rounded-full ${avatarColor} flex items-center justify-center shrink-0`}>
                            <span className="text-white text-2xl font-bold">{initials}</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">{name || 'Pengguna'}</h3>
                            <p className="text-sm text-gray-500 mt-0.5 truncate">{email || 'Belum ada email'}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {loginMethodLabel}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                                    Paket {planLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {statusBanner && (
                        <div
                            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                                statusBanner.tone === 'emerald'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : statusBanner.tone === 'blue'
                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                        : statusBanner.tone === 'amber'
                                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                                        : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                        >
                            {statusBanner.text}
                        </div>
                    )}

                    <div className="space-y-7">
                        <section className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t.profileModal.fullName}
                                </label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-gray-50 border-0 rounded-xl py-3 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                        placeholder={t.profileModal.namePlaceholder}
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="border-t border-gray-100 pt-7">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Bahasa</p>
                                    </div>
                                    <select
                                        className="bg-white border border-gray-200 rounded-xl py-2.5 px-4 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
                                    >
                                        <option value="id">Bahasa Indonesia</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <Link
                                        href="/terms"
                                        target="_blank"
                                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                    >
                                        <span>Syarat & Ketentuan</span>
                                        <span className="text-blue-600">Buka</span>
                                    </Link>
                                    <Link
                                        href="/privacy"
                                        target="_blank"
                                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                    >
                                        <span>Kebijakan Privasi</span>
                                        <span className="text-blue-600">Buka</span>
                                    </Link>
                                </div>
                            </div>
                        </section>

                        <section className="border-t border-gray-100 pt-7">
                            <div className="rounded-[24px] border border-blue-100 bg-blue-50/60 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900">Kata Sandi</h3>
                                        <p className="text-sm leading-7 text-slate-600 mt-1">
                                            {authProviders.includes('email')
                                                ? 'Kami akan kirim link reset ke email akun Anda.'
                                                : 'Tambahkan kata sandi lewat email reset.'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setResetStatus('confirm');
                                            setResetMessage(null);
                                        }}
                                        className="shrink-0 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 border border-blue-200 transition-colors hover:bg-blue-50"
                                    >
                                        {passwordActionLabel}
                                    </button>
                                </div>

                                {resetStatus !== 'idle' && (
                                    <div className="mt-5 rounded-[20px] border border-white/70 bg-white/80 p-4">
                                        {resetStatus === 'confirm' && (
                                            <>
                                                <p className="text-sm font-medium text-gray-900">Kirim link reset ke email akun Anda?</p>
                                                <p className="mt-2 text-sm leading-7 text-gray-600">
                                                    Kami akan mengirim link aman ke <span className="font-semibold text-gray-900">{email}</span>.
                                                </p>
                                                <div className="mt-4 flex flex-wrap gap-3">
                                                    <button
                                                        onClick={handleSendResetLink}
                                                        className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                                                    >
                                                        Kirim Link Reset
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setResetStatus('idle');
                                                            setResetMessage(null);
                                                        }}
                                                        className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                                    >
                                                        Batal
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {resetStatus === 'sending' && (
                                            <p className="text-sm font-medium text-gray-700">Mengirim link reset ke email Anda...</p>
                                        )}

                                        {resetStatus === 'sent' && (
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Cek email Anda</p>
                                                    <p className="mt-1 text-sm leading-7 text-gray-600">{resetMessage}</p>
                                                </div>
                                            </div>
                                        )}

                                        {resetStatus === 'error' && resetMessage && (
                                            <p className="text-sm leading-7 text-red-600">{resetMessage}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="border-t border-gray-100 pt-7">
                            <h3 className="text-base font-semibold text-red-600 mb-4">Zona Berbahaya</h3>
                            <div className="rounded-[24px] border border-red-100 bg-red-50/80 p-5">
                                <p className="text-sm leading-7 text-red-700">
                                    Akun akan dibekukan sekarang dan dihapus permanen setelah {ACCOUNT_DELETION_GRACE_PERIOD_DAYS} hari.
                                </p>
                                {deleteStatus === 'idle' ? (
                                    <button
                                        onClick={startDeleteScheduling}
                                        className="mt-4 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                                    >
                                        Jadwalkan Hapus Akun
                                    </button>
                                ) : (
                                    <div className="mt-4 rounded-[20px] border border-red-100 bg-white/80 p-4">
                                        <p className="text-sm font-medium text-red-900">
                                            Konfirmasi penghapusan akun
                                        </p>
                                        <p className="mt-2 text-sm leading-7 text-red-700">
                                            {authProviders.includes('email')
                                                ? 'Masukkan kata sandi Anda untuk menjadwalkan penghapusan akun dan semua data cloud Anda.'
                                                : 'Sesi login Anda akan diverifikasi sebelum akun dijadwalkan untuk dihapus.'}
                                        </p>
                                        {authProviders.includes('email') && (
                                            <div className="mt-4">
                                                <input
                                                    type="password"
                                                    value={deletePassword}
                                                    onChange={(event) => setDeletePassword(event.target.value)}
                                                    className="w-full rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-200"
                                                    placeholder="Kata sandi saat ini"
                                                />
                                            </div>
                                        )}
                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={deleteStatus === 'scheduling' || !canSubmitDeletion}
                                                className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {deleteStatus === 'scheduling'
                                                    ? 'Menjadwalkan...'
                                                    : `Hapus dalam ${ACCOUNT_DELETION_GRACE_PERIOD_DAYS} Hari`}
                                            </button>
                                            <button
                                                onClick={cancelDeleteScheduling}
                                                disabled={deleteStatus === 'scheduling'}
                                                className="rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                                            >
                                                {t.common.cancel}
                                            </button>
                                        </div>
                                        {deleteStatus === 'error' && deleteMessage && (
                                            <p className="mt-3 text-sm leading-7 text-red-600">{deleteMessage}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            disabled={deleteStatus === 'scheduling'}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || deleteStatus === 'scheduling'}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70"
                        >
                            {isSaving ? t.common.saving : t.common.save}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
