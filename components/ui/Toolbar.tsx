"use client";

import React from 'react';
import { Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useMindStore } from '@/store/useMindStore';
import { useCreditStore } from '@/store/useCreditStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useTranslation } from '@/lib/i18n';
import { ToolMode } from '@/types';
import { useRouter } from 'next/navigation';
import { canCurrentTierExport, getImageNodeLimit, hasUnlimitedImageNodesForTier } from '@/lib/creditCosts';
import { ArrowShape, ImageUploadResult } from '@/types';
import { supabase } from '@/lib/supabase';
import { getToolbarTourCompleted, setToolbarTourCompleted, TOOLBAR_TOUR_STORAGE_KEY } from '@/lib/userOnboarding';
import {
    EXPORT_BACKGROUND_COLOR,
    buildWorkspaceExportFileName,
    getWorkspaceExportLayout,
    getWorkspaceExportRect,
    shouldIncludeExportNode,
    type WorkspaceExportFormat,
} from '@/lib/workspaceExport';

/**
 * Toolbar Component - Medium Size
 */
export default function Toolbar() {
    const router = useRouter();
    const { t } = useTranslation();
    const isExperimentMode = true;
    const currentTier = useCreditStore(state => state.currentTier);
    const hasUnlimitedImageNodes = hasUnlimitedImageNodesForTier(currentTier);
    const {
        tool,
        setTool,
        addRootNode,
        addImageNode,
        pendingTextInsertVariant,
        setPendingTextInsertVariant,
        viewportCenter,
        nodes,
        edges,
        frames,
        strokes,
        arrows,
    } = useMindStore();
    const activeWorkspaceName = useWorkspaceStore((state) => {
        const activeWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);
        return activeWorkspace?.name ?? null;
    });
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const exportPanelRef = React.useRef<HTMLDivElement>(null);
    const textMenuRef = React.useRef<HTMLDivElement>(null);
    const noticeTimeoutRef = React.useRef<number | null>(null);

    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [statusNotice, setStatusNotice] = React.useState<string | null>(null);
    const [isExportPanelOpen, setIsExportPanelOpen] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
    const [previewDataUrl, setPreviewDataUrl] = React.useState<string | null>(null);
    const [previewSizeLabel, setPreviewSizeLabel] = React.useState<string | null>(null);
    const [previewError, setPreviewError] = React.useState<string | null>(null);
    const [exportFormat, setExportFormat] = React.useState<WorkspaceExportFormat>('png');
    const [isFormatMenuOpen, setIsFormatMenuOpen] = React.useState(false);
    const [isTextMenuOpen, setIsTextMenuOpen] = React.useState(false);
    const [tourReady, setTourReady] = React.useState(false);
    const [tourDismissed, setTourDismissed] = React.useState(false);
    const [tourStep, setTourStep] = React.useState(0);
    const [activeMicroHelp, setActiveMicroHelp] = React.useState<{
        id: string;
        label: string;
        description: string;
        left: number;
        top: number;
    } | null>(null);

    const isWorkspaceEmpty = nodes.length === 0 && edges.length === 0 && frames.length === 0 && strokes.length === 0 && arrows.length === 0;

    React.useEffect(() => {
        if (showLimitAlert && hasUnlimitedImageNodes) {
            setShowLimitAlert(false);
        }
    }, [hasUnlimitedImageNodes, showLimitAlert]);

    const exportFormatOptions: Array<{ value: WorkspaceExportFormat; label: string }> = React.useMemo(() => ([
        { value: 'png', label: 'PNG' },
        { value: 'jpg', label: 'JPG' },
        { value: 'webp', label: 'WEBP' },
        { value: 'pdf', label: 'PDF' },
    ]), []);

    const showToolbarNotice = React.useCallback((message: string) => {
        setStatusNotice(message);

        if (noticeTimeoutRef.current !== null) {
            window.clearTimeout(noticeTimeoutRef.current);
        }

        noticeTimeoutRef.current = window.setTimeout(() => {
            setStatusNotice(null);
            noticeTimeoutRef.current = null;
        }, 4000);
    }, []);

    const tourSteps = React.useMemo(() => ([
        {
            id: 'ai',
            title: 'Mulai dari AI',
            description: 'Klik tombol chat untuk membuat AI node pertama dan mulai mengembangkan ide dari sana.',
        },
        {
            id: 'media',
            title: 'Tambahkan isi',
            description: 'Gunakan gambar atau teks untuk mulai menuangkan isi board dengan cepat.',
        },
        {
            id: 'structure',
            title: 'Hubungkan dan kelompokkan',
            description: 'Pen, panah, dan frame membantu kamu menandai, menghubungkan, dan menyusun area canvas.',
        },
        {
            id: 'navigation',
            title: 'Pindah dan pilih',
            description: 'Hand untuk geser canvas, Select untuk memilih lalu mengatur elemen yang sudah ada.',
        },
    ]), []);

    const currentTourStep = tourSteps[tourStep] ?? null;
    const isTourVisible = tourReady && !tourDismissed && isWorkspaceEmpty && currentTourStep !== null;
    const shouldShowMicroHelp = tourReady && tourDismissed && !isTourVisible;

    const toolHints = React.useMemo(() => ({
        hand: {
            label: t.canvas.hand,
            description: 'Geser canvas dengan lebih bebas.',
        },
        select: {
            label: t.canvas.select,
            description: 'Pilih dan atur elemen di board.',
        },
        pen: {
            label: t.canvas.pen,
            description: 'Coret cepat untuk menandai ide.',
        },
        arrow: {
            label: 'Panah',
            description: 'Hubungkan node atau area penting.',
        },
        frame: {
            label: 'Frame',
            description: 'Kelompokkan area canvas jadi satu blok.',
        },
        image: {
            label: t.canvas.addImage,
            description: 'Tambah gambar ke board.',
        },
        text: {
            label: t.canvas.addText,
            description: 'Buat catatan teks biasa.',
        },
        ai: {
            label: t.canvas.addAIChat,
            description: 'Mulai chat AI baru dari sini.',
        },
    }), [t]);

    React.useEffect(() => {
        let cancelled = false;

        const loadTourState = async () => {
            if (typeof window === 'undefined') return;

            const localCompleted = window.localStorage.getItem(TOOLBAR_TOUR_STORAGE_KEY) === 'true';
            let completed = localCompleted;

            try {
                const remoteCompleted = await getToolbarTourCompleted(supabase);
                completed = localCompleted || remoteCompleted;

                if (remoteCompleted && !localCompleted) {
                    window.localStorage.setItem(TOOLBAR_TOUR_STORAGE_KEY, 'true');
                }
            } catch (error) {
                console.warn('[ToolbarTour] Failed to load remote state:', error);
            }

            if (!cancelled) {
                setTourDismissed(completed);
                setTourReady(true);
            }
        };

        void loadTourState();

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        return () => {
            if (noticeTimeoutRef.current !== null) {
                window.clearTimeout(noticeTimeoutRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        if (!isExportPanelOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (exportPanelRef.current?.contains(event.target as Node)) return;
            setIsExportPanelOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isExportPanelOpen]);

    React.useEffect(() => {
        if (isExportPanelOpen) return;
        setIsFormatMenuOpen(false);
    }, [isExportPanelOpen]);

    React.useEffect(() => {
        if (!isTextMenuOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (textMenuRef.current?.contains(event.target as Node)) return;
            setIsTextMenuOpen(false);
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isTextMenuOpen]);

    React.useEffect(() => {
        const handleToggleExportPanel = () => {
            if (isExporting) return;
            setIsExportPanelOpen((previous) => !previous);
        };

        window.addEventListener('toolbar:toggle-export-panel', handleToggleExportPanel);
        return () => {
            window.removeEventListener('toolbar:toggle-export-panel', handleToggleExportPanel);
        };
    }, [isExporting]);

    const showImageUploadFeedback = React.useCallback((result: ImageUploadResult) => {
        if (result === 'limit-reached') {
            setShowLimitAlert(true);
            setTimeout(() => setShowLimitAlert(false), 4000);
            return;
        }

        if (result === 'file-too-large') {
            showToolbarNotice('Gambar terlalu besar. Maksimal 2 MB.');
            return;
        }

        if (result === 'storage-full') {
            showToolbarNotice('Storage upload Anda sudah penuh. Hapus beberapa gambar untuk lanjut upload.');
            return;
        }

        if (result === 'upload-failed') {
            showToolbarNotice('Gagal upload gambar. Coba lagi.');
        }
    }, [showToolbarNotice]);

    const handleAddNode = () => {
        setPendingTextInsertVariant(null);
        addRootNode(viewportCenter);
        setTool('select');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPendingTextInsertVariant(null);
        if (e.target.files && e.target.files.length > 0) {
            void addImageNode(e.target.files[0], viewportCenter).then((result) => {
                if (result !== 'success') {
                    showImageUploadFeedback(result);
                }
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSetTool = (newTool: ToolMode) => {
        setPendingTextInsertVariant(null);
        setIsTextMenuOpen(false);
        setTool(newTool);
    };

    const handleStartTextInsert = React.useCallback((variant: 'card' | 'plain') => {
        setTool('select');
        setPendingTextInsertVariant(variant);
        setIsTextMenuOpen(false);
        showToolbarNotice(t.canvas.placeTextOnCanvas);
    }, [setPendingTextInsertVariant, setTool, showToolbarNotice, t.canvas.placeTextOnCanvas]);

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

            // Ensure browser paints updated transform before snapshot.
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
                // Fallback path: keep fit-to-content transform, but rely on node filter instead of forced display toggles.
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
            showToolbarNotice(t.canvas.exportEmpty);
            return;
        }

        if (!canCurrentTierExport(exportFormat)) {
            showToolbarNotice(t.canvas.exportUpgrade);
            router.push('/pricing');
            return;
        }

        setIsExportPanelOpen(false);
        setIsExporting(true);

        try {
            const capture = await captureExportCanvas({
                pixelRatio: 2,
                maxSide: 2400,
            });

            if (!capture) {
                showToolbarNotice(t.canvas.exportFailed);
                return;
            }

            const { canvas: exportCanvas } = capture;
            const fileName = buildWorkspaceExportFileName(activeWorkspaceName, exportFormat);
            const pngDataUrl = exportCanvas.toDataURL('image/png');

            if (exportFormat !== 'pdf') {
                const rasterDataUrl = getRasterDataUrl(exportCanvas, exportFormat);
                triggerDownload(rasterDataUrl, fileName);
                showToolbarNotice(getExportSuccessNotice(exportFormat));
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
            showToolbarNotice(t.canvas.exportSuccessPdf);
        } catch (error) {
            console.error('[Toolbar] Export failed:', error);
            showToolbarNotice(t.canvas.exportFailed);
        } finally {
            setIsExporting(false);
        }
    }, [activeWorkspaceName, captureExportCanvas, exportFormat, getExportSuccessNotice, getRasterDataUrl, isWorkspaceEmpty, router, showToolbarNotice, t.canvas.exportEmpty, t.canvas.exportFailed, t.canvas.exportSuccessPdf, t.canvas.exportUpgrade, triggerDownload]);

    React.useEffect(() => {
        if (!isExportPanelOpen) return;

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
                    console.error('[Toolbar] Export preview failed:', error);
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
    }, [captureExportCanvas, isExportPanelOpen, isWorkspaceEmpty, t.canvas.exportEmpty, t.canvas.exportPreviewFailed]);

    const completeTour = React.useCallback(() => {
        setTourDismissed(true);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(TOOLBAR_TOUR_STORAGE_KEY, 'true');
        }

        void setToolbarTourCompleted(supabase, true).catch((error) => {
            console.warn('[ToolbarTour] Failed to save remote state:', error);
        });
    }, []);

    const nextTourStep = React.useCallback(() => {
        if (tourStep >= tourSteps.length - 1) {
            completeTour();
            return;
        }

        setTourStep((prev) => prev + 1);
    }, [completeTour, tourStep, tourSteps.length]);

    const btnBase = "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 ease-out active:scale-95";
    const toolbarIconBaseClass = "transition-transform duration-200 ease-out";
    const activeIconFilter = "brightness(0) saturate(100%) invert(42%) sepia(95%) saturate(2121%) hue-rotate(210deg) brightness(101%) contrast(96%)";
    const idleIconFilter = isExperimentMode ? "none" : "brightness(0) saturate(100%) opacity(0.82)";
    const hoverIconFilter = isExperimentMode
        ? "none"
        : "brightness(0) saturate(100%) opacity(1)";
    const experimentToolbarIconSizes: Record<string, number> = {
        'toolbar-hand.svg': 22,
        'toolbar-select.svg': 20,
        'toolbar-pen.svg': 21,
        'toolbar-arrow.svg': 20,
        'toolbar-frame.svg': 22,
        'toolbar-image.svg': 20,
        'toolbar-text.svg': 20,
        'toolbar-chat.svg': 20,
    };
    const experimentActiveIconFilters: Record<string, string> = {
        'toolbar-hand.svg': activeIconFilter,
        'toolbar-select.svg': activeIconFilter,
        'toolbar-pen.svg': activeIconFilter,
        'toolbar-arrow.svg': activeIconFilter,
        'toolbar-text.svg': activeIconFilter,
    };
    const experimentActiveIconFiles = React.useMemo<Record<string, string>>(() => ({
        'toolbar-frame.svg': 'toolbar-frame-active.svg',
    }), []);

    const getToolButtonClass = (isActive: boolean, accent: 'blue' | 'indigo' = 'blue') => {
        if (isActive) {
            return `${btnBase} ${
                accent === 'indigo'
                    ? 'bg-indigo-50 ring-1 ring-indigo-200 shadow-[0_6px_18px_rgba(99,102,241,0.16)] -translate-y-[1px]'
                    : 'bg-blue-50 ring-1 ring-blue-200 shadow-[0_6px_18px_rgba(59,130,246,0.16)] -translate-y-[1px]'
            }`;
        }

        return `${btnBase} hover:bg-slate-50 hover:shadow-sm`;
    };

    const getIconStyle = (isActive: boolean, fileName?: string): React.CSSProperties => ({
        height: isExperimentMode && fileName ? experimentToolbarIconSizes[fileName] ?? 21 : 21,
        width: isExperimentMode && fileName ? experimentToolbarIconSizes[fileName] ?? 21 : 21,
        filter: isExperimentMode
            ? (isActive && fileName ? experimentActiveIconFilters[fileName] ?? idleIconFilter : idleIconFilter)
            : (isActive ? activeIconFilter : idleIconFilter),
    });
    const toolbarIconPath = React.useCallback((fileName: string, isActive = false) => {
        const resolvedFileName = isExperimentMode && isActive
            ? experimentActiveIconFiles[fileName] ?? fileName
            : fileName;

        return `/icons/${isExperimentMode ? 'toolbar%202' : 'toolbar'}/${resolvedFileName}`;
    }, [experimentActiveIconFiles, isExperimentMode]);
    const textVariantIconPath = React.useCallback((variant: 'card' | 'plain') => {
        if (!isExperimentMode) return null;
        return variant === 'card'
            ? '/icons/toolbar%202/toolbar-text-square.svg'
            : '/icons/toolbar%202/toolbar-text-only.svg';
    }, [isExperimentMode]);

    const getTourGroupClass = (groupId: string) => (
        isTourVisible && currentTourStep?.id === groupId
            ? 'rounded-xl bg-blue-50 ring-2 ring-blue-300 shadow-[0_14px_34px_rgba(59,130,246,0.18)]'
            : ''
    );

    const getTourMutedClass = (groupId: string) => (
        isTourVisible && currentTourStep?.id !== groupId
            ? 'opacity-60'
            : 'opacity-100 blur-0'
    );

    const openMicroHelp = React.useCallback((
        event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>,
        hint: { label: string; description: string },
        id: string,
    ) => {
        if (!shouldShowMicroHelp) return;

        const rect = event.currentTarget.getBoundingClientRect();
        setActiveMicroHelp({
            id,
            label: hint.label,
            description: hint.description,
            left: rect.left + rect.width / 2,
            top: rect.top - 14,
        });
    }, [shouldShowMicroHelp]);

    const closeMicroHelp = React.useCallback(() => {
        setActiveMicroHelp(null);
    }, []);

    const bindMicroHelp = React.useCallback((key: keyof typeof toolHints) => ({
        onMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => openMicroHelp(event, toolHints[key], key),
        onMouseLeave: closeMicroHelp,
        onFocus: (event: React.FocusEvent<HTMLButtonElement>) => openMicroHelp(event, toolHints[key], key),
        onBlur: closeMicroHelp,
    }), [closeMicroHelp, openMicroHelp, toolHints]);

    const selectedExportFormatLabel = exportFormatOptions.find((option) => option.value === exportFormat)?.label ?? 'PNG';
    const textButtonActive = isTextMenuOpen || pendingTextInsertVariant !== null;
    const textOptionBaseClass = 'flex h-10 w-10 items-center justify-center rounded-lg transition-colors';

    return (
        <>
            <div
                ref={exportPanelRef}
                className="fixed z-[70]"
                data-export-ignore="true"
                style={{
                    right: 'max(14px, env(safe-area-inset-right))',
                    top: 'max(60px, calc(env(safe-area-inset-top) + 60px))',
                }}
            >
                {isExportPanelOpen && (
                    <div className="absolute right-0 top-0 z-[90] w-[min(92vw,340px)] max-h-[min(82vh,620px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
                        <div className="space-y-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-800">{t.canvas.exportFormat}</span>
                                <div className="relative">
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

                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
                            <div className="relative h-[170px] overflow-hidden rounded-lg border border-slate-200 bg-white">
                                {isPreviewLoading ? (
                                    <div className="flex h-full w-full items-center justify-center gap-2 text-sm font-medium text-slate-500">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        <span>Generating preview...</span>
                                    </div>
                                ) : previewDataUrl ? (
                                    <img src={previewDataUrl} alt="Export Preview" className="h-full w-full object-contain" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 px-4 text-center">
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

                        <button
                            type="button"
                            onClick={() => void handleExport()}
                            disabled={isExporting || isWorkspaceEmpty}
                            className="mt-3 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span>{isExporting ? t.common.loading : t.canvas.exportImage}</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {statusNotice && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm whitespace-nowrap">
                    <p className="text-sm text-blue-900">{statusNotice}</p>
                </div>
            )}
            {isTourVisible && (
                <div className="absolute bottom-[calc(100%+16px)] left-1/2 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                Toolbar Tour
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">
                                {currentTourStep.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                {currentTourStep.description}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={completeTour}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                            Lewati
                        </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                            {tourSteps.map((step, index) => (
                                <span
                                    key={step.id}
                                    className={`h-1.5 rounded-full transition-all ${
                                        index === tourStep ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'
                                    }`}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={nextTourStep}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            {tourStep === tourSteps.length - 1 ? 'Selesai' : 'Lanjut'}
                        </button>
                    </div>
                </div>
            )}
            {activeMicroHelp && (
                <div
                    className="pointer-events-none fixed z-[70] w-[220px] -translate-x-1/2 -translate-y-full rounded-2xl border border-slate-200/90 bg-white/96 px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                    style={{
                        left: activeMicroHelp.left,
                        top: activeMicroHelp.top,
                    }}
                >
                    <p className="text-sm font-semibold text-slate-900">
                        {activeMicroHelp.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {activeMicroHelp.description}
                    </p>
                </div>
            )}
            {/* Main Toolbar */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">
                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('navigation')} ${getTourMutedClass('navigation')}`}>
                    {/* Hand Tool */}
                    <button
                        onClick={() => handleSetTool('hand')}
                        {...bindMicroHelp('hand')}
                        className={`${getToolButtonClass(tool === 'hand')} group`}
                        title={t.canvas.hand}
                    >
                        <img
                            src={toolbarIconPath('toolbar-hand.svg', tool === 'hand')}
                            alt="Hand"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'hand' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'hand', 'toolbar-hand.svg')}
                            onMouseEnter={(event) => {
                                if (tool !== 'hand') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'hand') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Select Tool */}
                    <button
                        onClick={() => handleSetTool('select')}
                        {...bindMicroHelp('select')}
                        className={`${getToolButtonClass(tool === 'select')} group`}
                        title={t.canvas.select}
                    >
                        <img
                            src={toolbarIconPath('toolbar-select.svg', tool === 'select')}
                            alt="Select"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'select' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'select', 'toolbar-select.svg')}
                            onMouseEnter={(event) => {
                                if (tool !== 'select') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'select') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>
                </div>

                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('structure')} ${getTourMutedClass('structure')}`}>
                    {/* Pen Tool */}
                    <button
                        onClick={() => handleSetTool('pen')}
                        {...bindMicroHelp('pen')}
                        className={`${getToolButtonClass(tool === 'pen', 'indigo')} group`}
                        title={t.canvas.pen}
                    >
                        <img
                            src={toolbarIconPath('toolbar-pen.svg', tool === 'pen')}
                            alt="Pen"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'pen' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'pen', 'toolbar-pen.svg')}
                            onMouseEnter={(event) => {
                                if (tool !== 'pen') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'pen') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Arrow Tool */}
                    <button
                        onClick={() => handleSetTool('arrow')}
                        {...bindMicroHelp('arrow')}
                        className={`${getToolButtonClass(tool === 'arrow')} group`}
                        title="Arrow"
                    >
                        <img
                            src={toolbarIconPath('toolbar-arrow.svg', tool === 'arrow')}
                            alt="Arrow"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'arrow' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'arrow', 'toolbar-arrow.svg')}
                            onMouseEnter={(event) => {
                                if (tool !== 'arrow') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'arrow') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Frame Tool */}
                    <button
                        onClick={() => handleSetTool('frame')}
                        {...bindMicroHelp('frame')}
                        className={`${getToolButtonClass(tool === 'frame')} group`}
                        title="Frame"
                    >
                        <img
                            src={toolbarIconPath('toolbar-frame.svg', tool === 'frame')}
                            alt="Frame"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'frame' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'frame', 'toolbar-frame.svg')}
                            onMouseEnter={(event) => {
                                if (tool !== 'frame') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'frame') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>
                </div>

                <div className="mx-0.5 h-5 w-px bg-slate-200" />

                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('media')} ${getTourMutedClass('media')}`}>
                    {/* Add Image */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        {...bindMicroHelp('image')}
                        className={`${btnBase} group hover:bg-blue-50 hover:shadow-sm`}
                        title={t.canvas.addImage}
                    >
                        <img
                            src={toolbarIconPath('toolbar-image.svg')}
                            alt="Add Image"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} group-hover:scale-[1.04]`}
                            style={getIconStyle(false, 'toolbar-image.svg')}
                            onMouseEnter={(event) => {
                                event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Add Text */}
                    <div ref={textMenuRef} className="relative">
                        <button
                            onClick={() => setIsTextMenuOpen((previous) => !previous)}
                            {...bindMicroHelp('text')}
                            className={`${getToolButtonClass(textButtonActive)} group`}
                            title={t.canvas.addText}
                        >
                            <img
                                src={toolbarIconPath('toolbar-text.svg')}
                                alt="Add Text"
                                width={22}
                                height={22}
                                className={`${toolbarIconBaseClass} ${textButtonActive ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                                style={getIconStyle(textButtonActive, 'toolbar-text.svg')}
                                onMouseEnter={(event) => {
                                    if (!textButtonActive) event.currentTarget.style.filter = hoverIconFilter;
                                }}
                                onMouseLeave={(event) => {
                                    if (!textButtonActive) event.currentTarget.style.filter = idleIconFilter;
                                }}
                            />
                        </button>

                        {isTextMenuOpen && (
                            <div className="absolute bottom-[calc(100%+12px)] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-slate-200 bg-white/98 p-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                                <button
                                    type="button"
                                    onClick={() => handleStartTextInsert('card')}
                                    aria-label={t.canvas.addTextCard}
                                    title={t.canvas.addTextCard}
                                    className={`${textOptionBaseClass} ${pendingTextInsertVariant === 'card' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-[#F7F9FC] text-slate-700">
                                        {textVariantIconPath('card') ? (
                                            <img
                                                src={textVariantIconPath('card') ?? undefined}
                                                alt=""
                                                aria-hidden="true"
                                                width={18}
                                                height={18}
                                                className="transition-transform duration-200 ease-out"
                                                style={{ filter: isExperimentMode ? 'none' : idleIconFilter }}
                                            />
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                                <rect x="3.5" y="3.5" width="13" height="13" rx="3" fill="#EAF1FF" stroke="#94A3B8" />
                                                <path d="M6.5 8.25H13.5M6.5 10.5H12.75M6.5 12.75H11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                                            </svg>
                                        )}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleStartTextInsert('plain')}
                                    aria-label={t.canvas.addTextPlain}
                                    title={t.canvas.addTextPlain}
                                    className={`${textOptionBaseClass} ${pendingTextInsertVariant === 'plain' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-[#F8FBF5] text-slate-700">
                                        {textVariantIconPath('plain') ? (
                                            <img
                                                src={textVariantIconPath('plain') ?? undefined}
                                                alt=""
                                                aria-hidden="true"
                                                width={18}
                                                height={18}
                                                className="transition-transform duration-200 ease-out"
                                                style={{ filter: isExperimentMode ? 'none' : idleIconFilter }}
                                            />
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                                <path d="M3.75 13.5C5.1 11.15 6.45 9.85 7.8 9.85C9.65 9.85 9.15 14.75 11.25 14.75C12.35 14.75 13.5 13.35 16.25 8.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M12.5 6.5L15.9 4.25L16.85 8.05" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* AI Chat Button - Next to toolbar, same height */}
            <div className={`flex items-center rounded-xl border border-gray-100 bg-white/98 px-2.5 py-1.5 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)] transition-all duration-200 ease-out ${getTourGroupClass('ai')} ${getTourMutedClass('ai')}`}>
                <button
                    onClick={handleAddNode}
                    {...bindMicroHelp('ai')}
                    className={`${btnBase} group hover:bg-blue-50 hover:shadow-sm`}
                    title={t.canvas.addAIChat}
                >
                    <img
                        src={toolbarIconPath('toolbar-chat.svg')}
                        alt="Add AI Chat"
                        width={22}
                        height={22}
                        className={`${toolbarIconBaseClass} group-hover:scale-[1.04]`}
                        style={getIconStyle(false, 'toolbar-chat.svg')}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.filter = hoverIconFilter;
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.filter = idleIconFilter;
                        }}
                    />
                </button>
            </div>

            {/* Image Limit Alert Toast */}
            {showLimitAlert && !hasUnlimitedImageNodes && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg animate-in slide-in-from-bottom-2 z-[100] pointer-events-auto whitespace-nowrap">
                    <p className="text-sm font-medium text-amber-800 mb-1">
                        ⚠️ Batas gambar tercapai ({getImageNodeLimit()} maks)
                    </p>
                    <p className="text-xs text-amber-600 mb-2">
                        Upgrade paket untuk tambah gambar sepuasnya.
                    </p>
                    <button
                        onClick={() => {
                            setShowLimitAlert(false);
                            router.push('/pricing');
                        }}
                        className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        Lihat Paket Upgrade
                    </button>
                </div>
            )}
            </div>
        </>
    );
}
