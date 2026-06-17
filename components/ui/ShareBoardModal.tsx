'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useMindStore } from '@/store/useMindStore';
import { useTranslation } from '@/lib/i18n';
import { canCurrentTierExport } from '@/lib/creditCosts';
import { supabase } from '@/lib/supabase';
import type { ArrowShape, WorkspaceShareAccessRole, WorkspaceShareVisibility } from '@/types';
import {
    EXPORT_BACKGROUND_COLOR,
    buildWorkspaceExportFileName,
    getWorkspaceExportLayout,
    getWorkspaceExportRect,
    shouldIncludeExportNode,
    type WorkspaceExportFormat,
} from '@/lib/workspaceExport';

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
    accessRole: WorkspaceShareAccessRole;
    allowDuplicate: boolean;
    isEnabled: boolean;
    shareUrl: string | null;
    sharedAt: string | null;
    shareUpdatedAt: string | null;
};

type SharePanelTab = 'share' | 'export';

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
    const { t } = useTranslation();
    const { nodes, frames, strokes, arrows } = useMindStore();

    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [shareState, setShareState] = useState<ShareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
    const [activeTab, setActiveTab] = useState<SharePanelTab>('share');

    const [statusNotice, setStatusNotice] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
    const [previewSizeLabel, setPreviewSizeLabel] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [exportFormat, setExportFormat] = useState<WorkspaceExportFormat>('png');
    const [isFormatMenuOpen, setIsFormatMenuOpen] = useState(false);

    const formatMenuRef = useRef<HTMLDivElement | null>(null);
    const noticeTimeoutRef = useRef<number | null>(null);

    const title = useMemo(() => workspaceName?.trim() || 'Untitled board', [workspaceName]);
    const isWorkspaceEmpty = nodes.length === 0 && frames.length === 0 && strokes.length === 0 && arrows.length === 0;

    const exportFormatOptions: Array<{ value: WorkspaceExportFormat; label: string }> = useMemo(() => ([
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPG' },
        { value: 'webp', label: 'WEBP' },
        { value: 'pdf', label: 'PDF' },
    ]), []);

    const selectedExportFormatLabel = exportFormatOptions.find((option) => option.value === exportFormat)?.label ?? 'PNG';

    const showStatusNotice = React.useCallback((message: string) => {
        setStatusNotice(message);

        if (noticeTimeoutRef.current !== null) {
            window.clearTimeout(noticeTimeoutRef.current);
        }

        noticeTimeoutRef.current = window.setTimeout(() => {
            setStatusNotice(null);
            noticeTimeoutRef.current = null;
        }, 3200);
    }, []);

    useEffect(() => {
        return () => {
            if (noticeTimeoutRef.current !== null) {
                window.clearTimeout(noticeTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setErrorMessage(null);
            setCopyState('idle');
            setActiveTab('share');
            setStatusNotice(null);

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

    useEffect(() => {
        if (activeTab !== 'export') {
            setIsFormatMenuOpen(false);
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'export' || !isFormatMenuOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (formatMenuRef.current?.contains(event.target as Node)) return;
            setIsFormatMenuOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [activeTab, isFormatMenuOpen]);

    const isLikelyBlankExport = React.useCallback((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d');
        if (!context) return false;
        if (canvas.width <= 0 || canvas.height <= 0) return true;

        const columns = Math.min(12, canvas.width);
        const rows = Math.min(12, canvas.height);
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const x = Math.round((column / Math.max(columns - 1, 1)) * (canvas.width - 1));
                const y = Math.round((row / Math.max(rows - 1, 1)) * (canvas.height - 1));
                const pixel = context.getImageData(x, y, 1, 1).data;
                if (pixel[3] > 3) {
                    return false;
                }
            }
        }

        return true;
    }, []);

    const triggerDownload = React.useCallback((dataUrl: string, fileName: string) => {
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = fileName;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }, []);

    const renderArrowHeadOnCanvas = React.useCallback((
        context: CanvasRenderingContext2D,
        end: { x: number; y: number },
        angle: number,
        size: number,
        scale: number,
        translateX: number,
        translateY: number,
    ) => {
        const headLength = Math.max(size * 4.5, 16);
        const headWidth = Math.max(size * 2.8, 9);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const left = {
            x: end.x - headLength * cos + headWidth * sin,
            y: end.y - headLength * sin - headWidth * cos,
        };
        const right = {
            x: end.x - headLength * cos - headWidth * sin,
            y: end.y - headLength * sin + headWidth * cos,
        };
        const ctrlLeft = {
            x: end.x - headLength * 0.55 * cos + headWidth * 0.4 * sin,
            y: end.y - headLength * 0.55 * sin - headWidth * 0.4 * cos,
        };
        const ctrlRight = {
            x: end.x - headLength * 0.55 * cos - headWidth * 0.4 * sin,
            y: end.y - headLength * 0.55 * sin + headWidth * 0.4 * cos,
        };

        context.beginPath();
        context.moveTo(left.x * scale + translateX, left.y * scale + translateY);
        context.quadraticCurveTo(
            ctrlLeft.x * scale + translateX,
            ctrlLeft.y * scale + translateY,
            end.x * scale + translateX,
            end.y * scale + translateY,
        );
        context.quadraticCurveTo(
            ctrlRight.x * scale + translateX,
            ctrlRight.y * scale + translateY,
            right.x * scale + translateX,
            right.y * scale + translateY,
        );
        context.stroke();
    }, []);

    const renderExportArrows = React.useCallback((
        canvas: HTMLCanvasElement,
        exportArrows: ArrowShape[],
        layout: { scale: number; translateX: number; translateY: number },
        pixelRatio: number,
    ) => {
        if (exportArrows.length === 0) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.save();
        context.lineCap = 'round';
        context.lineJoin = 'round';

        for (const arrow of exportArrows) {
            const angle = Math.atan2(arrow.end.y - arrow.control.y, arrow.end.x - arrow.control.x);
            context.strokeStyle = arrow.color;
            context.lineWidth = Math.max(arrow.size * layout.scale * pixelRatio, 1);

            context.beginPath();
            context.moveTo(
                arrow.start.x * layout.scale * pixelRatio + layout.translateX * pixelRatio,
                arrow.start.y * layout.scale * pixelRatio + layout.translateY * pixelRatio,
            );
            context.quadraticCurveTo(
                arrow.control.x * layout.scale * pixelRatio + layout.translateX * pixelRatio,
                arrow.control.y * layout.scale * pixelRatio + layout.translateY * pixelRatio,
                arrow.end.x * layout.scale * pixelRatio + layout.translateX * pixelRatio,
                arrow.end.y * layout.scale * pixelRatio + layout.translateY * pixelRatio,
            );
            context.stroke();

            renderArrowHeadOnCanvas(
                context,
                arrow.end,
                angle,
                arrow.size,
                layout.scale * pixelRatio,
                layout.translateX * pixelRatio,
                layout.translateY * pixelRatio,
            );
        }

        context.restore();
    }, [renderArrowHeadOnCanvas]);

    const captureExportCanvas = React.useCallback(async (options: {
        pixelRatio: number;
        maxSide: number;
    }): Promise<{ canvas: HTMLCanvasElement; width: number; height: number } | null> => {
        const reactFlowElement = document.querySelector('.react-flow') as HTMLElement | null;
        if (!reactFlowElement) return null;

        const exportRect = getWorkspaceExportRect({ nodes, frames, strokes, arrows });
        if (!exportRect) return null;

        const viewportElement = reactFlowElement.querySelector('.react-flow__viewport') as HTMLElement | null;
        if (!viewportElement) return null;

        const originalViewportTransform = viewportElement.style.transform;
        const originalViewportTransformOrigin = viewportElement.style.transformOrigin;
        const originalViewportTransition = viewportElement.style.transition;
        const hiddenSelectors = [
            '[data-export-arrow-layer="true"]',
            '.react-flow__minimap',
            '.react-flow__controls',
            '.react-flow__attribution',
            '.react-flow__handle',
            '.react-flow__resize-control',
            '.react-flow__resize-control-line',
            '.react-flow__resize-control-handle',
            '.react-flow__selection',
            '.react-flow__selectionpane',
            '.react-flow__nodesselection',
            '.react-flow__node-toolbar',
            '.handle-menu',
            '.node-settings-menu',
            '[data-highlight-toolbar-ignore="true"]',
            '[data-frame-handle-dot="true"]',
        ];
        const hiddenNodes = Array.from(
            reactFlowElement.querySelectorAll<HTMLElement | SVGElement>(hiddenSelectors.join(', '))
        );
        const originalNodeDisplay = hiddenNodes.map((node) => ({
            node,
            display: node.style.display,
        }));

        const layout = getWorkspaceExportLayout(exportRect, {
            padding: 40,
            maxSide: options.maxSide,
            minWidth: 1,
            minHeight: 1,
        });
        const { toCanvas } = await import('html-to-image');
        const exportViewportTransform = `translate(${layout.translateX}px, ${layout.translateY}px) scale(${layout.scale})`;

        try {
            viewportElement.style.transition = 'none';
            viewportElement.style.transformOrigin = '0 0';
            viewportElement.style.transform = exportViewportTransform;
            reactFlowElement.style.setProperty('--paapan-arrow-export-transform', exportViewportTransform);
            hiddenNodes.forEach((node) => {
                node.style.display = 'none';
            });

            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });

            let exportCanvas = await toCanvas(reactFlowElement, {
                cacheBust: true,
                backgroundColor: EXPORT_BACKGROUND_COLOR,
                pixelRatio: options.pixelRatio,
                width: layout.width,
                height: layout.height,
                canvasWidth: layout.width,
                canvasHeight: layout.height,
                style: {
                    width: `${layout.width}px`,
                    height: `${layout.height}px`,
                },
            });

            if (isLikelyBlankExport(exportCanvas)) {
                originalNodeDisplay.forEach(({ node, display }) => {
                    node.style.display = display;
                });

                await new Promise<void>((resolve) => {
                    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
                });

                exportCanvas = await toCanvas(reactFlowElement, {
                    cacheBust: true,
                    backgroundColor: EXPORT_BACKGROUND_COLOR,
                    pixelRatio: options.pixelRatio,
                    width: layout.width,
                    height: layout.height,
                    canvasWidth: layout.width,
                    canvasHeight: layout.height,
                    style: {
                        width: `${layout.width}px`,
                        height: `${layout.height}px`,
                    },
                    filter: (node) => {
                        const currentNode = node as unknown;
                        if (
                            typeof currentNode !== 'object' ||
                            currentNode === null ||
                            (!(currentNode instanceof HTMLElement) && !(currentNode instanceof SVGElement))
                        ) {
                            return true;
                        }

                        return shouldIncludeExportNode(currentNode);
                    },
                });
            }

            renderExportArrows(exportCanvas, arrows, layout, options.pixelRatio);
            return {
                canvas: exportCanvas,
                width: exportCanvas.width,
                height: exportCanvas.height,
            };
        } finally {
            viewportElement.style.transform = originalViewportTransform;
            viewportElement.style.transformOrigin = originalViewportTransformOrigin;
            viewportElement.style.transition = originalViewportTransition;
            reactFlowElement.style.removeProperty('--paapan-arrow-export-transform');
            originalNodeDisplay.forEach(({ node, display }) => {
                node.style.display = display;
            });
        }
    }, [arrows, frames, isLikelyBlankExport, nodes, renderExportArrows, strokes]);

    const getRasterDataUrl = React.useCallback((canvas: HTMLCanvasElement, format: WorkspaceExportFormat) => {
        if (format === 'jpg') {
            const whiteCanvas = document.createElement('canvas');
            whiteCanvas.width = canvas.width;
            whiteCanvas.height = canvas.height;
            const context = whiteCanvas.getContext('2d');
            if (!context) {
                return canvas.toDataURL('image/jpeg', 0.92);
            }

            context.fillStyle = EXPORT_BACKGROUND_COLOR;
            context.fillRect(0, 0, whiteCanvas.width, whiteCanvas.height);
            context.drawImage(canvas, 0, 0);
            return whiteCanvas.toDataURL('image/jpeg', 0.92);
        }

        if (format === 'webp') {
            return canvas.toDataURL('image/webp', 0.95);
        }

        return canvas.toDataURL('image/png');
    }, []);

    const getExportSuccessNotice = React.useCallback((format: WorkspaceExportFormat) => {
        if (format === 'png') return t.canvas.exportSuccessPng;
        if (format === 'jpg') return t.canvas.exportSuccessJpg;
        if (format === 'webp') return t.canvas.exportSuccessWebp;
        return t.canvas.exportSuccessPdf;
    }, [t.canvas.exportSuccessJpg, t.canvas.exportSuccessPdf, t.canvas.exportSuccessPng, t.canvas.exportSuccessWebp]);

    const handleExport = React.useCallback(async () => {
        if (isWorkspaceEmpty) {
            showStatusNotice(t.canvas.exportEmpty);
            return;
        }

        if (!canCurrentTierExport(exportFormat)) {
            showStatusNotice(t.canvas.exportUpgrade);
            router.push('/pricing');
            return;
        }

        setIsExporting(true);

        try {
            const capture = await captureExportCanvas({
                pixelRatio: 2,
                maxSide: 2400,
            });

            if (!capture) {
                showStatusNotice(t.canvas.exportFailed);
                return;
            }

            const { canvas: exportCanvas } = capture;
            const fileName = buildWorkspaceExportFileName(title, exportFormat);
            const pngDataUrl = exportCanvas.toDataURL('image/png');

            if (exportFormat !== 'pdf') {
                const rasterDataUrl = getRasterDataUrl(exportCanvas, exportFormat);
                triggerDownload(rasterDataUrl, fileName);
                showStatusNotice(getExportSuccessNotice(exportFormat));
                return;
            }

            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF({
                orientation: exportCanvas.width >= exportCanvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [exportCanvas.width, exportCanvas.height],
                compress: true,
            });

            pdf.addImage(pngDataUrl, 'PNG', 0, 0, exportCanvas.width, exportCanvas.height, undefined, 'FAST');
            pdf.save(fileName);
            showStatusNotice(t.canvas.exportSuccessPdf);
        } catch (error) {
            console.error('[SharePanel] Export failed:', error);
            showStatusNotice(t.canvas.exportFailed);
        } finally {
            setIsExporting(false);
        }
    }, [captureExportCanvas, exportFormat, getExportSuccessNotice, getRasterDataUrl, isWorkspaceEmpty, router, showStatusNotice, t.canvas.exportEmpty, t.canvas.exportFailed, t.canvas.exportSuccessPdf, t.canvas.exportUpgrade, title, triggerDownload]);

    useEffect(() => {
        if (!isOpen || activeTab !== 'export') return;

        let cancelled = false;
        const timer = window.setTimeout(() => {
            const run = async () => {
                if (isWorkspaceEmpty) {
                    setPreviewDataUrl(null);
                    setPreviewSizeLabel(null);
                    setPreviewError(t.canvas.exportEmpty);
                    return;
                }

                setIsPreviewLoading(true);
                setPreviewError(null);

                try {
                    const capture = await captureExportCanvas({
                        pixelRatio: 1,
                        maxSide: 1100,
                    });

                    if (cancelled) return;

                    if (!capture) {
                        setPreviewDataUrl(null);
                        setPreviewSizeLabel(null);
                        setPreviewError(t.canvas.exportPreviewFailed);
                        return;
                    }

                    setPreviewDataUrl(capture.canvas.toDataURL('image/png'));
                    setPreviewSizeLabel(`${capture.width}x${capture.height}`);
                } catch (error) {
                    if (cancelled) return;
                    console.error('[SharePanel] Export preview failed:', error);
                    setPreviewDataUrl(null);
                    setPreviewSizeLabel(null);
                    setPreviewError(t.canvas.exportPreviewFailed);
                } finally {
                    if (!cancelled) {
                        setIsPreviewLoading(false);
                    }
                }
            };

            void run();
        }, 140);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [activeTab, captureExportCanvas, isOpen, isWorkspaceEmpty, t.canvas.exportEmpty, t.canvas.exportPreviewFailed]);

    if (!isOpen || !modalRoot || isAuthenticated === false) return null;

    const updateShareState = async ({
        action,
        optimisticState,
    }: {
        action: () => Promise<ShareResponse>;
        optimisticState?: ShareResponse | null | ((previous: ShareResponse | null) => ShareResponse | null);
    }) => {
        const previousShareState = shareState;

        setIsSaving(true);
        setErrorMessage(null);

        if (optimisticState !== undefined) {
            setShareState((previous) => (
                typeof optimisticState === 'function'
                    ? optimisticState(previous)
                    : optimisticState
            ));
        }

        try {
            const payload = await action();
            setShareState(payload);
        } catch (error) {
            setShareState(previousShareState);
            setErrorMessage(error instanceof Error ? error.message : 'Failed to update share settings');
        } finally {
            setIsSaving(false);
        }
    };

    const isPublic = shareState?.visibility === 'link_view';

    const handleShareToggle = () => {
        if (!workspaceId) return;

        if (isPublic) {
            void updateShareState({
                optimisticState: (previous) => (
                    previous
                        ? {
                            ...previous,
                            visibility: 'private',
                            isEnabled: false,
                            shareUrl: null,
                            shareUpdatedAt: new Date().toISOString(),
                        }
                        : previous
                ),
                action: () =>
                    fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                        method: 'DELETE',
                    }),
            });
            return;
        }

        void updateShareState({
            optimisticState: (previous) => (
                previous
                    ? {
                        ...previous,
                        visibility: 'link_view',
                        isEnabled: true,
                        accessRole: 'viewer',
                        allowDuplicate: true,
                        shareUpdatedAt: new Date().toISOString(),
                    }
                    : previous
            ),
            action: () =>
                fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share`, {
                    method: 'POST',
                    body: JSON.stringify({
                        accessRole: 'viewer',
                    }),
                }),
        });
    };

    const handleRegenerate = () => {
        if (!workspaceId) return;
        void updateShareState({
            action: () =>
                fetchWithAuth<ShareResponse>(`/api/boards/${workspaceId}/share/regenerate`, {
                    method: 'POST',
                }),
        });
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
                        <div className="border-b border-slate-200 px-1 pb-2">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-5">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('share')}
                                        className={`relative pb-2 text-sm font-semibold transition-colors ${
                                            activeTab === 'share' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Share
                                        {activeTab === 'share' && (
                                            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-slate-950" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('export')}
                                        className={`relative pb-2 text-sm font-semibold transition-colors ${
                                            activeTab === 'export' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        Export
                                        {activeTab === 'export' && (
                                            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-slate-950" />
                                        )}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close share panel"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {activeTab === 'share' ? (
                            <>
                                <div className="px-1">
                                    <h2 className="truncate text-base font-black text-slate-950">{title}</h2>
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
                                        <p className="text-sm font-bold text-slate-950">Anyone with the link</p>
                                        <p className="mt-0.5 text-sm text-slate-500">
                                            Can view only. They can duplicate after signing in.
                                        </p>
                                    </div>
                                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                                        View only
                                    </span>
                                </div>

                                {statusNotice && activeTab === 'share' && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                        {statusNotice}
                                    </div>
                                )}

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
                                        {isPublic && isSaving
                                            ? 'Menyiapkan link share...'
                                            : 'Aktifkan sharing untuk membuat link publik.'}
                                    </div>
                                )}

                                {shareState?.shareUrl && (
                                    <div className="flex gap-2">
                                        <a
                                            href={shareState.shareUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Open
                                        </a>
                                    </div>
                                )}

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
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-3 border-b border-slate-200 pb-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-800">{t.canvas.exportFormat}</span>
                                        <div ref={formatMenuRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsFormatMenuOpen((previous) => !previous)}
                                                className="inline-flex h-9 min-w-[88px] items-center justify-between rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-all hover:border-slate-400"
                                            >
                                                <span className="text-sm font-semibold text-slate-700">{selectedExportFormatLabel}</span>
                                                <ChevronDown className={`ml-1.5 h-4 w-4 text-slate-600 transition-transform ${isFormatMenuOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isFormatMenuOpen && (
                                                <div className="absolute right-0 top-[calc(100%+6px)] z-[95] w-[130px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_28px_rgba(15,23,42,0.14)]">
                                                    {exportFormatOptions.map((option) => (
                                                        <button
                                                            key={option.value}
                                                            type="button"
                                                            onClick={() => {
                                                                setExportFormat(option.value);
                                                                setIsFormatMenuOpen(false);
                                                            }}
                                                            className={`flex w-full items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${
                                                                exportFormat === option.value
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'text-slate-700 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            <span>{option.label}</span>
                                                            {exportFormat === option.value ? (
                                                                <Check className="h-4 w-4" />
                                                            ) : (
                                                                <span className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                                    <div className="relative h-[170px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                                        {isPreviewLoading ? (
                                            <div className="flex h-full w-full items-center justify-center gap-2 text-sm font-medium text-slate-500">
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                <span>Generating preview...</span>
                                            </div>
                                        ) : previewDataUrl ? (
                                            <img src={previewDataUrl} alt="Export Preview" className="h-full w-full object-contain" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-500">
                                                {previewError || t.canvas.exportPreviewFailed}
                                            </div>
                                        )}
                                        {previewSizeLabel && (
                                            <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                                {previewSizeLabel}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {statusNotice && (
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                        {statusNotice}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => void handleExport()}
                                    disabled={isExporting || isWorkspaceEmpty}
                                    className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span>{isExporting ? t.common.loading : t.canvas.exportImage}</span>
                                </button>
                            </div>
                        )}

                        {activeTab === 'share' && errorMessage && (
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
