"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, Copy, Link2, Trash2 } from 'lucide-react';
import { PastelColor, TextNodeData } from '@/types';
import { TEXT_HIGHLIGHT_COLORS, TEXT_HIGHLIGHT_ORDER } from '@/lib/textHighlights';
import { sanitizeTextLinkUrl } from '@/lib/textLinkUrl';

type BaseProps = {
    visible: boolean;
    position: { top: number; left: number };
};

type LegacyToolbarProps = BaseProps & {
    variant?: 'legacy';
    onHighlight: (color: PastelColor) => void;
    onCopy: () => void;
    onSelectAll: () => void;
};

type RichToolbarProps = BaseProps & {
    variant: 'rich';
    activeStyles: {
        bold: boolean;
        italic: boolean;
        underline: boolean;
        fontSize: TextNodeData['fontSize'];
        textAlign: TextNodeData['textAlign'];
        linkHref: string;
    };
    onToggleBold: () => void;
    onToggleItalic: () => void;
    onToggleUnderline: () => void;
    onFontSizeChange: (fontSize: TextNodeData['fontSize']) => void;
    onTextAlignChange: (textAlign: TextNodeData['textAlign']) => void;
    onHighlight: (color: PastelColor) => void;
    onSetLink: (href: string) => void;
    onRemoveLink: () => void;
    onPopoverOpenChange?: (isOpen: boolean) => void;
    fontSizeOptions?: Array<{ value: TextNodeData['fontSize']; label: string }>;
    hideBold?: boolean;
};

type TextSelectionToolbarProps = LegacyToolbarProps | RichToolbarProps;

const FONT_SIZE_OPTIONS: Array<{ value: TextNodeData['fontSize']; label: string }> = [
    { value: 'small', label: '14px' },
    { value: 'medium', label: '18px' },
    { value: 'large', label: '24px' },
    { value: 'xlarge', label: '32px' },
];

const ALIGN_OPTIONS: Array<{ value: TextNodeData['textAlign']; title: string; icon: React.ReactNode }> = [
    { value: 'left', title: 'Align left', icon: <AlignLeft size={18} strokeWidth={2.25} /> },
    { value: 'center', title: 'Align center', icon: <AlignCenter size={18} strokeWidth={2.25} /> },
    { value: 'right', title: 'Align right', icon: <AlignRight size={18} strokeWidth={2.25} /> },
];

const ToolbarButton = ({
    active = false,
    onClick,
    title,
    children,
}: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-[13px] font-semibold transition-all ${
            active
                ? 'border-slate-200 bg-white text-slate-900 shadow-[0_3px_10px_rgba(15,23,42,0.08)]'
                : 'border-transparent bg-transparent text-slate-700 hover:bg-white/90 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
        }`}
        title={title}
    >
        {children}
    </button>
);

const TextSelectionToolbar = (props: TextSelectionToolbarProps) => {
    const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
    const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
    const [linkDraft, setLinkDraft] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const isRich = props.variant === 'rich';
    const activeLinkHref = isRich ? props.activeStyles.linkHref : '';
    const fontSizeOptions = isRich ? (props.fontSizeOptions ?? FONT_SIZE_OPTIONS) : FONT_SIZE_OPTIONS;

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (target && rootRef.current?.contains(target)) return;

            setIsSizeMenuOpen(false);
            setIsLinkMenuOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
        };
    }, []);

    useEffect(() => {
        if (!isRich) return;
        props.onPopoverOpenChange?.(isSizeMenuOpen || isLinkMenuOpen);
    }, [isLinkMenuOpen, isRich, isSizeMenuOpen, props]);

    const applyLinkDraft = () => {
        if (!isRich) return false;

        const safeHref = sanitizeTextLinkUrl(linkDraft);
        if (!safeHref) return false;

        props.onSetLink(safeHref);
        setLinkDraft(safeHref);
        setIsLinkMenuOpen(false);
        return true;
    };

    if (!props.visible || typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={rootRef}
            className="fixed z-[2000] flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/98 px-2 py-1.5 shadow-[0_14px_28px_rgba(15,23,42,0.12)] backdrop-blur-md"
            style={{
                top: props.position.top,
                left: props.position.left,
                transform: 'translate(-50%, -100%)',
            }}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onMouseDownCapture={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            data-highlight-toolbar-ignore="true"
        >
            {isRich ? (
                <>
                    <div className="relative">
                        <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                                setIsLinkMenuOpen(false);
                                setIsSizeMenuOpen((value) => !value);
                            }}
                            className="flex h-8 min-w-[70px] items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 text-[12px] font-medium text-slate-700 outline-none transition-colors hover:bg-white"
                            title="Text size"
                        >
                            <span>
                                {fontSizeOptions.find((option) => option.value === props.activeStyles.fontSize)?.label ?? fontSizeOptions[0]?.label ?? '18px'}
                            </span>
                            <ChevronDown
                                size={16}
                                className={`text-slate-500 transition-transform ${isSizeMenuOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isSizeMenuOpen && (
                            <div
                                className="absolute left-0 top-10 z-[2001] w-[104px] overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_12px_24px_rgba(15,23,42,0.14)]"
                                onMouseDown={(event) => event.preventDefault()}
                            >
                                {fontSizeOptions.map((option) => {
                                    const isActive = option.value === props.activeStyles.fontSize;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => {
                                                props.onFontSizeChange(option.value);
                                                setIsSizeMenuOpen(false);
                                            }}
                                            className={`flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-[12px] font-medium transition-colors ${
                                                isActive
                                                    ? 'bg-blue-50 text-blue-600'
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{option.label}</span>
                                            {isActive && <Check size={15} />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    {!props.hideBold && (
                        <ToolbarButton
                            active={props.activeStyles.bold}
                            onClick={props.onToggleBold}
                            title="Bold"
                        >
                            B
                        </ToolbarButton>
                    )}

                    <ToolbarButton
                        active={props.activeStyles.italic}
                        onClick={props.onToggleItalic}
                        title="Italic"
                    >
                        <span className="italic">I</span>
                    </ToolbarButton>

                    <ToolbarButton
                        active={props.activeStyles.underline}
                        onClick={props.onToggleUnderline}
                        title="Underline"
                    >
                        <span className="underline underline-offset-2">U</span>
                    </ToolbarButton>

                    <div className="relative">
                        <ToolbarButton
                            active={!!props.activeStyles.linkHref || isLinkMenuOpen}
                            onClick={() => {
                                setIsSizeMenuOpen(false);
                                setIsLinkMenuOpen((value) => {
                                    const nextValue = !value;
                                    if (nextValue) {
                                        setLinkDraft(activeLinkHref || '');
                                    }
                                    return nextValue;
                                });
                            }}
                            title="Add or edit link"
                        >
                            <Link2 size={15} strokeWidth={2.2} />
                        </ToolbarButton>

                        {isLinkMenuOpen && (
                            <div
                                className="absolute left-1/2 top-10 z-[2001] flex w-[min(360px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_24px_rgba(15,23,42,0.14)]"
                                onPointerDownCapture={(event) => event.stopPropagation()}
                                onMouseDownCapture={(event) => event.stopPropagation()}
                                onMouseDown={(event) => event.stopPropagation()}
                                data-highlight-toolbar-ignore="true"
                            >
                                <textarea
                                    autoFocus
                                    rows={3}
                                    value={linkDraft}
                                    onChange={(event) => setLinkDraft(event.target.value)}
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    onBeforeInput={(event) => event.stopPropagation()}
                                    onPointerDownCapture={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    onPaste={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                        event.stopPropagation();
                                        if (event.key !== 'Enter' || event.shiftKey) return;
                                        event.preventDefault();
                                        applyLinkDraft();
                                    }}
                                    placeholder="https://example.com"
                                    className="min-h-[74px] w-full resize-none rounded-md border border-slate-200 px-2.5 py-2 text-[12px] leading-5 text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
                                    style={{
                                        overflowWrap: 'anywhere',
                                        wordBreak: 'break-word',
                                    }}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            props.onRemoveLink();
                                            setLinkDraft('');
                                            setIsLinkMenuOpen(false);
                                        }}
                                        className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                                        title="Remove link"
                                    >
                                        <Trash2 size={14} />
                                        <span>Remove</span>
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            applyLinkDraft();
                                        }}
                                        className="flex h-8 items-center rounded-md bg-blue-600 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700"
                                        title="Apply link"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    <div className="flex items-center gap-0.5 rounded-lg bg-[#F8FAFC] p-0.5">
                        {ALIGN_OPTIONS.map((option) => (
                            <ToolbarButton
                                key={option.value}
                                active={props.activeStyles.textAlign === option.value}
                                onClick={() => props.onTextAlignChange(option.value)}
                                title={option.title}
                            >
                                {option.icon}
                            </ToolbarButton>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-slate-200" />

                    <div className="flex items-center gap-1 rounded-lg bg-[#F8FAFC] px-1.5 py-1">
                        {TEXT_HIGHLIGHT_ORDER.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => props.onHighlight(color)}
                                className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: TEXT_HIGHLIGHT_COLORS[color].fill,
                                    borderColor: TEXT_HIGHLIGHT_COLORS[color].ring,
                                }}
                                title={TEXT_HIGHLIGHT_COLORS[color].label}
                            />
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-1.5 pr-0.5">
                        {TEXT_HIGHLIGHT_ORDER.map((color) => (
                            <button
                                key={color}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => props.onHighlight(color)}
                                className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: TEXT_HIGHLIGHT_COLORS[color].fill,
                                    borderColor: TEXT_HIGHLIGHT_COLORS[color].ring,
                                }}
                                title={TEXT_HIGHLIGHT_COLORS[color].label}
                            />
                        ))}
                    </div>

                    <div className="h-[18px] w-px bg-slate-200" />

                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={props.onCopy}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        title="Copy selected text"
                    >
                        <Copy size={14} />
                        <span>Copy</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={props.onSelectAll}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        title="Select all text"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                            <path d="M8 9h8M8 13h8M8 17h5" />
                        </svg>
                        <span>Select all</span>
                    </button>
                </>
            )}
        </div>,
        document.body,
    );
};

export default TextSelectionToolbar;
