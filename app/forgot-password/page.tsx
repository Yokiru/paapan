'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
            });

            if (resetError) throw resetError;

            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Reset password error:', err);
            setError(err.message || 'Terjadi kesalahan');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <AuthLayout
                title={t.auth.checkEmail}
                subtitle={t.auth.resetSent}
                footer={
                    <>
                        <Link href="/login" className="font-bold text-gray-900 hover:underline">
                            ← {t.auth.backToLogin}
                        </Link>
                    </>
                }
            >
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                        Link reset password telah dikirim ke:
                    </p>
                    <p className="text-sm font-bold text-gray-900 mb-4">{email}</p>
                    <p className="text-sm text-gray-500 mb-4">
                        {t.auth.checkSpam}
                    </p>
                    <button
                        onClick={() => setIsSubmitted(false)}
                        className="text-sm font-bold text-blue-600 hover:underline"
                    >
                        {t.auth.tryAnotherEmail}
                    </button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={t.auth.forgotPassword}
            subtitle={t.auth.forgotSubtitle}
            footer={
                <>
                    <Link href="/login" className="font-bold text-gray-900 hover:underline">
                        ← {t.auth.backToLogin}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="w-full">
                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                        {error}
                    </div>
                )}

                <AuthInput
                    type="email"
                    placeholder={t.auth.email}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    }
                />

                <div className="mt-2">
                    <AuthButton type="submit" disabled={isLoading}>
                        {isLoading ? t.common.loading : t.auth.sendResetLink}
                    </AuthButton>
                </div>
            </form>
        </AuthLayout>
    );
}
