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

export default function ShareBoardModal({
    isOpen,
    onClose,
    workspaceId,
    workspaceName,
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

    const handleEnableShare = () => {
        if (!workspaceId) return;
        void updateShareState(() =>
            fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                method: 'POST',
                body: JSON.stringify({
                    allowDuplicate: shareState?.allowDuplicate ?? true,
                }),
            })
        );
    };

    const handleSetPrivate = () => {
        if (!workspaceId) return;
        void updateShareState(() =>
            fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                method: 'DELETE',
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

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/28 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="mx-4 w-full max-w-[560px] rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.2)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
                                Share board
                            </p>
                            <h2 className="mt-1 text-2xl font-black text-slate-950">
                                {title}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Bagikan board ini dengan link view-only. Pengaturan share tetap hanya bisa diubah saat login.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                            Tutup
                        </button>
                    </div>
                </div>

                <div className="space-y-5 px-6 py-5">
                    {isLoading ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Memuat pengaturan share...</span>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 md:grid-cols-2">
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={handleSetPrivate}
                                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                                        shareState?.visibility !== 'link_view'
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                                    }`}
                                >
                                    <p className="text-sm font-bold">Private</p>
                                    <p className={`mt-1 text-sm leading-6 ${shareState?.visibility !== 'link_view' ? 'text-slate-200' : 'text-slate-500'}`}>
                                        Hanya kamu yang bisa membuka dan mengatur board ini.
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={handleEnableShare}
                                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                                        shareState?.visibility === 'link_view'
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                                    }`}
                                >
                                    <p className="text-sm font-bold">Anyone with link can view</p>
                                    <p className={`mt-1 text-sm leading-6 ${shareState?.visibility === 'link_view' ? 'text-blue-100' : 'text-slate-500'}`}>
                                        Board terbuka dengan link read-only tanpa perlu login.
                                    </p>
                                </button>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Allow duplicate</p>
                                        <p className="mt-1 text-sm leading-6 text-slate-500">
                                            Pengunjung yang membuka board publik nanti bisa membuat salinan ke workspace mereka sendiri.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={handleToggleDuplicate}
                                        className={`relative mt-1 inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                                            shareState?.allowDuplicate ? 'bg-blue-600' : 'bg-slate-300'
                                        }`}
                                        aria-pressed={shareState?.allowDuplicate === true}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                                                shareState?.allowDuplicate ? 'left-6' : 'left-1'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Share link</p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {shareState?.isEnabled
                                                ? 'Link aktif dan bisa dibuka sebagai board view-only.'
                                                : 'Aktifkan sharing dulu untuk membuat link publik.'}
                                        </p>
                                    </div>
                                    {shareState?.isEnabled && (
                                        <button
                                            type="button"
                                            onClick={handleRegenerate}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`} />
                                            Regenerate
                                        </button>
                                    )}
                                </div>

                                <div className="mt-3 flex flex-col gap-3 md:flex-row">
                                    <div className="flex min-h-12 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600">
                                        {shareState?.shareUrl ? (
                                            <span className="truncate">{shareState.shareUrl}</span>
                                        ) : (
                                            <span className="text-slate-400">Belum ada link share</span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handleCopyLink()}
                                            disabled={!shareState?.shareUrl || isSaving}
                                            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            <Copy className="h-4 w-4" />
                                            {copyState === 'copied' ? 'Copied' : 'Copy link'}
                                        </button>
                                        {shareState?.shareUrl && (
                                            <a
                                                href={shareState.shareUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                                Open
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Need export instead?</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Kamu masih bisa pakai flow export gambar atau PDF seperti sebelumnya.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={openExportPanel}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <Link2 className="h-4 w-4" />
                                    Open export
                                </button>
                            </div>

                            {errorMessage && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {errorMessage}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>,
        modalRoot
    );
}
