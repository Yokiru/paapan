'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t, language, setLanguage } = useTranslation();
    const [authUser, setAuthUser] = useState<User | null>(null);
    const [isGoogleOnly, setIsGoogleOnly] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;

        const loadAuthContext = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (cancelled) return;

            setAuthUser(user);

            const identityProviders = Array.from(
                new Set((user?.identities ?? []).map((identity) => identity.provider).filter(Boolean))
            );

            setIsGoogleOnly(identityProviders.length > 0 && identityProviders.every((provider) => provider === 'google'));
        };

        void loadAuthContext();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!passwordError && !passwordSuccess) return;

        const timeout = window.setTimeout(() => {
            setPasswordError(null);
            setPasswordSuccess(null);
        }, 3200);

        return () => window.clearTimeout(timeout);
    }, [passwordError, passwordSuccess]);

    if (!isOpen) return null;

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError(null);
        setPasswordSuccess(null);

        if (newPassword !== confirmPassword) {
            setPasswordError('Konfirmasi kata sandi baru belum cocok.');
            return;
        }

        if (newPassword.length < 6) {
            setPasswordError('Kata sandi baru minimal 6 karakter.');
            return;
        }

        if (!isGoogleOnly && currentPassword === newPassword) {
            setPasswordError('Kata sandi baru tidak boleh sama dengan kata sandi saat ini.');
            return;
        }

        setIsSaving(true);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError || !user?.email) {
                throw new Error('Sesi Anda tidak ditemukan. Silakan masuk ulang lalu coba lagi.');
            }

            if (!isGoogleOnly) {
                const { error: verifyError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword,
                });

                if (verifyError) {
                    throw new Error('Kata sandi saat ini belum benar.');
                }
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                throw updateError;
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordSuccess(
                isGoogleOnly
                    ? 'Kata sandi berhasil dibuat. Sekarang akun ini juga bisa dipakai untuk login email.'
                    : 'Kata sandi berhasil diperbarui.'
            );
        } catch (error: any) {
            const message = String(error?.message || '').toLowerCase();

            if (message.includes('new password should be different')) {
                setPasswordError('Kata sandi baru tidak boleh sama dengan kata sandi lama.');
            } else if (message.includes('password should be at least')) {
                setPasswordError('Kata sandi baru minimal 6 karakter.');
            } else if (message.includes('same as the old password')) {
                setPasswordError('Kata sandi baru tidak boleh sama dengan kata sandi lama.');
            } else {
                setPasswordError(error?.message || 'Belum berhasil memperbarui kata sandi.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-[600px] p-3 bg-zinc-100 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full bg-white rounded-[20px] p-8 relative overflow-hidden max-h-[85vh] overflow-y-auto">
                    {(passwordError || passwordSuccess) && (
                        <div className="pointer-events-none absolute inset-x-6 top-6 z-10 flex justify-end">
                            <div
                                className={`max-w-[360px] rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm transition-all ${
                                    passwordError
                                        ? 'border-red-200 bg-red-50/95 text-red-700'
                                        : 'border-emerald-200 bg-emerald-50/95 text-emerald-700'
                                }`}
                            >
                                <p className="font-medium">{passwordError || passwordSuccess}</p>
                            </div>
                        </div>
                    )}

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
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900">{t.settingsModal.title}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t.settingsModal.subtitle}</p>
                    </div>

                    {/* Change Password Section */}
                    <div className="mb-8 pb-8 border-b border-gray-100">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            {isGoogleOnly ? 'Buat Kata Sandi' : t.settingsModal.changePassword}
                        </h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {isGoogleOnly ? (
                                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                                    Akun ini terhubung lewat Google. Buat kata sandi baru kalau Anda juga ingin bisa masuk memakai email dan kata sandi.
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.settingsModal.currentPassword}</label>
                                    <input
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                        placeholder={t.settingsModal.currentPassword}
                                        required={!isGoogleOnly}
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    {isGoogleOnly ? 'Kata Sandi Baru' : t.settingsModal.newPassword}
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                    placeholder={t.settingsModal.newPassword}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.settingsModal.confirmPassword}</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                    placeholder={t.settingsModal.confirmPassword}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70"
                            >
                                {isSaving
                                    ? t.settingsModal.updatingPassword
                                    : isGoogleOnly
                                        ? 'Simpan Kata Sandi'
                                        : t.settingsModal.updatePassword}
                            </button>
                        </form>
                    </div>

                    {/* Language Section */}
                    <div className="mb-8 pb-8 border-b border-gray-100">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                            </svg>
                            {t.settingsModal.language}
                        </h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-700 font-medium">{t.settingsModal.displayLanguage}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{t.settingsModal.selectLanguage}</p>
                            </div>
                            <select
                                className="bg-gray-50 border-0 rounded-xl py-2.5 px-4 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all cursor-pointer"
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
                            >
                                <option value="en">🇺🇸 English</option>
                                <option value="id">🇮🇩 Bahasa Indonesia</option>
                            </select>
                        </div>
                    </div>

                    {/* About Section */}
                    <div className="mb-8 pb-8 border-b border-gray-100">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t.settingsModal.about}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-gray-600">{t.settingsModal.terms}</span>
                                <a href="/terms" target="_blank" className="text-sm font-medium text-blue-600 hover:underline">{t.settingsModal.view} →</a>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-gray-600">{t.settingsModal.privacy}</span>
                                <a href="/privacy" target="_blank" className="text-sm font-medium text-blue-600 hover:underline">{t.settingsModal.view} →</a>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div>
                        <h3 className="text-base font-semibold text-red-600 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {t.settingsModal.dangerZone}
                        </h3>
                        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                            <p className="text-sm text-red-700 mb-3">
                                {t.settingsModal.deleteAccountConfirm}
                            </p>
                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-xl transition-colors"
                                >
                                    {t.settingsModal.deleteAccount}
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            // Handle delete account
                                            alert(t.settingsModal.accountDeleted);
                                            onClose();
                                        }}
                                        className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                                    >
                                        {t.settingsModal.yesDelete}
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        {t.common.cancel}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
