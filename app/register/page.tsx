'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

        setIsLoading(true);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    },
                    emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            setSuccess(true);
        } catch (err: any) {
            console.error('Register error:', err);
            setError(err.message || 'Terjadi kesalahan saat mendaftar');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <AuthLayout
                title="Cek Email Anda"
                subtitle="Kami sudah mengirim link konfirmasi ke email Anda"
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
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                    >
                        Lanjut ke Login
                    </Link>
                </div>
            </AuthLayout>
        );
    }

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
                title={t.auth.createAccount}
                subtitle={t.auth.registerSubtitle}
                footer={
                    <>
                        <span className="text-gray-500">{t.auth.hasAccount} </span>
                        <Link href="/login" className="font-bold text-gray-900 hover:underline">
                            {t.auth.login}
                        </Link>
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
                        type="text"
                        placeholder={t.auth.fullName}
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        }
                    />

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

                    <div className="mt-2 mb-5">
                        <AuthButton type="submit" disabled={isLoading}>
                            {isLoading ? t.common.loading : t.auth.register}
                        </AuthButton>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                        <p className="text-sm font-medium text-slate-700">Daftar dengan Google segera hadir</p>
                        <p className="mt-1 text-xs text-slate-500">Untuk saat ini, silakan daftar dengan email dan password terlebih dahulu.</p>
                    </div>
                </form>
            </AuthLayout>
        </>
    );
}
