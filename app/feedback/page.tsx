'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MessageSquare, Send, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FeedbackCategory = 'bug' | 'suggestion' | 'question';
type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const categoryOptions: Array<{ value: FeedbackCategory; label: string; hint: string }> = [
    { value: 'bug', label: 'Bug', hint: 'Ada error atau perilaku yang tidak semestinya.' },
    { value: 'suggestion', label: 'Saran', hint: 'Ada ide perbaikan atau fitur baru.' },
    { value: 'question', label: 'Pertanyaan', hint: 'Ada hal yang ingin ditanyakan ke tim.' },
];

export default function FeedbackPage() {
    const [category, setCategory] = useState<FeedbackCategory>('bug');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);
    const [isGuest, setIsGuest] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            setContactEmail(user?.email ?? '');
            setIsGuest(!user);
        };

        void loadUser();
    }, []);

    const selectedCategory = useMemo(
        () => categoryOptions.find((option) => option.value === category) ?? categoryOptions[0],
        [category]
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!subject.trim()) {
            setSubmitState('error');
            setSubmitMessage('Tulis subjek/judul feedback dulu ya.');
            return;
        }

        if (!message.trim()) {
            setSubmitState('error');
            setSubmitMessage('Tulis feedback Anda dulu sebelum dikirim.');
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

    return (
        <div className="min-h-screen bg-zinc-100">
            <div className="px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-5xl rounded-[28px] bg-zinc-200 p-2.5">
                    <div className="overflow-hidden rounded-[24px] bg-white">
                        <div className="border-b border-zinc-100 px-6 py-6 sm:px-8 sm:py-7">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                            >
                                <ArrowLeft size={18} />
                                <span>Kembali</span>
                            </Link>

                            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="max-w-2xl">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                        <MessageSquare size={14} />
                                        Feedback
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                                        Bantu kami merapikan Paapan.
                                    </h1>
                                    <p className="mt-3 text-sm leading-6 text-zinc-500 sm:text-base">
                                        Kirim bug, saran, atau pertanyaan. Masukan Anda akan masuk ke tim
                                        Paapan dan membantu kami memutuskan apa yang perlu dibenahi lebih
                                        dulu.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:min-w-[280px]">
                                    <div className="flex items-center gap-2 text-zinc-700">
                                        <Sparkles size={16} />
                                        <span className="text-sm font-semibold">Butuh jalur cepat?</span>
                                    </div>
                                    <div className="mt-2 flex flex-col items-start gap-1">
                                        <a
                                            href="mailto:hello@paapan.com?subject=Feedback%20Paapan"
                                            className="inline-flex text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                                        >
                                            hello@paapan.com
                                        </a>
                                        <a
                                            href="https://wa.me/62895360148909?text=Halo%20tim%20Paapan!%20Saya%20ingin%20memberikan%20feedback."
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                                        >
                                            WhatsApp
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-6 sm:px-8 sm:py-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
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
                                                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-3 text-sm text-zinc-500">{selectedCategory.hint}</p>
                                </section>

                                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                                    <label className="mb-2 block text-sm font-semibold text-zinc-900">
                                        Subjek / Judul
                                    </label>
                                    <input
                                        type="text"
                                        value={subject}
                                        onChange={(event) => setSubject(event.target.value)}
                                        maxLength={180}
                                        placeholder="Contoh: Bug saat export gambar"
                                        className="w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white"
                                    />
                                </section>

                                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                                    <label className="mb-2 block text-sm font-semibold text-zinc-900">
                                        Ceritakan feedback Anda
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(event) => setMessage(event.target.value)}
                                        rows={8}
                                        placeholder="Tulis apa yang terjadi, ide yang Anda punya, atau pertanyaan yang ingin ditanyakan."
                                        className="w-full rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white"
                                    />
                                </section>

                                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                                    <label className="mb-2 block text-sm font-semibold text-zinc-900">
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
                                                ? 'border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-300 focus:bg-white'
                                                : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                                        }`}
                                    />
                                    <p className="mt-2 text-xs text-zinc-500">
                                        {isGuest
                                            ? 'Opsional, tapi akan membantu jika tim perlu membalas.'
                                            : 'Dipakai dari akun yang sedang Anda gunakan.'}
                                    </p>
                                </section>

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

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <a
                                        href="https://wa.me/62895360148909?text=Halo%20tim%20Paapan!%20Saya%20ingin%20memberikan%20feedback."
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-700"
                                    >
                                        Atau lanjut via WhatsApp
                                    </a>

                                    <button
                                        type="submit"
                                        disabled={submitState === 'submitting'}
                                        className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Send size={16} />
                                        <span>{submitState === 'submitting' ? 'Mengirim...' : 'Kirim Feedback'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
