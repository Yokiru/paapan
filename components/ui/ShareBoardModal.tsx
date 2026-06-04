'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';
import type { WorkspaceShareVisibility } from '@/types';

interface ShareBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string | null;
    workspaceName: string | null | undefined;
    anchorRect: DOMRect | null;
}

type ShareResponse = {
    boardId: string;
    boardName: string;
    visibility: WorkspaceShareVisibility;
    allowDuplicate: boolean;
    isEnabled: boolean;
    shareUrl: string | null;
    sharedAt: string | null;
    shareUpdatedAt: string | null;
};

const modalRoot = typeof document !== 'undefined' ? document.body : null;
const PANEL_WIDTH = 344;
const PANEL_GAP = 12;

async function fetchWithAuth<T>(path: string, init?: RequestInit): Promise<T> {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Request failed';
        throw new Error(message);
    }

    return payload as T;
}

function getPopoverStyle(anchorRect: DOMRect | null) {
    if (!anchorRect || typeof window === 'undefined') {
        return {
            top: 68,
            right: 16,
            width: PANEL_WIDTH,
        };
    }

    const viewportWidth = window.innerWidth;
    const left = Math.min(
        Math.max(16, anchorRect.right - PANEL_WIDTH),
        Math.max(16, viewportWidth - PANEL_WIDTH - 16)
    );

    return {
        top: anchorRect.bottom + PANEL_GAP,
        left,
        width: Math.min(PANEL_WIDTH, viewportWidth - 32),
    };
}

function Toggle({
    checked,
    disabled,
    onClick,
}: {
    checked: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors ${
                checked ? 'bg-blue-600' : 'bg-slate-300'
            } ${disabled ? 'opacity-60' : ''}`}
            aria-pressed={checked}
        >
            <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                    checked ? 'left-7' : 'left-1'
                }`}
            />
        </button>
    );
}

export default function ShareBoardModal({
    isOpen,
    onClose,
    workspaceId,
    workspaceName,
    anchorRect,
}: ShareBoardModalProps) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [shareState, setShareState] = useState<ShareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

    const title = useMemo(() => workspaceName?.trim() || 'Untitled board', [workspaceName]);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setErrorMessage(null);
            setCopyState('idle');

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (cancelled) return;

                const loggedIn = Boolean(session?.user);
                setIsAuthenticated(loggedIn);

                if (!loggedIn) {
                    onClose();
                    router.push('/login');
                    return;
                }

                if (!workspaceId) {
                    setShareState(null);
                    return;
                }

                const payload = await fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`);
                if (cancelled) return;
                setShareState(payload);
            } catch (error) {
                if (cancelled) return;
                setErrorMessage(error instanceof Error ? error.message : 'Failed to load share settings');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [isOpen, onClose, router, workspaceId]);

    if (!isOpen || !modalRoot || isAuthenticated === false) return null;

    const updateShareState = async (action: () => Promise<ShareResponse>) => {
        setIsSaving(true);
        setErrorMessage(null);

        try {
            const payload = await action();
            setShareState(payload);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to update share settings');
        } finally {
            setIsSaving(false);
        }
    };

    const isPublic = shareState?.visibility === 'link_view';

    const handleShareToggle = () => {
        if (!workspaceId) return;

        if (isPublic) {
            void updateShareState(() =>
                fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                    method: 'DELETE',
                })
            );
            return;
        }

        void updateShareState(() =>
            fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                method: 'POST',
                body: JSON.stringify({
                    allowDuplicate: shareState?.allowDuplicate ?? true,
                }),
            })
        );
    };

    const handleToggleDuplicate = () => {
        if (!workspaceId || !shareState) return;
        const nextAllowDuplicate = !shareState.allowDuplicate;
        void updateShareState(() =>
            fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                method: 'PATCH',
                body: JSON.stringify({
                    allowDuplicate: nextAllowDuplicate,
                }),
            })
        );
    };

    const handleRegenerate = () => {
        if (!workspaceId) return;
        void updateShareState(() =>
            fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share/regenerate`, {
                method: 'POST',
            })
        );
    };

    const handleCopyLink = async () => {
        if (!shareState?.shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareState.shareUrl);
            setCopyState('copied');
            window.setTimeout(() => setCopyState('idle'), 1600);
        } catch {
            setCopyState('error');
        }
    };

    const openExportPanel = () => {
        onClose();
        window.dispatchEvent(new Event('toolbar:toggle-export-panel'));
    };

    const popoverStyle = getPopoverStyle(anchorRect);

    return createPortal(
        <div className="fixed inset-0 z-[9998]" onClick={onClose}>
            <div
                className="absolute pointer-events-auto rounded-[22px] border border-slate-200/90 bg-white/98 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl"
                style={popoverStyle}
                onClick={(event) => event.stopPropagation()}
            >
                {isLoading ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memuat share...</span>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3 px-1 pb-1">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">
                                    Share
                                </p>
                                <h2 className="mt-0.5 truncate text-base font-black text-slate-950">{title}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                            >
                                Tutup
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-950">Share this board</p>
                                    <p className="mt-0.5 text-sm text-slate-500">
                                        {isPublic ? 'Anyone with the link can view' : 'Private'}
                                    </p>
                                </div>
                                <Toggle checked={Boolean(isPublic)} disabled={isSaving} onClick={handleShareToggle} />
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                            <div>
                                <p className="text-sm font-bold text-slate-950">Allow duplicate</p>
                                <p className="mt-0.5 text-sm text-slate-500">Pengguna bisa salin ke board mereka</p>
                            </div>
                            <Toggle
                                checked={Boolean(shareState?.allowDuplicate)}
                                disabled={!isPublic || isSaving}
                                onClick={handleToggleDuplicate}
                            />
                        </div>

                        {shareState?.shareUrl ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-500">
                                        <p className="truncate">{shareState.shareUrl}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleCopyLink()}
                                        disabled={isSaving}
                                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                    >
                                        <Copy className="h-4 w-4" />
                                        {copyState === 'copied' ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                                Aktifkan sharing untuk membuat link publik.
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={openExportPanel}
                                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <Link2 className="h-4 w-4" />
                                Export
                            </button>
                            {shareState?.shareUrl && (
                                <a
                                    href={shareState.shareUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Open
                                </a>
                            )}
                        </div>

                        {shareState?.shareUrl && (
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={isSaving}
                                className="inline-flex items-center gap-2 px-1 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-60"
                            >
                                <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                                Regenerate link
                            </button>
                        )}

                        {errorMessage && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>,
        modalRoot
    );
}
