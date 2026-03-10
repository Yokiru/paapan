'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GuestLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    reason?: 'ai' | 'node' | 'workspace';
}

const REASON_CONFIG = {
    ai: {
        emoji: '🤖',
        title: 'Kredit AI Habis',
        description: 'Kamu sudah menggunakan 3 pertanyaan AI gratis. Daftar sekarang untuk mendapatkan 5 kredit AI setiap hari — gratis!',
        cta: 'Daftar Gratis, Dapat 5 Kredit/Hari',
    },
    node: {
        emoji: '📌',
        title: 'Batas Node Tercapai',
        description: 'Sebagai tamu, kamu bisa membuat hingga 10 node. Login atau daftar gratis untuk menambah hingga 50 node!',
        cta: 'Daftar Gratis, Dapat 50 Node',
    },
    workspace: {
        emoji: '📋',
        title: 'Batas Papan Tercapai',
        description: 'Sebagai tamu, kamu hanya bisa punya 1 papan. Daftar gratis untuk membuat hingga 3 papan dengan sinkronisasi cloud!',
        cta: 'Daftar Gratis, Dapat 3 Papan',
    },
};

export function GuestLimitModal({ isOpen, onClose, reason = 'ai' }: GuestLimitModalProps) {
    const router = useRouter();
    const config = REASON_CONFIG[reason];

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header gradient */}
                <div className="relative bg-gradient-to-br from-violet-500 to-indigo-600 px-6 pt-8 pb-10 text-center">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                    <div className="text-4xl mb-3">{config.emoji}</div>
                    <h3 className="text-lg font-bold text-white">{config.title}</h3>
                </div>

                {/* Content */}
                <div className="-mt-5 bg-white rounded-t-2xl px-6 pt-5 pb-6">
                    <p className="text-sm text-zinc-500 text-center leading-relaxed mb-5">
                        {config.description}
                    </p>

                    {/* Benefits */}
                    <div className="space-y-2 mb-5">
                        {['5 kredit AI gratis setiap hari', '50 node per papan', '3 papan dengan cloud sync'].map((benefit) => (
                            <div key={benefit} className="flex items-center gap-2 text-sm text-zinc-600">
                                <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                {benefit}
                            </div>
                        ))}
                    </div>

                    {/* CTA Buttons */}
                    <button
                        onClick={() => { onClose(); router.push('/register'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-indigo-200"
                    >
                        <Sparkles size={15} />
                        {config.cta}
                    </button>

                    <button
                        onClick={() => { onClose(); router.push('/login'); }}
                        className="w-full mt-2 py-2.5 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        Sudah punya akun? Masuk
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
