'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { t } = useTranslation();
    const { userId } = useWorkspaceStore();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Load current profile data when modal opens
    useEffect(() => {
        if (isOpen && userId) {
            const loadProfile = async () => {
                // Get email from auth
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email) setEmail(user.email);

                // Get name from profiles table
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userId)
                    .single();

                if (profile?.full_name) {
                    setName(profile.full_name);
                } else if (user?.user_metadata?.full_name) {
                    setName(user.user_metadata.full_name);
                }
            };
            loadProfile();
            setSaveStatus('idle');
        }
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const initials = name ? name.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : '?');

    const handleSave = async () => {
        if (!userId) return;
        setIsSaving(true);
        setSaveStatus('idle');

        try {
            // 1. Update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: name.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (profileError) throw profileError;

            // 2. Also update auth user metadata (for consistency)
            await supabase.auth.updateUser({
                data: { full_name: name.trim() }
            });

            setSaveStatus('success');
            setTimeout(() => {
                setIsSaving(false);
                onClose();
            }, 800);
        } catch (err) {
            console.error('[Profile] Save error:', err);
            setSaveStatus('error');
            setIsSaving(false);
        }
    };

    // Color generation based on name
    const avatarColors = ['bg-pink-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400'];
    const colorIndex = name ? name.charCodeAt(0) % avatarColors.length : 0;
    const avatarColor = avatarColors[colorIndex];

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-[600px] bg-white rounded-2xl shadow-xl p-8 mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                        <h2 className="text-xl font-bold text-gray-900">{t.profileModal.title}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t.profileModal.subtitle}</p>
                    </div>

                    {/* Avatar Section */}
                    <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                        <div className="relative">
                            <div className={`w-20 h-20 rounded-full ${avatarColor} flex items-center justify-center`}>
                                <span className="text-white text-2xl font-bold">{initials}</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{name || 'User'}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{email}</p>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-5">
                        {/* Name Field */}
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

                        {/* Email Field (Readonly) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t.profileModal.email}
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    readOnly
                                    className="w-full bg-gray-100 border-0 rounded-xl py-3 pl-12 pr-4 text-sm text-gray-500 font-medium cursor-not-allowed"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5">{t.profileModal.emailHint}</p>
                        </div>
                    </div>

                    {/* Success/Error Message */}
                    {saveStatus === 'success' && (
                        <div className="mt-4 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-xl flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Profil berhasil disimpan!
                        </div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="mt-4 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-xl">
                            Gagal menyimpan profil. Silakan coba lagi.
                        </div>
                    )}

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
                            {isSaving ? (saveStatus === 'success' ? '✓' : t.common.saving) : t.common.save}
                        </button>
                    </div>
                </div>
            </div>,
        document.body
    );
}
