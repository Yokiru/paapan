'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import AuthTransitionLink from '@/components/auth/AuthTransitionLink';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { getAuthCallbackUrl } from '@/lib/authUrls';

function getFriendlyRegisterError(message?: string | null) {
    const normalized = message?.toLowerCase().trim() || '';

    if (!normalized) {
        return 'Belum berhasil membuat akun. Coba lagi sebentar lagi.';
    }

    if (normalized.includes('email rate limit exceeded') || normalized.includes('rate limit')) {
        return 'Permintaan email sedang terlalu sering. Tunggu sebentar lalu coba daftar lagi.';
    }

    if (normalized.includes('user already registered') || normalized.includes('already registered')) {
        return 'Email ini sudah terdaftar. Coba masuk atau gunakan email lain.';
    }

    if (normalized.includes('invalid email')) {
        return 'Format email belum benar. Coba periksa lagi alamat email Anda.';
    }

    if (normalized.includes('password')) {
        return 'Kata sandi belum memenuhi syarat. Gunakan minimal 6 karakter.';
    }

    return 'Belum berhasil membuat akun. Coba lagi sebentar lagi.';
}

export default function RegisterPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const termsVersion = '2026-04-14';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [acceptsMarketingEmails, setAcceptsMarketingEmails] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

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

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Password tidak cocok');
            return;
        }

        if (password.length < 6) {
            setError('Password minimal 6 karakter');
            return;
        }

        if (!hasAcceptedTerms) {
            setError('Silakan setujui Syarat Layanan dan Kebijakan Privasi terlebih dahulu.');
            return;
        }

        setIsLoading(true);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: getAuthCallbackUrl('/welcome'),
                    data: {
                        terms_accepted: true,
                        terms_accepted_at: new Date().toISOString(),
                        terms_version: termsVersion,
                        marketing_opt_in: acceptsMarketingEmails,
                    },
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            setSuccess(true);
        } catch (err: unknown) {
            console.error('Register error:', err);
            setError(getFriendlyRegisterError(err instanceof Error ? err.message : null));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        setError(null);
        if (!hasAcceptedTerms) {
            setError('Silakan setujui Syarat Layanan dan Kebijakan Privasi terlebih dahulu.');
            return;
        }

        setIsLoading(true);

        try {
            const oauthRedirect = `${getAuthCallbackUrl('/welcome')}&terms_accepted=1&terms_version=${encodeURIComponent(termsVersion)}&marketing_opt_in=${acceptsMarketingEmails ? '1' : '0'}`;

            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: oauthRedirect,
                },
            });

            if (oauthError) {
                throw oauthError;
            }
        } catch (err: unknown) {
            console.error('Google register error:', err);
            setError(getFriendlyRegisterError(err instanceof Error ? err.message : null));
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <AuthLayout
                title="Cek Email Anda"
                subtitle="Kami sudah mengirim link konfirmasi ke email Anda"
                backgroundClassName="bg-[linear-gradient(180deg,#4D77A8_0%,#5D8DC3_42%,#7FB5F1_78%,#FCFEFF_100%)]"
            >
                <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-gray-600 mb-6">
                        Silakan cek inbox email <strong>{email}</strong> lalu klik link konfirmasi untuk mengaktifkan akun. Setelah itu Anda bisa masuk dan langsung mulai memakai Paapan.
                    </p>
                    <AuthTransitionLink
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                    >
                        Lanjut ke Login
                    </AuthTransitionLink>
                </div>
            </AuthLayout>
        );
    }

    return (
        <>
            <div className="absolute top-6 left-6 z-50">
                <AuthTransitionLink
                    href="/"
                    className="auth-back-button flex items-center justify-center w-10 h-10 bg-white/80 backdrop-blur-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 shadow-sm transition-all"
                    title="Kembali ke Aplikasi"
                    style={{ viewTransitionName: 'auth-back' }}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </AuthTransitionLink>
            </div>

            <AuthLayout
                title={t.auth.createAccount}
                subtitle={t.auth.registerSubtitle}
                backgroundClassName="bg-[linear-gradient(180deg,#4D77A8_0%,#5D8DC3_42%,#7FB5F1_78%,#FCFEFF_100%)]"
                footer={
                    <>
                        <span className="text-slate-600">Sudah punya akun? </span>
                        <AuthTransitionLink href="/login" className="font-bold text-gray-900 hover:underline">
                            Masuk
                        </AuthTransitionLink>
                    </>
                }
            >
                <form onSubmit={handleRegister} className="w-full">
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
                            type={showPassword ? 'text' : 'password'}
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
                            className="absolute right-4 top-[18px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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

                    <div className="relative">
                        <AuthInput
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder={t.auth.confirmPassword}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            icon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            }
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-[18px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                            tabIndex={-1}
                        >
                            {showConfirmPassword ? (
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

                    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={hasAcceptedTerms}
                                onChange={(event) => setHasAcceptedTerms(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>
                                Saya menyetujui{' '}
                                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
                                    Syarat Layanan
                                </Link>{' '}
                                dan{' '}
                                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
                                    Kebijakan Privasi
                                </Link>
                                .
                            </span>
                        </label>

                        <label className="flex items-start gap-3 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={acceptsMarketingEmails}
                                onChange={(event) => setAcceptsMarketingEmails(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>Saya bersedia menerima email promo dan update Paapan.</span>
                        </label>
                    </div>

                    <div className="mt-2 mb-5">
                        <AuthButton type="submit" disabled={isLoading || !hasAcceptedTerms}>
                            {isLoading ? t.common.loading : t.auth.register}
                        </AuthButton>
                    </div>

                    <div className="mt-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        <div className="h-px flex-1 bg-slate-300" />
                        <span>Atau</span>
                        <div className="h-px flex-1 bg-slate-300" />
                    </div>

                    <div className="mt-5">
                        <button
                            type="button"
                            onClick={() => void handleGoogleRegister()}
                            disabled={isLoading || !hasAcceptedTerms}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M21.6 12.23c0-.79-.07-1.55-.2-2.27H12v4.3h5.4a4.62 4.62 0 0 1-2 3.03v2.52h3.24c1.9-1.76 2.96-4.35 2.96-7.58z" />
                                <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22z" />
                                <path fill="#FBBC05" d="M6.42 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.28.32-1.88V7.52H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.48l3.34-2.6z" />
                                <path fill="#EA4335" d="M12 6a5.43 5.43 0 0 1 3.84 1.5l2.88-2.88C16.95 2.98 14.7 2 12 2A10 10 0 0 0 3.08 7.52l3.34 2.6C7.2 7.76 9.4 6 12 6z" />
                            </svg>
                            <span>Daftar dengan Google</span>
                        </button>
                    </div>
                </form>
            </AuthLayout>
        </>
    );
}
