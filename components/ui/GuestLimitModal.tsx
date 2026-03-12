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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                {/* Icon */}
                <div className="flex justify-center pt-8">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-3xl">
                        {config.emoji}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {config.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                        {config.description}
                    </p>

                    {/* Benefits List */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Keuntungan Daftar Gratis
                        </p>
                        <div className="space-y-3">
                            {['5 kredit AI gratis setiap hari', '50 node per papan', '3 papan dengan cloud sync'].map((benefit) => (
                                <div key={benefit} className="flex items-center gap-3 text-sm text-gray-700">
                                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                        <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    {benefit}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex flex-col gap-3">
                    <button
                        onClick={() => { onClose(); router.push('/register'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm"
                    >
                        <Sparkles size={16} />
                        {config.cta}
                    </button>
                    
                    <button
                        onClick={() => { onClose(); router.push('/login'); }}
                        className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                    >
                        Sudah punya akun? Masuk
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
