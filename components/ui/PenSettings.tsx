'use client';

import React from 'react';
import { useMindStore } from '@/store/useMindStore';
import { createPortal } from 'react-dom';

// Color palette
const COLORS = [
    '#1e1e1e', '#9ca3af', '#a855f7', '#3b82f6',
    '#22c55e', '#f59e0b', '#ef4444',
];

/**
 * Pen Settings Panel Component - Compact Horizontal Design
 * Similar to tldraw's style panel
 */
export default function PenSettings() {
    const {
        tool,
        penColor,
        penSize,
        setPenColor,
        setPenSize,
        clearStrokes,
        isEraser,
        setIsEraser,
        eraserSize,
        setEraserSize,
        undoStroke,
        redoStroke,
        strokeHistory,
        strokeFuture,
    } = useMindStore();

    const [showClearConfirm, setShowClearConfirm] = React.useState(false);

    if (tool !== 'pen') return null;

    return (
        <div
            className="
                fixed bottom-20 left-1/2 -translate-x-1/2 z-50
                flex items-center gap-2 px-2 py-1.5
                bg-white/98 backdrop-blur-xl
                border border-gray-100
                rounded-xl
                shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]
                animate-in slide-in-from-bottom-2 fade-in duration-200
            "
        >
            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
                <button
                    onClick={undoStroke}
                    disabled={strokeHistory.length === 0}
                    className={`p-1.5 rounded-lg transition-colors ${strokeHistory.length > 0 ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'
                        }`}
                    title="Undo"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                </button>
                <button
                    onClick={redoStroke}
                    disabled={strokeFuture.length === 0}
                    className={`p-1.5 rounded-lg transition-colors ${strokeFuture.length > 0 ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'
                        }`}
                    title="Redo"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                </button>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Pen/Eraser Toggle */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                <button
                    onClick={() => setIsEraser(false)}
                    className={`p-1.5 rounded-md transition-colors ${!isEraser ? 'bg-white shadow-sm' : ''}`}
                    title="Pen"
                >
                    <img
                        src={!isEraser ? '/icons/pen aktif.png' : '/icons/pen mati.png'}
                        alt="Pen"
                        width={16}
                        height={16}
                    />
                </button>
                <button
                    onClick={() => setIsEraser(true)}
                    className={`p-1.5 rounded-md transition-colors ${isEraser ? 'bg-white shadow-sm' : ''}`}
                    title="Eraser"
                >
                    <img
                        src={isEraser ? '/icons/eraser aktif.png' : '/icons/eraser mati.png'}
                        alt="Eraser"
                        width={16}
                        height={16}
                    />
                </button>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Colors (only for pen) */}
            {!isEraser && (
                <>
                    <div className="flex items-center gap-1">
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                onClick={() => setPenColor(color)}
                                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${penColor === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                                    }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <div className="w-px h-6 bg-gray-200" />
                </>
            )}

            {/* Size - Only show for pen mode (eraser doesn't need size) */}
            {!isEraser && (
                <>
                    <div className="flex items-center gap-1">
                        {[2, 4, 8].map((size, i) => (
                            <button
                                key={size}
                                onClick={() => setPenSize(size)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${penSize === size
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                title={`Size ${['S', 'M', 'L'][i]}`}
                            >
                                <div
                                    className="rounded-full bg-current"
                                    style={{
                                        width: [4, 6, 8][i],
                                        height: [4, 6, 8][i]
                                    }}
                                />
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 bg-gray-200" />
                </>
            )}

            {/* Clear - Only visible in eraser mode */}
            {isEraser && (
                <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title="Clear All"
                >
                    <img
                        src="/icons/clear all.png"
                        alt="Clear All"
                        width={16}
                        height={16}
                    />
                </button>
            )}

            {/* Clear All Confirmation Modal */}
            {/* Clear All Confirmation Modal - Portaled to body to escape parent transforms */}
            {showClearConfirm && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div
                        className="bg-white rounded-2xl p-5 shadow-2xl border border-gray-100 w-[320px] text-center animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                            <img
                                src="/icons/clear all.png"
                                alt="Clear All"
                                width={24}
                                height={24}
                            />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1.5">Hapus Semua?</h3>
                        <p className="text-sm text-gray-500 mb-5 leading-relaxed">Semua coretan di papan akan dihapus secara permanen.</p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    clearStrokes();
                                    setShowClearConfirm(false);
                                }}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 shadow-lg shadow-red-200 transition-all hover:shadow-red-300"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
