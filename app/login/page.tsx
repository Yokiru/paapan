'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [blockedNotice, setBlockedNotice] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const redirectIfAuthenticated = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (isMounted && session?.user) {
                router.replace('/');
            }
        };

        void redirectIfAuthenticated();

        return () => {
            isMounted = false;
        };
    }, [router]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setBlockedNotice(params.get('blocked') === '1');
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                throw signInError;
            }

            // Redirect to home on success
            router.replace('/');
        } catch (err: any) {
            console.error('Login error:', err);
            const message = String(err?.message || '');
            if (message.toLowerCase().includes('banned') || message.toLowerCase().includes('blocked')) {
                setError('Akun Anda diblokir. Hubungi tim Paapan jika ini keliru.');
            } else {
                setError(message || 'Terjadi kesalahan saat login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback?next=/`,
                },
            });

            if (oauthError) {
                throw oauthError;
            }
        } catch (err: any) {
            console.error('Google login error:', err);
            setError(err?.message || 'Terjadi kesalahan saat login dengan Google');
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="absolute top-6 left-6 z-50">
                <Link
                    href="/"
                    className="flex items-center justify-center w-10 h-10 bg-white/80 backdrop-blur-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 shadow-sm transition-all"
                    title="Kembali ke Aplikasi"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
            </div>

            <AuthLayout
                title={t.auth.welcomeBack}
                subtitle={t.auth.loginSubtitle}
                footer={
                    <>
                        <span className="text-gray-500">{t.auth.noAccount} </span>
                        <Link href="/register" className="font-bold text-gray-900 hover:underline">
                            {t.auth.register}
                        </Link>
                    </>
                }
            >
                <form onSubmit={handleLogin} className="w-full">
                    {blockedNotice && !error && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                            Akun Anda diblokir. Hubungi tim Paapan jika Anda merasa ini keliru.
                        </div>
                    )}

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

                    <div className="relative">
                        <AuthInput
                            type={showPassword ? "text" : "password"}
                            placeholder={t.auth.password}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            }
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-[22px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="flex justify-end mb-5">
                        <Link
                            href="/forgot-password"
                            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                        >
                            {t.auth.forgotPassword}
                        </Link>
                    </div>

                    <AuthButton type="submit" disabled={isLoading}>
                        {isLoading ? t.common.loading : t.auth.login}
                    </AuthButton>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={() => void handleGoogleLogin()}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M21.6 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.76 2.96-4.35 2.96-7.58z" />
                                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22z" />
                                <path fill="#FBBC05" d="M6.42 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.28.32-1.88V7.52H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.48l3.34-2.6z" />
                                <path fill="#EA4335" d="M12 6a5.43 5.43 0 0 1 3.84 1.5l2.88-2.88C16.95 2.98 14.7 2 12 2A10 10 0 0 0 3.08 7.52l3.34 2.6C7.2 7.76 9.4 6 12 6z" />
                            </svg>
                            <span>Masuk dengan Google</span>
                        </button>
                    </div>
                </form>
            </AuthLayout>
        </>
    );
}
