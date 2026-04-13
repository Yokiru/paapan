'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';
import { supabase } from '@/lib/supabase';

type ResetViewState = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState<ResetViewState>('checking');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        const resolveSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!active) return;

            if (session) {
                setViewState('ready');
            }
        };

        void resolveSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!active) return;

            if (session) {
                setViewState('ready');
            }
        });

        const timeout = window.setTimeout(() => {
            if (active) {
                setViewState((current) => (current === 'checking' ? 'invalid' : current));
            }
        }, 1800);

        return () => {
            active = false;
            subscription.unsubscribe();
            window.clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Konfirmasi kata sandi belum cocok.');
            return;
        }

        if (password.length < 6) {
            setError('Kata sandi baru minimal 6 karakter.');
            return;
        }

        setIsLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password,
            });

            if (updateError) throw updateError;

            setViewState('success');
        } catch (err: any) {
            console.error('Update password error:', err);
            setError(err?.message || 'Belum berhasil memperbarui kata sandi.');
        } finally {
            setIsLoading(false);
        }
    };

    if (viewState === 'checking') {
        return (
            <AuthLayout
                title="Menyiapkan reset kata sandi"
                subtitle="Tunggu sebentar, kami sedang memverifikasi link aman Anda."
                footer={null}
            >
                <div className="py-6 text-center text-sm text-gray-500">
                    Memeriksa sesi reset...
                </div>
            </AuthLayout>
        );
    }

    if (viewState === 'invalid') {
        return (
            <AuthLayout
                title="Link reset sudah tidak berlaku"
                subtitle="Minta link baru agar Anda bisa melanjutkan dengan aman."
                footer={
                    <Link href="/login" className="font-bold text-gray-900 hover:underline">
                        Kembali ke Login
                    </Link>
                }
            >
                <div className="rounded-[22px] border border-blue-100 bg-blue-50/70 px-5 py-5 text-left">
                    <p className="text-sm leading-7 text-slate-600">
                        Link reset ini mungkin sudah dipakai, kadaluarsa, atau dibuka dari sesi yang tidak lengkap.
                    </p>
                    <div className="mt-5">
                        <Link
                            href="/forgot-password"
                            className="inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                            Minta Link Baru
                        </Link>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    if (viewState === 'success') {
        return (
            <AuthLayout
                title="Kata sandi berhasil diperbarui"
                subtitle="Sekarang Anda bisa masuk lagi ke Paapan dengan kata sandi baru."
                footer={
                    <Link href="/login" className="font-bold text-blue-600 hover:underline">
                        Lanjut ke Login
                    </Link>
                }
            >
                <div className="text-center py-4">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-sm leading-7 text-gray-500">
                        Untuk keamanan, simpan kata sandi baru Anda dan gunakan saat login berikutnya.
                    </p>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Buat kata sandi baru"
            subtitle="Masukkan kata sandi baru untuk akun Paapan Anda."
            footer={
                <Link href="/login" className="font-bold text-gray-900 hover:underline">
                    Kembali ke Login
                </Link>
            }
        >
            <form onSubmit={handleSubmit} className="w-full">
                {error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="relative">
                    <AuthInput
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Kata Sandi Baru"
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
                        placeholder="Konfirmasi Kata Sandi Baru"
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

                <div className="mt-2">
                    <AuthButton type="submit" disabled={isLoading}>
                        {isLoading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
                    </AuthButton>
                </div>
            </form>
        </AuthLayout>
    );
}
