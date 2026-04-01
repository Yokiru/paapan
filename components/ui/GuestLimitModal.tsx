'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GuestLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'ai' | 'node' | 'workspace';
}

const REASON_CONFIG = {
    ai: {
        title: 'Lanjutkan dengan akun gratis',
        description: 'Kredit AI tamu untuk sesi ini sudah habis. Buat akun gratis untuk melanjutkan dan simpan progresmu dengan lebih aman.',
        cta: 'Daftar Gratis',
    },
    node: {
        title: 'Lanjutkan dengan akun gratis',
        description: 'Ruang tamu kamu sudah mencapai batas node. Buat akun gratis untuk menambah isi papan dan menyimpan semuanya ke cloud.',
        cta: 'Daftar Gratis',
    },
    workspace: {
        title: 'Lanjutkan dengan akun gratis',
        description: 'Batas papan untuk mode tamu sudah tercapai. Buat akun gratis supaya kamu bisa membuat lebih banyak papan dan menyimpannya di cloud.',
        cta: 'Daftar Gratis',
    },
} as const;

const BENEFITS = [
    '5 kredit AI gratis setiap hari',
    'Hingga 50 node per papan',
    '3 papan dengan cloud sync',
];

export function GuestLimitModal({ isOpen, onClose, reason = 'ai' }: GuestLimitModalProps) {
    const router = useRouter();
    const config = REASON_CONFIG[reason];

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/18 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-[580px] rounded-[32px] bg-zinc-100/95 p-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative rounded-[22px] border border-zinc-200/65 bg-[linear-gradient(180deg,#7FB5EE_0%,#6E9CCF_36%,#8DB9ED_72%,#F6FAFF_100%)] p-6">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-xl p-2 transition-colors hover:bg-zinc-100/55"
                    >
                        <X size={20} className="text-slate-500/75" />
                    </button>

                    <div className="mx-auto max-w-[452px] text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700/80">
                            Mode Tamu
                        </p>
                        <h3 className="mt-3 text-[28px] font-bold tracking-tight text-slate-950">
                            {config.title}
                        </h3>
                        <p className="mt-3 text-[15px] leading-6 text-slate-800/82">
                            {config.description}
                        </p>

                        <div className="mt-5 rounded-2xl border border-zinc-200/70 bg-white/78 p-4 text-left shadow-[0_10px_24px_rgba(43,80,128,0.06)]">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                                Yang kamu dapat
                            </p>
                            <div className="mt-4 space-y-3">
                                {BENEFITS.map((benefit) => (
                                    <div key={benefit} className="flex items-center gap-3 text-[15px] font-medium text-slate-700">
                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blue-100/90 bg-blue-50 text-blue-600">
                                            <Check size={14} />
                                        </div>
                                        <span>{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    router.push('/register');
                                }}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                            >
                                <span>{config.cta}</span>
                                <ArrowRight size={16} />
                            </button>

                            <button
                                onClick={() => {
                                    onClose();
                                    router.push('/login');
                                }}
                                className="w-full rounded-2xl border border-zinc-200/70 bg-white/78 px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-white/88 hover:text-slate-950"
                            >
                                Sudah punya akun? Masuk
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
