'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = 'Ya, Hapus',
    cancelLabel = 'Batal',
    variant = 'danger',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in zoom-in-95 duration-150 flex flex-col items-center text-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                {variant === 'danger' && (
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                )}

                {/* Title */}
                <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>

                {/* Message */}
                <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{message}</p>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full">
                    <button
                        onClick={() => { onConfirm(); onCancel(); }}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm ${
                            variant === 'danger'
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                                : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                        }`}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
