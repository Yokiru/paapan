'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Copy, Clipboard, CopyPlus, Trash2, Scissors } from 'lucide-react';

interface ContextMenuAction {
    label: string;
    icon: React.ReactNode;
    shortcut?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    dividerAfter?: boolean;
}

interface CanvasContextMenuProps {
    x: number;
    y: number;
    isOpen: boolean;
    onClose: () => void;
    hasSelection: boolean;
    hasClipboard: boolean;
    onCopy: () => void;
    onCut: () => void;
    onPaste: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export default function CanvasContextMenu({
    x,
    y,
    isOpen,
    onClose,
    hasSelection,
    hasClipboard,
    onCopy,
    onCut,
    onPaste,
    onDuplicate,
    onDelete,
}: CanvasContextMenuProps) {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside or Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        // Small delay to prevent immediate close from the same right-click event
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Adjust position to keep menu within viewport
    useEffect(() => {
        if (!isOpen || !menuRef.current) return;
        const menu = menuRef.current;
        const rect = menu.getBoundingClientRect();
        const padding = 8;

        if (rect.right > window.innerWidth - padding) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight - padding) {
            menu.style.top = `${y - rect.height}px`;
        }
    }, [isOpen, x, y]);

    if (!isOpen) return null;

    const actions: ContextMenuAction[] = [
        {
            label: 'Salin',
            icon: <Copy className="w-4 h-4" />,
            shortcut: 'Ctrl+C',
            onClick: onCopy,
            disabled: !hasSelection,
        },
        {
            label: 'Potong',
            icon: <Scissors className="w-4 h-4" />,
            shortcut: 'Ctrl+X',
            onClick: onCut,
            disabled: !hasSelection,
        },
        {
            label: 'Tempel',
            icon: <Clipboard className="w-4 h-4" />,
            shortcut: 'Ctrl+V',
            onClick: onPaste,
            disabled: !hasClipboard,
            dividerAfter: true,
        },
        {
            label: 'Duplikat',
            icon: <CopyPlus className="w-4 h-4" />,
            shortcut: 'Ctrl+D',
            onClick: onDuplicate,
            disabled: !hasSelection,
            dividerAfter: true,
        },
        {
            label: 'Hapus',
            icon: <Trash2 className="w-4 h-4" />,
            shortcut: 'Del',
            onClick: onDelete,
            disabled: !hasSelection,
            danger: true,
        },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-150"
            style={{ left: x, top: y }}
        >
            <div className="bg-white/98 backdrop-blur-xl rounded-xl shadow-[0_8px_40px_rgb(0,0,0,0.12)] border border-gray-200/60 py-1.5 min-w-[200px] overflow-hidden">
                {actions.map((action, index) => (
                    <React.Fragment key={index}>
                        <button
                            onClick={() => {
                                action.onClick();
                                onClose();
                            }}
                            disabled={action.disabled}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                                ${action.disabled
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : action.danger
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                }
                            `}
                        >
                            <span className={action.disabled ? 'opacity-30' : ''}>
                                {action.icon}
                            </span>
                            <span className="flex-1 text-left font-medium">{action.label}</span>
                            {action.shortcut && (
                                <span className={`text-xs ${action.disabled ? 'text-gray-200' : 'text-gray-400'}`}>
                                    {action.shortcut}
                                </span>
                            )}
                        </button>
                        {action.dividerAfter && (
                            <div className="my-1 border-t border-gray-100" />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
