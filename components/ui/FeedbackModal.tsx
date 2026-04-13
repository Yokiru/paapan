'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
}

type FeedbackCategory = 'bug' | 'suggestion' | 'question';
type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const categoryOptions: Array<{ value: FeedbackCategory; label: string; hint: string }> = [
    { value: 'bug', label: 'Bug', hint: 'Ada error atau perilaku yang tidak semestinya.' },
    { value: 'suggestion', label: 'Saran', hint: 'Ada ide perbaikan atau fitur baru.' },
    { value: 'question', label: 'Pertanyaan', hint: 'Ada hal yang ingin ditanyakan ke tim.' },
];

export default function FeedbackModal({ isOpen, onClose, user }: FeedbackModalProps) {
    const [category, setCategory] = useState<FeedbackCategory>('bug');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        setCategory('bug');
        setSubject('');
        setMessage('');
        setSubmitState('idle');
        setSubmitMessage(null);
        setContactEmail(user?.email ?? '');
    }, [isOpen, user]);

    const isGuest = !user;
    const selectedCategory = useMemo(
        () => categoryOptions.find((option) => option.value === category) ?? categoryOptions[0],
        [category]
    );

    const handleClose = () => {
        if (submitState === 'submitting') return;
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!subject.trim()) {
            setSubmitState('error');
            setSubmitMessage('Tulis subjek/judul feedback dulu ya.');
            return;
        }

        if (!message.trim()) {
            setSubmitState('error');
            setSubmitMessage('Tulis dulu feedback Anda sebelum dikirim.');
            return;
        }

        setSubmitState('submitting');
        setSubmitMessage(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token
                        ? { Authorization: `Bearer ${session.access_token}` }
                        : {}),
                },
                body: JSON.stringify({
                    category,
                    subject: subject.trim(),
                    message: message.trim(),
                    email: contactEmail.trim() || undefined,
                    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
                }),
            });

            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    typeof payload.error === 'string'
                        ? payload.error
                        : 'Feedback belum berhasil dikirim. Coba lagi sebentar lagi.'
                );
            }

            if (payload?.emailSent === false) {
                setSubmitState('error');
                setSubmitMessage(
                    'Feedback tersimpan, tapi notifikasi email ke tim belum terkirim. Cek konfigurasi Zoho SMTP.'
                );
                return;
            }

            setSubmitState('success');
            setSubmitMessage('Feedback Anda sudah terkirim ke tim Paapan.');
            setSubject('');
            setMessage('');
        } catch (error: unknown) {
            setSubmitState('error');
            setSubmitMessage(
                error instanceof Error
                    ? error.message
                    : 'Feedback belum berhasil dikirim. Coba lagi sebentar lagi.'
            );
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/18 backdrop-blur-sm px-4 animate-in fade-in duration-150"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-[640px] rounded-[32px] border border-white/50 bg-zinc-100 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)] animate-in zoom-in-95 duration-150"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="rounded-[22px] border border-white/60 bg-white/92 px-6 py-6 sm:px-7">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                                Feedback
                            </p>
                            <h2 className="mt-2 text-[30px] font-bold leading-tight text-slate-950">
                                Bantu kami merapikan Paapan
                            </h2>
                            <p className="mt-2 text-sm leading-7 text-slate-500">
                                Masukan Anda akan dikirim ke tim Paapan. Untuk bantuan cepat, Anda juga
                                bisa lanjut lewat WhatsApp.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Tutup feedback"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                        <div className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4">
                            <div className="flex flex-wrap gap-2">
                                {categoryOptions.map((option) => {
                                    const isActive = option.value === category;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setCategory(option.value)}
                                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                                isActive
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                                                    : 'bg-white text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-3 text-sm text-slate-500">{selectedCategory.hint}</p>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-900">
                                Subjek / Judul
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(event) => setSubject(event.target.value)}
                                maxLength={180}
                                placeholder="Contoh: Bug saat export gambar"
                                className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-900">
                                Pesan
                            </label>
                            <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                rows={6}
                                placeholder="Ceritakan apa yang Anda alami, ide yang Anda punya, atau hal yang ingin ditanyakan."
                                className="w-full rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-900">
                                Email kontak
                            </label>
                            <input
                                type="email"
                                value={contactEmail}
                                onChange={(event) => setContactEmail(event.target.value)}
                                readOnly={!isGuest}
                                placeholder="Email untuk kami hubungi balik"
                                className={`w-full rounded-[18px] border px-4 py-3 text-sm outline-none transition-colors ${
                                    isGuest
                                        ? 'border-zinc-200 bg-zinc-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white'
                                        : 'border-zinc-200 bg-zinc-50 text-slate-600'
                                }`}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                {isGuest
                                    ? 'Opsional, tapi akan membantu jika tim perlu membalas.'
                                    : 'Dipakai dari akun yang sedang Anda gunakan.'}
                            </p>
                        </div>

                        {submitMessage && (
                            <div
                                className={`rounded-[18px] border px-4 py-3 text-sm ${
                                    submitState === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : submitState === 'error'
                                            ? 'border-red-200 bg-red-50 text-red-600'
                                            : 'border-blue-200 bg-blue-50 text-blue-700'
                                }`}
                            >
                                {submitMessage}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <a
                                href="https://wa.me/62895360148909?text=Halo%20tim%20Paapan!%20Saya%20ingin%20memberikan%20feedback."
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700"
                            >
                                Atau lanjut via WhatsApp
                            </a>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="rounded-[18px] border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitState === 'submitting'}
                                    className="rounded-[18px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitState === 'submitting' ? 'Mengirim...' : 'Kirim Feedback'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    );
}
