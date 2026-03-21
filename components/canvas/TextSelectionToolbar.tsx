"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { Copy } from 'lucide-react';
import { PastelColor } from '@/types';
import { TEXT_HIGHLIGHT_COLORS, TEXT_HIGHLIGHT_ORDER } from '@/lib/textHighlights';

type TextSelectionToolbarProps = {
    visible: boolean;
    position: { top: number; left: number };
    onHighlight: (color: PastelColor) => void;
    onCopy: () => void;
    onSelectAll: () => void;
};

const TextSelectionToolbar = ({ visible, position, onHighlight, onCopy, onSelectAll }: TextSelectionToolbarProps) => {
    if (!visible || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed z-[2000] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/98 px-3 py-2 shadow-2xl backdrop-blur-sm"
            style={{
                top: position.top,
                left: position.left,
                transform: 'translate(-50%, -100%)',
            }}
            onMouseDown={(e) => e.preventDefault()}
            data-highlight-toolbar-ignore="true"
        >
            <div className="flex items-center gap-2 pr-1">
                {TEXT_HIGHLIGHT_ORDER.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => onHighlight(color)}
                        className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                            backgroundColor: TEXT_HIGHLIGHT_COLORS[color].fill,
                            borderColor: TEXT_HIGHLIGHT_COLORS[color].ring,
                        }}
                        title={TEXT_HIGHLIGHT_COLORS[color].label}
                    />
                ))}
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
                type="button"
                onClick={onCopy}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                title="Copy selected text"
            >
                <Copy size={15} />
                <span>Copy</span>
            </button>

            <button
                type="button"
                onClick={onSelectAll}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                title="Select all text"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 9h8M8 13h8M8 17h5" />
                </svg>
                <span>Select all</span>
            </button>
        </div>,
        document.body,
    );
};

export default TextSelectionToolbar;
