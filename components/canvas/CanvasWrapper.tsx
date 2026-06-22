"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    MiniMap,
    ReactFlowProvider,
    SelectionMode,
    useReactFlow,
    Connection,
    Edge,
    addEdge,
    ConnectionMode,
} from 'reactflow';
import MindNode from './MindNode';
import AIInputNode from './AIInputNode';
import ImageNode from './ImageNode';
import TextNode from './TextNode';
import DrawingLayer from './DrawingLayer';
import ArrowLayer from './ArrowLayer';
import FrameLayer from './FrameLayer';
import ExperimentEdge from './ExperimentEdge';
import { useMindStore } from '@/store/useMindStore';
import { useCreditStore } from '@/store/useCreditStore';
import { extractFramesFromPersistedNodes, getPersistableEdges, getPersistableNodes, serializeWorkspaceNodes, useWorkspaceStore, setCurrentViewport, isTransientWorkspaceNetworkError } from '@/store/useWorkspaceStore';
import { GuestLimitModal } from '../ui/GuestLimitModal';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { getImageNodeLimit, hasUnlimitedImageNodesForTier } from '@/lib/creditCosts';
import CanvasContextMenu from './CanvasContextMenu';
import { supabase } from '@/lib/supabase';
import { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion, ImageUploadResult, Workspace, WorkspaceShareAccessRole } from '@/types';
import { isExperimentModeEnabled } from '@/lib/experimentMode';
import { clearTextSelection } from '@/lib/textHighlights';
import type { PublicWorkspaceBoardPayload } from '@/lib/workspaceSharing';


// Custom node types registration
// Memoized explicitly outside to absolutely prevent React Flow warnings
const nodeTypes = {
    mindNode: MindNode,
    aiInput: AIInputNode,
    imageNode: ImageNode,
    textNode: TextNode,
};

// Edge types memoized outside render to prevent React Flow warnings
const edgeTypes = {
    experimentEdge: ExperimentEdge,
};

const PUBLIC_BOARD_POLL_INTERVAL_MS = 2500;

const sanitizeNodes = (nodes: unknown[]): CanvasNodeType[] => {
    if (!Array.isArray(nodes)) return [];

    return nodes.map((node) => {
        const safeNode = { ...(node as Record<string, unknown>) } as CanvasNodeType;

        if (!safeNode.position) {
            safeNode.position = { x: 0, y: 0 };
        }

        safeNode.position.x =
            typeof safeNode.position.x === 'number' && Number.isFinite(safeNode.position.x)
                ? safeNode.position.x
                : 0;
        safeNode.position.y =
            typeof safeNode.position.y === 'number' && Number.isFinite(safeNode.position.y)
                ? safeNode.position.y
                : 0;

        if (safeNode.width !== undefined && (typeof safeNode.width !== 'number' || !Number.isFinite(safeNode.width))) {
            delete safeNode.width;
        }

        if (safeNode.height !== undefined && (typeof safeNode.height !== 'number' || !Number.isFinite(safeNode.height))) {
            delete safeNode.height;
        }

        return safeNode;
    });
};

const sanitizeEdges = (edges: unknown[]): Edge[] => {
    if (!Array.isArray(edges)) return [];
    return edges.map((edge) => ({ ...(edge as Edge) }));
};

type CloudWorkspaceRow = {
    id: string;
    name: string;
    nodes: unknown[];
    edges: unknown[];
    strokes: unknown[];
    arrows: unknown[];
    viewport_x?: number | null;
    viewport_y?: number | null;
    viewport_zoom?: number | null;
    created_at?: string;
    updated_at?: string;
    is_favorite?: boolean;
};

const sanitizeStrokes = (strokes: unknown[]): DrawingStroke[] => {
    if (!Array.isArray(strokes)) return [];
    return strokes.map((stroke) => ({ ...(stroke as DrawingStroke) }));
};

const sanitizeArrows = (arrows: unknown[]): ArrowShape[] => {
    if (!Array.isArray(arrows)) return [];
    return arrows.map((arrow) => ({ ...(arrow as ArrowShape) }));
};

const sanitizeFrames = (frames: unknown[]): FrameRegion[] => {
    if (!Array.isArray(frames)) return [];

    return frames
        .map((frame) => {
            if (typeof frame !== 'object' || frame === null) return null;
            const value = frame as Partial<FrameRegion>;
            if (
                typeof value.id !== 'string' ||
                typeof value.x !== 'number' ||
                typeof value.y !== 'number' ||
                typeof value.width !== 'number' ||
                typeof value.height !== 'number'
            ) {
                return null;
            }

            return {
                id: value.id,
                x: value.x,
                y: value.y,
                width: value.width,
                height: value.height,
                createdAt: value.createdAt ? new Date(value.createdAt) : new Date(),
                updatedAt: value.updatedAt ? new Date(value.updatedAt) : new Date(),
            } satisfies FrameRegion;
        })
        .filter((frame): frame is FrameRegion => Boolean(frame));
};

const createFrameRect = (
    start: { x: number; y: number },
    end: { x: number; y: number }
): Omit<FrameRegion, 'id' | 'createdAt' | 'updatedAt'> => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
});

const parseDownloadUrl = (downloadUrl: string): { mimeType: string; fileName: string; url: string } | null => {
    const firstColon = downloadUrl.indexOf(':');
    const secondColon = downloadUrl.indexOf(':', firstColon + 1);

    if (firstColon === -1 || secondColon === -1) return null;

    return {
        mimeType: downloadUrl.slice(0, firstColon),
        fileName: downloadUrl.slice(firstColon + 1, secondColon),
        url: downloadUrl.slice(secondColon + 1),
    };
};

const fileNameFromUrl = (url: string) => {
    try {
        const { pathname } = new URL(url);
        return pathname.split('/').pop() || 'downloaded-image';
    } catch {
        return 'downloaded-image';
    }
};

const fetchImageUrlAsFile = async (imageUrl: string, suggestedFileName?: string): Promise<File | null> => {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) return null;

        const fileName = suggestedFileName || fileNameFromUrl(imageUrl);
        return new File([blob], fileName, { type: blob.type });
    } catch {
        return null;
    }
};

const extractDroppedImageFile = async (dataTransfer: DataTransfer): Promise<File | null> => {
    if (dataTransfer.files && dataTransfer.files.length > 0) {
        const imageFile = Array.from(dataTransfer.files).find((file) => file.type.startsWith('image/'));
        if (imageFile) return imageFile;
    }

    if (dataTransfer.items && dataTransfer.items.length > 0) {
        const imageItem = Array.from(dataTransfer.items).find((item) => item.kind === 'file' && item.type.startsWith('image/'));
        const itemFile = imageItem?.getAsFile();
        if (itemFile) return itemFile;
    }

    const downloadUrl = dataTransfer.getData('DownloadURL');
    if (downloadUrl) {
        const parsed = parseDownloadUrl(downloadUrl);
        if (parsed && parsed.mimeType.startsWith('image/')) {
            const fetchedFile = await fetchImageUrlAsFile(parsed.url, parsed.fileName);
            if (fetchedFile) return fetchedFile;
        }
    }

    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
        const firstUrl = uriList
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith('#'));

        if (firstUrl) {
            const fetchedFile = await fetchImageUrlAsFile(firstUrl);
            if (fetchedFile) return fetchedFile;
        }
    }

    const plainTextUrl = dataTransfer.getData('text/plain');
    if (plainTextUrl && /^https?:\/\//i.test(plainTextUrl.trim())) {
        const fetchedFile = await fetchImageUrlAsFile(plainTextUrl.trim());
        if (fetchedFile) return fetchedFile;
    }

    return null;
};

type PublicBoardResponse = {
    board?: PublicWorkspaceBoardPayload;
};

type PublicBoardSaveResponse = {
    ok?: boolean;
    updatedAt?: string;
};

const getSupabaseAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
};

type BoardDeltaSnapshot = {
    nodes: Map<string, CanvasNodeType>;
    edges: Map<string, Edge>;
    frames: Map<string, FrameRegion>;
    strokes: Map<string, DrawingStroke>;
    arrows: Map<string, ArrowShape>;
};

type BoardDeltaPayload = {
    boardId: string;
    senderId: string;
    version: number;
    upserts: {
        nodes: CanvasNodeType[];
        edges: Edge[];
        frames: FrameRegion[];
        strokes: DrawingStroke[];
        arrows: ArrowShape[];
    };
    removes: {
        nodeIds: string[];
        edgeIds: string[];
        frameIds: string[];
        strokeIds: string[];
        arrowIds: string[];
    };
};

const toEntityMap = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));

const serializeFrameForDelta = (frame: FrameRegion): FrameRegion => ({
    ...frame,
    createdAt: frame.createdAt instanceof Date ? frame.createdAt : new Date(frame.createdAt),
    updatedAt: frame.updatedAt instanceof Date ? frame.updatedAt : new Date(frame.updatedAt),
});

const createBoardDeltaSnapshot = (
    nodes: CanvasNodeType[],
    edges: Edge[],
    frames: FrameRegion[],
    strokes: DrawingStroke[],
    arrows: ArrowShape[]
): BoardDeltaSnapshot => ({
    nodes: toEntityMap(getPersistableNodes(nodes)),
    edges: toEntityMap(getPersistableEdges(edges)),
    frames: toEntityMap(frames.map(serializeFrameForDelta)),
    strokes: toEntityMap(sanitizeStrokes(strokes)),
    arrows: toEntityMap(sanitizeArrows(arrows)),
});

const mapChangedItems = <T extends { id: string }>(previous: Map<string, T>, next: Map<string, T>): T[] => {
    const changed: T[] = [];

    next.forEach((nextItem, id) => {
        const previousItem = previous.get(id);
        if (!previousItem || JSON.stringify(previousItem) !== JSON.stringify(nextItem)) {
            changed.push(nextItem);
        }
    });

    return changed;
};

const mapRemovedIds = <T extends { id: string }>(previous: Map<string, T>, next: Map<string, T>): string[] => {
    const removed: string[] = [];

    previous.forEach((_item, id) => {
        if (!next.has(id)) {
            removed.push(id);
        }
    });

    return removed;
};

const createBoardDeltaPayload = (
    previous: BoardDeltaSnapshot,
    next: BoardDeltaSnapshot,
    boardId: string,
    senderId: string,
    version: number
): BoardDeltaPayload | null => {
    const payload: BoardDeltaPayload = {
        boardId,
        senderId,
        version,
        upserts: {
            nodes: mapChangedItems(previous.nodes, next.nodes),
            edges: mapChangedItems(previous.edges, next.edges),
            frames: mapChangedItems(previous.frames, next.frames),
            strokes: mapChangedItems(previous.strokes, next.strokes),
            arrows: mapChangedItems(previous.arrows, next.arrows),
        },
        removes: {
            nodeIds: mapRemovedIds(previous.nodes, next.nodes),
            edgeIds: mapRemovedIds(previous.edges, next.edges),
            frameIds: mapRemovedIds(previous.frames, next.frames),
            strokeIds: mapRemovedIds(previous.strokes, next.strokes),
            arrowIds: mapRemovedIds(previous.arrows, next.arrows),
        },
    };

    const hasChanges =
        payload.upserts.nodes.length > 0 ||
        payload.upserts.edges.length > 0 ||
        payload.upserts.frames.length > 0 ||
        payload.upserts.strokes.length > 0 ||
        payload.upserts.arrows.length > 0 ||
        payload.removes.nodeIds.length > 0 ||
        payload.removes.edgeIds.length > 0 ||
        payload.removes.frameIds.length > 0 ||
        payload.removes.strokeIds.length > 0 ||
        payload.removes.arrowIds.length > 0;

    return hasChanges ? payload : null;
};

const mayContainImageData = (dataTransfer: DataTransfer) => {
    if (Array.from(dataTransfer.files ?? []).some((file) => file.type.startsWith('image/'))) {
        return true;
    }

    if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === 'file' && item.type.startsWith('image/'))) {
        return true;
    }

    const downloadUrl = dataTransfer.getData('DownloadURL');
    if (downloadUrl) {
        const parsed = parseDownloadUrl(downloadUrl);
        if (parsed?.mimeType.startsWith('image/')) {
            return true;
        }
    }

    const uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
        return true;
    }

    const plainTextUrl = dataTransfer.getData('text/plain');
    return /^https?:\/\//i.test(plainTextUrl.trim());
};

const isEditablePasteTarget = (target: EventTarget | null) => {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) return false;

    return Boolean(
        element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-lexical-editor="true"]')
        || element.isContentEditable
    );
};

interface CanvasInnerProps {
    initialViewport: { x: number; y: number; zoom: number };
    accessMode: WorkspaceShareAccessRole | 'owner';
    sharedToken?: string;
    sharedBoardId?: string;
    onSharedAccessRevoked?: () => void;
}

/**
 * Inner canvas component that uses the React Flow hooks
 * Must be wrapped in ReactFlowProvider
 */
function CanvasInner({
    initialViewport,
    accessMode,
    sharedToken,
    sharedBoardId,
    onSharedAccessRevoked,
}: CanvasInnerProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const isExperimentSandbox = isExperimentModeEnabled();
    const useExperimentUi = true;
    const currentTier = useCreditStore(state => state.currentTier);
    const hasUnlimitedImageNodes = hasUnlimitedImageNodesForTier(currentTier);
    const saveCurrentWorkspace = useWorkspaceStore(state => state.saveCurrentWorkspace);
    const saveCurrentViewport = useWorkspaceStore(state => state.saveCurrentViewport);
    const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
    const userId = useWorkspaceStore(state => state.userId);
    
    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
    const [isInteractionActive, setIsInteractionActive] = React.useState(false);
    const [stableDefaultViewport] = React.useState(() => (
        initialViewport && Number.isFinite(initialViewport.zoom) && initialViewport.zoom > 0
            ? initialViewport
            : { x: 0, y: 0, zoom: 1 }
    ));
    const [backgroundViewport, setBackgroundViewport] = React.useState(stableDefaultViewport);
    const canvasShellRef = useRef<HTMLDivElement>(null);
    const hoverRafRef = useRef<number | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [draftFrame, setDraftFrame] = useState<Omit<FrameRegion, 'id' | 'createdAt' | 'updatedAt'> | null>(null);

    // Canvas readiness state to hide initialization blink
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    const {
        nodes,
        edges,
        frames,
        selectedFrameId,
        strokes,
        arrows,
        onNodesChange,
        onEdgesChange,
        addRootNode,
        addTextNode,
        pendingTextInsertVariant,
        setPendingTextInsertVariant,
        addImageNode,
        addFrame,
        updateFrame,
        deleteFrame,
        selectFrame,
        spawnFrameAIInput,
        attachFrameToNode,
        disconnectFrameLink,
        tool,
        viewportCenter,
        setViewportCenter,
        highlightedEdgeId,
        clipboard,
        copySelection,
        cutSelection,
        pasteSelection,
        duplicateSelection,
        guestLimitReason,
        setGuestLimitReason,
    } = useMindStore();

    const { screenToFlowPosition, getViewport, setViewport, zoomIn, zoomOut } = useReactFlow();

    const frameLinkedNodes = React.useMemo(
        () => nodes.filter((node) => {
            if (node.type === 'aiInput') {
                return Boolean(node.data && 'contextFrameId' in node.data && node.data.contextFrameId);
            }

            if (node.type === 'mindNode') {
                return Boolean(node.data && 'sourceFrameId' in node.data && node.data.sourceFrameId);
            }

            return false;
        }),
        [nodes]
    );
    const selectedNodeIds = React.useMemo(
        () => nodes.filter((node) => node.selected).map((node) => node.id),
        [nodes]
    );
    const isNodeInteractionActive = React.useMemo(
        () => nodes.some((node) => node.dragging || node.resizing),
        [nodes]
    );
    const hasUploadingImages = React.useMemo(() => (
        nodes.some((node) => node.type === 'imageNode' && (node.data as { isUploading?: boolean }).isUploading === true)
    ), [nodes]);
    const isPerformanceInteractionActive = isInteractionActive || isNodeInteractionActive;
    const isSharedViewer = accessMode === 'viewer';
    const sharedSaveEndpoint = sharedToken
        ? `/api/public/board/${sharedToken}`
        : sharedBoardId
            ? `/api/public/board-by-id/${sharedBoardId}`
            : null;
    const isSharedEditor = accessMode === 'editor' && Boolean(sharedSaveEndpoint);
    const canMutateBoard = accessMode === 'owner' || accessMode === 'editor';

    // Track zoom level for display
    const [zoomLevel, setZoomLevel] = React.useState(1);

    // Track connection state for handle visibility
    const [isConnecting, setIsConnecting] = React.useState(false);
    // Track mouse position when a connection drag starts (to detect clicks vs real drags)
    const connectStartPos = React.useRef<{ x: number; y: number } | null>(null);
    const connectCurrentPos = React.useRef<{ x: number; y: number } | null>(null);
    const frameDragStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const frameMoveRef = React.useRef<{
        frameId: string;
        startFlowPosition: { x: number; y: number };
        startFramePosition: { x: number; y: number };
        hasMoved: boolean;
    } | null>(null);
    const skipNextAutosaveRef = React.useRef(true);
    const lastAppliedCloudUpdateRef = React.useRef<string | null>(null);
    const lastAppliedPublicUpdateRef = React.useRef<string | null>(null);
    const lastKnownCloudUpdatedAtRef = React.useRef(0);
    const hasPendingLocalChangesRef = React.useRef(false);
    const latestSaveRequestRef = React.useRef(0);
    const boardUpdateChannelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(null);
    const [realtimeClientId] = React.useState(() => (
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `client-${Math.random().toString(36).slice(2)}-${Date.now()}`
    ));
    const realtimeClientIdRef = React.useRef(realtimeClientId);
    const deltaVersionRef = React.useRef(0);
    const lastDeltaSnapshotRef = React.useRef<BoardDeltaSnapshot | null>(null);
    const deltaBroadcastTimerRef = React.useRef<number | null>(null);
    const isApplyingRemoteDeltaRef = React.useRef(false);
    const receivedDeltaVersionsRef = React.useRef<Map<string, number>>(new Map());
    const lastAutosaveSnapshotRef = React.useRef<{
        nodes: string;
        edges: string;
        frames: string;
        strokes: string;
        arrows: string;
    } | null>(null);
    const interactionReleaseTimeoutRef = React.useRef<number | null>(null);
    const pendingTextInsertRafRef = React.useRef<number | null>(null);

    const getViewportMetrics = useCallback((viewport: { x: number; y: number; zoom: number }) => {
        const rect = canvasShellRef.current?.getBoundingClientRect();
        const width = rect?.width ?? window.innerWidth;
        const height = rect?.height ?? window.innerHeight;

        return {
            centerX: (-viewport.x + width / 2) / viewport.zoom,
            centerY: (-viewport.y + height / 2) / viewport.zoom,
            zoom: viewport.zoom,
        };
    }, []);

    React.useEffect(() => {
        const focusSearchNode = (event: Event) => {
            const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
            if (!nodeId) return;

            const node = useMindStore.getState().nodes.find((item) => item.id === nodeId);
            if (!node) return;

            const rect = canvasShellRef.current?.getBoundingClientRect();
            const canvasWidth = rect?.width ?? window.innerWidth;
            const canvasHeight = rect?.height ?? window.innerHeight;
            const viewport = getViewport();
            const fallbackSize = node.type === 'textNode'
                ? { width: 240, height: 160 }
                : { width: 350, height: 240 };
            const nodeWidth = typeof node.width === 'number' && node.width > 0
                ? node.width
                : fallbackSize.width;
            const nodeHeight = typeof node.height === 'number' && node.height > 0
                ? node.height
                : fallbackSize.height;
            const nextViewport = {
                x: canvasWidth / 2 - (node.position.x + nodeWidth / 2) * viewport.zoom,
                y: canvasHeight / 2 - (node.position.y + nodeHeight / 2) * viewport.zoom,
                zoom: viewport.zoom,
            };

            setViewport(nextViewport, { duration: 320 });
        };

        window.addEventListener('canvas:focus-search-node', focusSearchNode);
        return () => {
            window.removeEventListener('canvas:focus-search-node', focusSearchNode);
        };
    }, [getViewport, setViewport]);

    const showImageUploadFeedback = useCallback((result: ImageUploadResult) => {
        if (result === 'limit-reached') {
            if (isExperimentSandbox) {
                setUploadNotice('Upload gambar eksperimen sedang penuh atau belum siap. Coba lagi.');
                setTimeout(() => setUploadNotice(null), 4000);
                return;
            }
            setShowLimitAlert(true);
            setTimeout(() => setShowLimitAlert(false), 4000);
            return;
        }

        if (result === 'file-too-large') {
            setUploadNotice('Gambar terlalu besar. Maksimal 2 MB.');
            setTimeout(() => setUploadNotice(null), 4000);
            return;
        }

        if (result === 'storage-full') {
            setUploadNotice('Storage upload Anda sudah penuh. Hapus beberapa gambar untuk lanjut upload.');
            setTimeout(() => setUploadNotice(null), 4000);
            return;
        }

        if (result === 'upload-failed') {
            setUploadNotice('Gagal upload gambar. Coba lagi.');
            setTimeout(() => setUploadNotice(null), 4000);
        }
    }, [isExperimentSandbox]);

    // Prevent default Browser Zoom (Ctrl + Wheel/Scroll) and Gestures
    React.useEffect(() => {
        const preventDefaultZoom = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        };
        const preventGesture = (e: Event) => e.preventDefault();

        window.addEventListener('wheel', preventDefaultZoom, { passive: false });
        window.addEventListener('gesturestart', preventGesture);
        window.addEventListener('gesturechange', preventGesture);

        return () => {
            window.removeEventListener('wheel', preventDefaultZoom);
            window.removeEventListener('gesturestart', preventGesture);
            window.removeEventListener('gesturechange', preventGesture);
        };
    }, []);

    // Subscribe to pendingViewport changes and apply them
    const pendingViewport = useMindStore(state => state.pendingViewport);
    const setPendingViewport = useMindStore(state => state.setPendingViewport);

    const lastHandledPendingViewportKeyRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!pendingViewport) {
            lastHandledPendingViewportKeyRef.current = null;
            return;
        }

        const safeX = Number.isFinite(pendingViewport.x) ? pendingViewport.x : 0;
        const safeY = Number.isFinite(pendingViewport.y) ? pendingViewport.y : 0;
        const safeZoom = Number.isFinite(pendingViewport.zoom) && pendingViewport.zoom > 0 ? pendingViewport.zoom : 1;
        const sanitizedViewport = { x: safeX, y: safeY, zoom: safeZoom };
        const viewportKey = `${safeX}:${safeY}:${safeZoom}`;

        if (lastHandledPendingViewportKeyRef.current === viewportKey) {
            return;
        }

        lastHandledPendingViewportKeyRef.current = viewportKey;
        setPendingViewport(null);

        requestAnimationFrame(() => {
            setViewport(sanitizedViewport);
            setBackgroundViewport(sanitizedViewport);
            const metrics = getViewportMetrics(sanitizedViewport);
            setViewportCenter({ x: metrics.centerX, y: metrics.centerY });
            setZoomLevel(metrics.zoom);
            setCurrentViewport(sanitizedViewport);
        });
    }, [getViewportMetrics, pendingViewport, setPendingViewport, setViewport, setViewportCenter]);

    React.useEffect(() => {
        skipNextAutosaveRef.current = true;
        lastKnownCloudUpdatedAtRef.current = 0;
        lastAutosaveSnapshotRef.current = null;
        lastDeltaSnapshotRef.current = null;
        deltaVersionRef.current = 0;
        receivedDeltaVersionsRef.current.clear();
        if (deltaBroadcastTimerRef.current !== null) {
            window.clearTimeout(deltaBroadcastTimerRef.current);
            deltaBroadcastTimerRef.current = null;
        }
    }, [activeWorkspaceId]);

    const startInteraction = React.useCallback(() => {
        if (interactionReleaseTimeoutRef.current !== null) {
            window.clearTimeout(interactionReleaseTimeoutRef.current);
            interactionReleaseTimeoutRef.current = null;
        }

        canvasShellRef.current?.style.setProperty('--canvas-hover-opacity', '0');
        setIsInteractionActive(true);
    }, []);

    const stopInteractionSoon = React.useCallback(() => {
        if (interactionReleaseTimeoutRef.current !== null) {
            window.clearTimeout(interactionReleaseTimeoutRef.current);
        }

        interactionReleaseTimeoutRef.current = window.setTimeout(() => {
            setIsInteractionActive(false);
            interactionReleaseTimeoutRef.current = null;
        }, 120);
    }, []);

    const syncViewportState = useCallback((viewport: { x: number; y: number; zoom: number }) => {
        setBackgroundViewport(viewport);
        const metrics = getViewportMetrics(viewport);
        setViewportCenter({ x: metrics.centerX, y: metrics.centerY });
        setZoomLevel(metrics.zoom);
        setCurrentViewport(viewport);
    }, [getViewportMetrics, setViewportCenter]);

    const broadcastBoardUpdate = useCallback(() => {
        const channel = boardUpdateChannelRef.current;
        if (!channel || !activeWorkspaceId) return;

        void channel
            .send({
                type: 'broadcast',
                event: 'board-updated',
                payload: {
                    boardId: activeWorkspaceId,
                    senderId: realtimeClientIdRef.current,
                    updatedAt: Date.now(),
                },
            })
            .catch((error) => {
                console.warn('Realtime board update broadcast failed:', error);
            });
    }, [activeWorkspaceId]);

    const saveActiveBoard = useCallback(async (immediate = false) => {
        if (isSharedViewer) {
            return;
        }

        if (isSharedEditor && sharedSaveEndpoint) {
            const viewport = getViewport();
            const authHeaders = await getSupabaseAuthHeaders();
            const response = await fetch(sharedSaveEndpoint, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders,
                },
                body: JSON.stringify({
                    nodes: serializeWorkspaceNodes(nodes, frames),
                    edges: getPersistableEdges(edges),
                    strokes,
                    arrows,
                    viewport,
                    immediate,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to save shared board');
            }

            const payload = await response.json().catch(() => ({})) as PublicBoardSaveResponse;
            const savedUpdatedAtMs = payload.updatedAt ? new Date(payload.updatedAt).getTime() : 0;
            if (savedUpdatedAtMs) {
                lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, savedUpdatedAtMs);
                lastAppliedPublicUpdateRef.current = payload.updatedAt ?? lastAppliedPublicUpdateRef.current;
            }

            broadcastBoardUpdate();
            return;
        }

        await saveCurrentWorkspace(immediate);
        broadcastBoardUpdate();
    }, [arrows, broadcastBoardUpdate, edges, frames, getViewport, isSharedEditor, isSharedViewer, nodes, saveCurrentWorkspace, sharedSaveEndpoint, strokes]);

    React.useEffect(() => {
        if (!isConnecting) return;

        const updatePosition = (clientX: number, clientY: number) => {
            connectCurrentPos.current = { x: clientX, y: clientY };
        };

        const handleMouseMove = (event: MouseEvent) => {
            updatePosition(event.clientX, event.clientY);
        };

        const handleTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            updatePosition(touch.clientX, touch.clientY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove, { passive: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, [isConnecting]);

    React.useEffect(() => () => {
        if (interactionReleaseTimeoutRef.current !== null) {
            window.clearTimeout(interactionReleaseTimeoutRef.current);
        }
        if (pendingTextInsertRafRef.current !== null) {
            cancelAnimationFrame(pendingTextInsertRafRef.current);
        }
    }, []);

    const markPendingLocalChanges = useCallback(() => {
        hasPendingLocalChangesRef.current = true;
    }, []);

    const clearPendingLocalChanges = useCallback(() => {
        hasPendingLocalChangesRef.current = false;
    }, []);

    React.useEffect(() => {
        if (!hasUploadingImages) return;

        hasPendingLocalChangesRef.current = true;
    }, [hasUploadingImages]);

    React.useEffect(() => {
        if (!canMutateBoard) return;
        if (tool === 'frame') return;

        frameDragStartRef.current = null;
        frameMoveRef.current = null;
        setDraftFrame(null);
    }, [canMutateBoard, tool]);

    React.useEffect(() => {
        if (!canMutateBoard) return;

        const handleMouseMove = (event: MouseEvent) => {
            const frameMoveState = frameMoveRef.current;
            if (frameMoveState) {
                const current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                const deltaX = current.x - frameMoveState.startFlowPosition.x;
                const deltaY = current.y - frameMoveState.startFlowPosition.y;

                frameMoveState.hasMoved = frameMoveState.hasMoved || Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
                updateFrame(frameMoveState.frameId, {
                    x: frameMoveState.startFramePosition.x + deltaX,
                    y: frameMoveState.startFramePosition.y + deltaY,
                });
                return;
            }

            if (tool !== 'frame') return;

            const start = frameDragStartRef.current;
            if (!start) return;

            const current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            setDraftFrame(createFrameRect(start, current));
        };

        const handleMouseUp = (event: MouseEvent) => {
            const frameMoveState = frameMoveRef.current;
            if (frameMoveState) {
                frameMoveRef.current = null;
                if (frameMoveState.hasMoved) {
                    markPendingLocalChanges();
                }
                return;
            }

            if (tool !== 'frame') return;

            const start = frameDragStartRef.current;
            frameDragStartRef.current = null;

            if (!start) {
                setDraftFrame(null);
                return;
            }

            const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            const nextFrame = createFrameRect(start, end);
            setDraftFrame(null);

            if (nextFrame.width < 40 || nextFrame.height < 40) {
                return;
            }

            addFrame(nextFrame);
            markPendingLocalChanges();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [addFrame, canMutateBoard, markPendingLocalChanges, screenToFlowPosition, tool, updateFrame]);

    React.useEffect(() => {
        if (!canMutateBoard) return;
        if (!selectedFrameId) return;

        const handleDeleteFrame = (event: KeyboardEvent) => {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return;

            const activeElement = document.activeElement as HTMLElement | null;
            if (
                activeElement &&
                (
                    activeElement.tagName === 'INPUT' ||
                    activeElement.tagName === 'TEXTAREA' ||
                    activeElement.isContentEditable
                )
            ) {
                return;
            }

            event.preventDefault();
            deleteFrame(selectedFrameId);
            markPendingLocalChanges();
        };

        window.addEventListener('keydown', handleDeleteFrame);

        return () => {
            window.removeEventListener('keydown', handleDeleteFrame);
        };
    }, [canMutateBoard, deleteFrame, markPendingLocalChanges, selectedFrameId]);

    React.useEffect(() => {
        if (!isCanvasReady || !activeWorkspaceId) return;
        if (isInteractionActive || isNodeInteractionActive) return;

        const computeSnapshot = () => ({
            nodes: JSON.stringify(getPersistableNodes(nodes)),
            edges: JSON.stringify(getPersistableEdges(edges)),
            frames: JSON.stringify(
                frames.map((frame) => ({
                    ...frame,
                    createdAt: frame.createdAt instanceof Date ? frame.createdAt.toISOString() : frame.createdAt,
                    updatedAt: frame.updatedAt instanceof Date ? frame.updatedAt.toISOString() : frame.updatedAt,
                }))
            ),
            strokes: JSON.stringify(strokes),
            arrows: JSON.stringify(arrows),
        });

        const timer = window.setTimeout(() => {
            const nextSnapshot = computeSnapshot();
            const previousSnapshot = lastAutosaveSnapshotRef.current;

            if (
                previousSnapshot &&
                previousSnapshot.nodes === nextSnapshot.nodes &&
                previousSnapshot.edges === nextSnapshot.edges &&
                previousSnapshot.frames === nextSnapshot.frames &&
                previousSnapshot.strokes === nextSnapshot.strokes &&
                previousSnapshot.arrows === nextSnapshot.arrows
            ) {
                return;
            }

            lastAutosaveSnapshotRef.current = nextSnapshot;

            if (skipNextAutosaveRef.current) {
                skipNextAutosaveRef.current = false;
                return;
            }

            markPendingLocalChanges();
            const saveRequestId = ++latestSaveRequestRef.current;

            saveActiveBoard(false)
                .then(() => {
                    if (latestSaveRequestRef.current === saveRequestId && !hasUploadingImages) {
                        lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, Date.now());
                        clearPendingLocalChanges();
                    }
                })
                .catch((error) => {
                    if (isTransientWorkspaceNetworkError(error)) {
                        console.warn('Autosave cloud sedang tidak tersedia. Perubahan akan dicoba lagi.');
                    } else {
                        console.error(error);
                    }
                    hasPendingLocalChangesRef.current = true;
                });
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [activeWorkspaceId, arrows, clearPendingLocalChanges, edges, frames, hasUploadingImages, isCanvasReady, isInteractionActive, isNodeInteractionActive, markPendingLocalChanges, nodes, saveActiveBoard, strokes]);

    React.useEffect(() => {
        if (!activeWorkspaceId) return;

        const flushSave = () => {
            if (!hasPendingLocalChangesRef.current) return Promise.resolve();

            return saveActiveBoard(true)
                .then(() => {
                    if (!hasUploadingImages) {
                        lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, Date.now());
                        clearPendingLocalChanges();
                    }
                })
                .catch((error) => {
                    if (isTransientWorkspaceNetworkError(error)) {
                        console.warn('Penyimpanan cloud sementara gagal saat flush.');
                    } else {
                        console.error(error);
                    }
                    hasPendingLocalChangesRef.current = true;
                });
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushSave();
            }
        };

        window.addEventListener('pagehide', flushSave);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('pagehide', flushSave);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeWorkspaceId, clearPendingLocalChanges, hasUploadingImages, saveActiveBoard]);

    const applyRemoteWorkspace = useCallback((workspaceRow: CloudWorkspaceRow) => {
        if (!activeWorkspaceId || workspaceRow.id !== activeWorkspaceId) return;
        if (hasPendingLocalChangesRef.current || hasUploadingImages) return;

        const remoteUpdatedAtMs = workspaceRow.updated_at ? new Date(workspaceRow.updated_at).getTime() : 0;

        if (remoteUpdatedAtMs && remoteUpdatedAtMs < lastKnownCloudUpdatedAtRef.current) {
            return;
        }

        const remoteUpdatedAt = workspaceRow.updated_at ?? null;
        if (remoteUpdatedAt && remoteUpdatedAt === lastAppliedCloudUpdateRef.current) return;
        lastAppliedCloudUpdateRef.current = remoteUpdatedAt;
        if (remoteUpdatedAtMs) {
            lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, remoteUpdatedAtMs);
        }

        const extracted = extractFramesFromPersistedNodes(workspaceRow.nodes || []);
        const safeNodes = sanitizeNodes(extracted.nodes || []);
        const safeEdges = sanitizeEdges(workspaceRow.edges || []);
        const safeStrokes = sanitizeStrokes(workspaceRow.strokes || []);
        const safeArrows = sanitizeArrows(workspaceRow.arrows || []);
        lastDeltaSnapshotRef.current = createBoardDeltaSnapshot(
            safeNodes,
            safeEdges,
            extracted.frames,
            safeStrokes,
            safeArrows
        );

        skipNextAutosaveRef.current = true;

        useMindStore.setState({
            nodes: safeNodes,
            edges: safeEdges,
            frames: extracted.frames,
            selectedFrameId: null,
            strokes: safeStrokes,
            arrows: safeArrows,
            strokeHistory: [],
            strokeFuture: [],
        });

        useWorkspaceStore.setState((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id === workspaceRow.id
                    ? {
                        ...workspace,
                        name: workspaceRow.name,
                        nodes: safeNodes,
                        edges: safeEdges,
                        frames: extracted.frames,
                        strokes: safeStrokes,
                        arrows: safeArrows,
                        isFavorite: workspaceRow.is_favorite ?? workspace.isFavorite,
                        createdAt: workspaceRow.created_at ? new Date(workspaceRow.created_at) : workspace.createdAt,
                        updatedAt: workspaceRow.updated_at ? new Date(workspaceRow.updated_at) : new Date(),
                    } satisfies Workspace
                    : workspace
            ),
        }));
    }, [activeWorkspaceId, hasUploadingImages]);

    const applyPublicBoard = useCallback((board: PublicWorkspaceBoardPayload) => {
        if (!activeWorkspaceId || board.boardId !== activeWorkspaceId) return;

        const nextShareUpdatedAt = board.shareUpdatedAt ? new Date(board.shareUpdatedAt) : null;
        useWorkspaceStore.setState((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id === board.boardId
                    ? {
                        ...workspace,
                        name: board.name,
                        shareAccessRole: board.accessRole,
                        allowPublicDuplicate: board.allowDuplicate,
                        shareUpdatedAt: nextShareUpdatedAt,
                    } satisfies Workspace
                    : workspace
            ),
        }));

        if (hasPendingLocalChangesRef.current || hasUploadingImages) return;

        const remoteUpdatedAt = board.updatedAt ?? null;
        const remoteUpdatedAtMs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
        if (remoteUpdatedAtMs && remoteUpdatedAtMs < lastKnownCloudUpdatedAtRef.current) return;
        if (remoteUpdatedAt && remoteUpdatedAt === lastAppliedPublicUpdateRef.current) return;
        lastAppliedPublicUpdateRef.current = remoteUpdatedAt;
        if (remoteUpdatedAtMs) {
            lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, remoteUpdatedAtMs);
        }

        const extracted = extractFramesFromPersistedNodes(board.nodes || []);
        const safeNodes = sanitizeNodes(extracted.nodes || []);
        const safeEdges = sanitizeEdges(board.edges || []);
        const safeFrames = sanitizeFrames(board.frames || []);
        const safeStrokes = sanitizeStrokes(board.strokes || []);
        const safeArrows = sanitizeArrows(board.arrows || []);
        const nextFrames = safeFrames.length > 0 ? safeFrames : extracted.frames;
        const nextUpdatedAt = board.updatedAt ? new Date(board.updatedAt) : new Date();
        lastDeltaSnapshotRef.current = createBoardDeltaSnapshot(
            safeNodes,
            safeEdges,
            nextFrames,
            safeStrokes,
            safeArrows
        );

        skipNextAutosaveRef.current = true;

        useMindStore.setState({
            nodes: safeNodes,
            edges: safeEdges,
            frames: nextFrames,
            selectedFrameId: null,
            strokes: safeStrokes,
            arrows: safeArrows,
            strokeHistory: [],
            strokeFuture: [],
        });

        useWorkspaceStore.setState((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id === board.boardId
                    ? {
                        ...workspace,
                        name: board.name,
                        nodes: safeNodes,
                        edges: safeEdges,
                        frames: nextFrames,
                        strokes: safeStrokes,
                        arrows: safeArrows,
                        shareAccessRole: board.accessRole,
                        allowPublicDuplicate: board.allowDuplicate,
                        shareUpdatedAt: nextShareUpdatedAt,
                        updatedAt: nextUpdatedAt,
                    } satisfies Workspace
                    : workspace
            ),
        }));
    }, [activeWorkspaceId, hasUploadingImages]);

    React.useEffect(() => {
        lastAppliedPublicUpdateRef.current = null;
    }, [activeWorkspaceId, sharedBoardId]);

    React.useEffect(() => {
        if (!sharedBoardId || accessMode === 'owner') return;

        let cancelled = false;
        let inFlightController: AbortController | null = null;

        const refreshPublicBoard = async (force = false) => {
            if (cancelled || document.visibilityState === 'hidden') return;
            if (hasPendingLocalChangesRef.current || hasUploadingImages) return;
            if (inFlightController) {
                if (!force) return;
                inFlightController.abort();
            }

            const controller = new AbortController();
            inFlightController = controller;

            try {
                const response = await fetch(`/api/public/board-by-id/${sharedBoardId}`, {
                    cache: 'no-store',
                    headers: await getSupabaseAuthHeaders(),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    if (response.status === 403 || response.status === 404) {
                        onSharedAccessRevoked?.();
                    }
                    return;
                }

                const payload = await response.json().catch(() => null) as PublicBoardResponse | null;
                if (cancelled || !payload?.board) return;

                applyPublicBoard(payload.board);
            } catch (error) {
                if ((error as DOMException).name !== 'AbortError') {
                    console.error(error);
                }
            } finally {
                if (inFlightController === controller) {
                    inFlightController = null;
                }
            }
        };

        const handleFocusSync = () => {
            refreshPublicBoard(true).catch(console.error);
        };

        const handleVisibilitySync = () => {
            if (document.visibilityState !== 'visible') return;
            refreshPublicBoard(true).catch(console.error);
        };

        refreshPublicBoard(true).catch(console.error);
        const interval = window.setInterval(() => {
            refreshPublicBoard().catch(console.error);
        }, PUBLIC_BOARD_POLL_INTERVAL_MS);

        window.addEventListener('focus', handleFocusSync);
        document.addEventListener('visibilitychange', handleVisibilitySync);

        return () => {
            cancelled = true;
            inFlightController?.abort();
            window.clearInterval(interval);
            window.removeEventListener('focus', handleFocusSync);
            document.removeEventListener('visibilitychange', handleVisibilitySync);
        };
    }, [accessMode, applyPublicBoard, hasUploadingImages, onSharedAccessRevoked, sharedBoardId]);

    const applyRemoteBoardDelta = useCallback((payload: BoardDeltaPayload) => {
        if (!activeWorkspaceId || payload.boardId !== activeWorkspaceId) return;
        if (payload.senderId === realtimeClientIdRef.current) return;

        const lastVersion = receivedDeltaVersionsRef.current.get(payload.senderId) ?? 0;
        if (payload.version <= lastVersion) return;
        receivedDeltaVersionsRef.current.set(payload.senderId, payload.version);

        isApplyingRemoteDeltaRef.current = true;
        skipNextAutosaveRef.current = true;
        lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, Date.now());

        useMindStore.setState((state) => {
            const nodeMap = toEntityMap(getPersistableNodes(state.nodes as CanvasNodeType[]));
            const edgeMap = toEntityMap(getPersistableEdges(state.edges));
            const frameMap = toEntityMap(state.frames.map(serializeFrameForDelta));
            const strokeMap = toEntityMap(state.strokes);
            const arrowMap = toEntityMap(state.arrows);

            payload.removes.nodeIds.forEach((id) => nodeMap.delete(id));
            payload.removes.edgeIds.forEach((id) => edgeMap.delete(id));
            payload.removes.frameIds.forEach((id) => frameMap.delete(id));
            payload.removes.strokeIds.forEach((id) => strokeMap.delete(id));
            payload.removes.arrowIds.forEach((id) => arrowMap.delete(id));

            sanitizeNodes(payload.upserts.nodes).forEach((node) => nodeMap.set(node.id, node));
            sanitizeEdges(payload.upserts.edges).forEach((edge) => edgeMap.set(edge.id, edge));
            sanitizeFrames(payload.upserts.frames).forEach((frame) => frameMap.set(frame.id, frame));
            sanitizeStrokes(payload.upserts.strokes).forEach((stroke) => strokeMap.set(stroke.id, stroke));
            sanitizeArrows(payload.upserts.arrows).forEach((arrow) => arrowMap.set(arrow.id, arrow));

            const nextNodes = Array.from(nodeMap.values());
            const nextEdges = Array.from(edgeMap.values());
            const nextFrames = Array.from(frameMap.values());
            const nextStrokes = Array.from(strokeMap.values());
            const nextArrows = Array.from(arrowMap.values());

            lastDeltaSnapshotRef.current = createBoardDeltaSnapshot(
                nextNodes,
                nextEdges,
                nextFrames,
                nextStrokes,
                nextArrows
            );

            useWorkspaceStore.setState((workspaceState) => ({
                workspaces: workspaceState.workspaces.map((workspace) =>
                    workspace.id === activeWorkspaceId
                        ? {
                            ...workspace,
                            nodes: nextNodes,
                            edges: nextEdges,
                            frames: nextFrames,
                            strokes: nextStrokes,
                            arrows: nextArrows,
                            updatedAt: new Date(),
                        } satisfies Workspace
                        : workspace
                ),
            }));

            return {
                nodes: nextNodes,
                edges: nextEdges,
                frames: nextFrames,
                selectedFrameId: payload.removes.frameIds.includes(state.selectedFrameId || '')
                    ? null
                    : state.selectedFrameId,
                strokes: nextStrokes,
                arrows: nextArrows,
                strokeHistory: [],
                strokeFuture: [],
            };
        });
    }, [activeWorkspaceId]);

    React.useEffect(() => {
        if (!activeWorkspaceId) return;

        let cancelled = false;

        const refreshAfterBroadcast = async () => {
            if (cancelled || document.visibilityState === 'hidden') return;
            if (hasPendingLocalChangesRef.current || hasUploadingImages) return;

            if (accessMode === 'owner' && userId) {
                const { data, error } = await supabase
                    .from('workspaces')
                    .select('*')
                    .eq('id', activeWorkspaceId)
                    .single();

                if (!error && data) {
                    applyRemoteWorkspace(data);
                }
                return;
            }

            if (!sharedBoardId) return;

            const response = await fetch(`/api/public/board-by-id/${sharedBoardId}`, {
                cache: 'no-store',
                headers: await getSupabaseAuthHeaders(),
            });

            if (!response.ok) return;

            const payload = await response.json().catch(() => null) as PublicBoardResponse | null;
            if (!cancelled && payload?.board) {
                applyPublicBoard(payload.board);
            }
        };

        const channel = supabase
            .channel(`board-updates-${activeWorkspaceId}`, {
                config: {
                    broadcast: {
                        self: false,
                    },
                },
            })
            .on('broadcast', { event: 'board-updated' }, (event) => {
                const payload = event.payload as { boardId?: string; senderId?: string } | null;
                if (payload?.senderId === realtimeClientIdRef.current) return;
                if (payload?.boardId && payload.boardId !== activeWorkspaceId) return;

                refreshAfterBroadcast().catch(console.error);
            })
            .on('broadcast', { event: 'board-delta' }, (event) => {
                const payload = event.payload as BoardDeltaPayload | null;
                if (!payload) return;

                applyRemoteBoardDelta(payload);
            })
            .subscribe();

        boardUpdateChannelRef.current = channel;

        return () => {
            cancelled = true;
            if (boardUpdateChannelRef.current === channel) {
                boardUpdateChannelRef.current = null;
            }
            supabase.removeChannel(channel);
        };
    }, [
        accessMode,
        activeWorkspaceId,
        applyRemoteBoardDelta,
        applyPublicBoard,
        applyRemoteWorkspace,
        hasUploadingImages,
        sharedBoardId,
        userId,
    ]);

    React.useEffect(() => {
        if (!activeWorkspaceId || !canMutateBoard) return;

        if (isApplyingRemoteDeltaRef.current) {
            isApplyingRemoteDeltaRef.current = false;
            lastDeltaSnapshotRef.current = createBoardDeltaSnapshot(nodes, edges, frames, strokes, arrows);
            return;
        }

        if (!lastDeltaSnapshotRef.current) {
            lastDeltaSnapshotRef.current = createBoardDeltaSnapshot(nodes, edges, frames, strokes, arrows);
            return;
        }

        if (deltaBroadcastTimerRef.current !== null) return;

        deltaBroadcastTimerRef.current = window.setTimeout(() => {
            deltaBroadcastTimerRef.current = null;

            const channel = boardUpdateChannelRef.current;
            if (!channel) return;
            if (!activeWorkspaceId || !canMutateBoard) return;

            const state = useMindStore.getState();
            const previousSnapshot = lastDeltaSnapshotRef.current;
            const nextSnapshot = createBoardDeltaSnapshot(
                state.nodes as CanvasNodeType[],
                state.edges,
                state.frames,
                state.strokes,
                state.arrows
            );

            if (!previousSnapshot) {
                lastDeltaSnapshotRef.current = nextSnapshot;
                return;
            }

            const payload = createBoardDeltaPayload(
                previousSnapshot,
                nextSnapshot,
                activeWorkspaceId,
                realtimeClientIdRef.current,
                ++deltaVersionRef.current
            );

            lastDeltaSnapshotRef.current = nextSnapshot;

            if (!payload) return;

            void channel
                .send({
                    type: 'broadcast',
                    event: 'board-delta',
                    payload,
                })
                .catch((error) => {
                    console.warn('Realtime board delta broadcast failed:', error);
                });
        }, 80);

    }, [activeWorkspaceId, arrows, canMutateBoard, edges, frames, nodes, strokes]);

    React.useEffect(() => () => {
        if (deltaBroadcastTimerRef.current !== null) {
            window.clearTimeout(deltaBroadcastTimerRef.current);
            deltaBroadcastTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        if (!userId || !activeWorkspaceId) return;

        const refreshActiveWorkspace = async () => {
            if (hasPendingLocalChangesRef.current || hasUploadingImages) return;

            const { data, error } = await supabase
                .from('workspaces')
                .select('*')
                .eq('id', activeWorkspaceId)
                .single();

            if (error || !data) return;
            applyRemoteWorkspace(data);
        };

        const handleVisibilitySync = () => {
            if (document.visibilityState !== 'visible') return;
            refreshActiveWorkspace().catch(console.error);
        };

        const handleFocusSync = () => {
            refreshActiveWorkspace().catch(console.error);
        };

        window.addEventListener('focus', handleFocusSync);
        document.addEventListener('visibilitychange', handleVisibilitySync);

        return () => {
            window.removeEventListener('focus', handleFocusSync);
            document.removeEventListener('visibilitychange', handleVisibilitySync);
        };
    }, [activeWorkspaceId, applyRemoteWorkspace, hasUploadingImages, userId]);

    React.useEffect(() => {
        if (!userId || !activeWorkspaceId) return;

        const channel = supabase
            .channel(`workspace-sync-${activeWorkspaceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'workspaces',
                    filter: `id=eq.${activeWorkspaceId}`,
                },
                (payload) => {
                    const updatedWorkspace = payload.new as CloudWorkspaceRow;

                    applyRemoteWorkspace(updatedWorkspace);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeWorkspaceId, applyRemoteWorkspace, userId]);

    // Listen to custom clipboard/duplicate limitation events
    React.useEffect(() => {
        const handleLimitReached = () => {
            setShowLimitAlert(true);
            setTimeout(() => setShowLimitAlert(false), 4000);
        };

        window.addEventListener('mindnode-limit-reached', handleLimitReached);
        return () => window.removeEventListener('mindnode-limit-reached', handleLimitReached);
    }, []);

    React.useEffect(() => {
        if (!canMutateBoard) return;

        const handlePaste = (event: ClipboardEvent) => {
            if (isEditablePasteTarget(event.target)) return;

            const clipboardData = event.clipboardData;
            if (!clipboardData) return;
            if (!mayContainImageData(clipboardData)) return;

            event.preventDefault();

            void (async () => {
                const pastedImageFile = await extractDroppedImageFile(clipboardData);
                if (!pastedImageFile) return;

                const result = await addImageNode(pastedImageFile, viewportCenter);
                if (result !== 'success') {
                    showImageUploadFeedback(result);
                }
            })();
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [addImageNode, canMutateBoard, showImageUploadFeedback, viewportCenter]);

    // Handle drop from external sources (files or new topics)
    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (!canMutateBoard) return;

            const dataTransfer = event.dataTransfer;
            const clientX = event.clientX;
            const clientY = event.clientY;

            // 1. Handle File Drop (Images / Download History)
            void (async () => {
                const droppedImageFile = await extractDroppedImageFile(dataTransfer);
                if (droppedImageFile) {
                    const position = screenToFlowPosition({
                        x: clientX,
                        y: clientY,
                    });

                    const result = await addImageNode(droppedImageFile, position);
                    if (result !== 'success') {
                        showImageUploadFeedback(result);
                    }
                    return;
                }

                // 2. Handle New Topic Drop (from sidebar/toolbar if implemented later)
                const type = dataTransfer.getData('application/mindnode');
                if (type === 'new-topic') {
                    const position = screenToFlowPosition({
                        x: clientX,
                        y: clientY,
                    });
                    addRootNode(position);
                }
            })();
        },
        [screenToFlowPosition, addRootNode, addImageNode, canMutateBoard, showImageUploadFeedback]
    );

    // Enable drag over for drop to work
    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }, []);

    // Memoize minimap node color function
    const minimapNodeColor = useCallback(() => {
        return '#D7E3FC';
    }, []);

    // Validate connections to prevent accidental/invalid edges
    const isValidConnection = useCallback(
        (connection: Connection) => {
            // 1. Prevent Self-Connections (Looping back to same node)
            if (connection.source === connection.target) return false;

            // 2. Prevent Duplicate Connections
            // Check if an edge already exists between these two points
            const exists = edges.some(e =>
                (e.source === connection.source && e.target === connection.target) ||
                (e.source === connection.target && e.target === connection.source) // Bidirectional check
            );
            if (exists) return false;

            return true;
        },
        [edges]
    );

    // Handle manual edge connections
    // Guard: only create edge if mouse moved >= 15px from where drag started (prevents accidental snapping from a click)
    const onConnect = useCallback(
        (connection: Connection) => {
            if (!canMutateBoard) return;

            const startPos = connectStartPos.current;
            const currentPos = connectCurrentPos.current;

            if (startPos && currentPos) {
                const dx = currentPos.x - startPos.x;
                const dy = currentPos.y - startPos.y;
                const distance = Math.hypot(dx, dy);

                if (distance < 18) {
                    connectStartPos.current = null;
                    connectCurrentPos.current = null;
                    return;
                }
            }

            const newEdge = {
                ...connection,
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
            };
            useMindStore.setState((state) => ({
                edges: addEdge(newEdge, state.edges),
            }));
            connectStartPos.current = null;
            connectCurrentPos.current = null;
        },
        [canMutateBoard]
    );

    // Compute styled edges with highlight class
    const styledEdges = React.useMemo(() => {
        // Find selected node IDs
        const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));

        return edges.map(edge => {
            const existingClassName = edge.className || '';
            let stateClassName = '';
            const sourceSelected = selectedNodeIds.has(edge.source);
            const targetSelected = selectedNodeIds.has(edge.target);

            // Prioritize highlight (disconnect preview)
            if (edge.id === highlightedEdgeId) {
                stateClassName = 'highlighted';
            }
            // Then check for selection connection
            else if (!isNodeInteractionActive && (sourceSelected || targetSelected)) {
                stateClassName = 'animated';
            }

            const className = useExperimentUi
                ? existingClassName
                : [existingClassName, stateClassName].filter(Boolean).join(' ');
            const isActive = stateClassName === 'animated';
            const isHighlighted = stateClassName === 'highlighted';

            return {
                ...edge,
                className,
                type: useExperimentUi ? 'experimentEdge' : edge.type,
                data: useExperimentUi
                    ? {
                        ...(edge.data ?? {}),
                        isActive: !isNodeInteractionActive && (isActive || isHighlighted),
                        isHighlighted,
                    }
                    : edge.data,
            };
        });
    }, [edges, highlightedEdgeId, isNodeInteractionActive, nodes, useExperimentUi]);

    const backgroundScale = Math.max(backgroundViewport.zoom || 1, 0.1);
    const backgroundGap = 25 * backgroundScale;
    const baseDotRadius = 1.45 * backgroundScale;
    const baseDotFade = 1.62 * backgroundScale;
    const hoverDotRadius = 1.9 * backgroundScale;
    const hoverDotFade = 2.12 * backgroundScale;
    const centerDotRadius = 2.15 * backgroundScale;
    const centerDotFade = 2.38 * backgroundScale;

    useEffect(() => {
        return () => {
            if (hoverRafRef.current !== null) {
                cancelAnimationFrame(hoverRafRef.current);
            }
        };
    }, []);

    const updateHoverMask = useCallback((clientX: number, clientY: number, opacity: string) => {
        if (!canvasShellRef.current) return;

        const rect = canvasShellRef.current.getBoundingClientRect();
        const x = `${clientX - rect.left}px`;
        const y = `${clientY - rect.top}px`;

        canvasShellRef.current.style.setProperty('--canvas-hover-x', x);
        canvasShellRef.current.style.setProperty('--canvas-hover-y', y);
        canvasShellRef.current.style.setProperty('--canvas-hover-opacity', opacity);
    }, []);

    const handleCanvasPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (isPerformanceInteractionActive) {
            updateHoverMask(event.clientX, event.clientY, '0');
            return;
        }

        if (hoverRafRef.current !== null) return;

        const { clientX, clientY } = event;
        hoverRafRef.current = requestAnimationFrame(() => {
            updateHoverMask(clientX, clientY, '1');
            hoverRafRef.current = null;
        });
    }, [isPerformanceInteractionActive, updateHoverMask]);

    const handleCanvasPointerLeave = useCallback(() => {
        if (hoverRafRef.current !== null) {
            cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = null;
        }

        if (!canvasShellRef.current) return;
        canvasShellRef.current.style.setProperty('--canvas-hover-opacity', '0');
    }, []);

    React.useEffect(() => {
        if (!isPerformanceInteractionActive || !canvasShellRef.current) return;
        canvasShellRef.current.style.setProperty('--canvas-hover-opacity', '0');
    }, [isPerformanceInteractionActive]);

    return (
        <div
            ref={canvasShellRef}
            className="w-full h-full relative overflow-hidden bg-[#F8FAFC]"
            onPointerMoveCapture={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
            onContextMenuCapture={(event) => {
                event.preventDefault();
            }}
            onMouseDownCapture={(event) => {
                const target = event.target as Element | null;

                const isConnectionHandle = target?.closest('.react-flow__handle, .experiment-node-handle');

                if (event.button === 0 && target?.closest('.react-flow__node') && !isConnectionHandle) {
                    document.body.classList.add('is-node-pointer-down');

                    const releaseNodePointerDown = () => {
                        document.body.classList.remove('is-node-pointer-down');
                        window.removeEventListener('pointerup', releaseNodePointerDown);
                        window.removeEventListener('mouseup', releaseNodePointerDown);
                        window.removeEventListener('blur', releaseNodePointerDown);
                    };

                    window.addEventListener('pointerup', releaseNodePointerDown);
                    window.addEventListener('mouseup', releaseNodePointerDown);
                    window.addEventListener('blur', releaseNodePointerDown);
                }

                if (tool !== 'frame' || event.button !== 0) return;

                if (!target) return;

                if (
                    target.closest('[data-frame-ignore="true"]') ||
                    target.closest('[data-frame-element="true"]') ||
                    target.closest('button, input, textarea, select, option, a, [role="button"]') ||
                    target.closest('.react-flow__minimap')
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                setContextMenu(null);
                selectFrame(null);

                const start = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });

                frameDragStartRef.current = start;
                setDraftFrame({
                    x: start.x,
                    y: start.y,
                    width: 0,
                    height: 0,
                });
            }}
        >
            {/* Seamless transition loading overlay: Matches the one in page.tsx exactly */}
            <div 
                className={`absolute inset-0 z-[150] flex items-center justify-center bg-white transition-opacity duration-300 ease-in-out ${isCanvasReady ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">{t.mainPage.loadingBoard}</span>
                </div>
            </div>

            <div
                className="pointer-events-none absolute inset-0 z-0 opacity-75"
                style={{
                    backgroundImage: `radial-gradient(circle, #BCC5D1 ${baseDotRadius.toFixed(2)}px, transparent ${baseDotFade.toFixed(2)}px)`,
                    backgroundSize: `${backgroundGap}px ${backgroundGap}px`,
                    backgroundPosition: `${backgroundViewport.x}px ${backgroundViewport.y}px`,
                }}
            />

            <div
                className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-150 ease-out"
                style={{
                    opacity: 'var(--canvas-hover-opacity, 0)',
                    backgroundImage: `radial-gradient(circle, #6F7C8D ${hoverDotRadius.toFixed(2)}px, transparent ${hoverDotFade.toFixed(2)}px)`,
                    backgroundSize: `${backgroundGap}px ${backgroundGap}px`,
                    backgroundPosition: `${backgroundViewport.x}px ${backgroundViewport.y}px`,
                    WebkitMaskImage:
                        'radial-gradient(150px 150px at var(--canvas-hover-x, 50%) var(--canvas-hover-y, 50%), rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.72) 30%, rgba(0, 0, 0, 0.38) 52%, rgba(0, 0, 0, 0.12) 72%, rgba(0, 0, 0, 0.03) 84%, rgba(0, 0, 0, 0) 96%)',
                    maskImage:
                        'radial-gradient(150px 150px at var(--canvas-hover-x, 50%) var(--canvas-hover-y, 50%), rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.72) 30%, rgba(0, 0, 0, 0.38) 52%, rgba(0, 0, 0, 0.12) 72%, rgba(0, 0, 0, 0.03) 84%, rgba(0, 0, 0, 0) 96%)',
                }}
            />

            <div
                className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-150 ease-out"
                style={{
                    opacity: 'var(--canvas-hover-opacity, 0)',
                    backgroundImage: `radial-gradient(circle, #334155 ${centerDotRadius.toFixed(2)}px, transparent ${centerDotFade.toFixed(2)}px)`,
                    backgroundSize: `${backgroundGap}px ${backgroundGap}px`,
                    backgroundPosition: `${backgroundViewport.x}px ${backgroundViewport.y}px`,
                    WebkitMaskImage:
                        'radial-gradient(72px 72px at var(--canvas-hover-x, 50%) var(--canvas-hover-y, 50%), rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.82) 42%, rgba(0, 0, 0, 0.28) 68%, rgba(0, 0, 0, 0.03) 86%, rgba(0, 0, 0, 0) 100%)',
                    maskImage:
                        'radial-gradient(72px 72px at var(--canvas-hover-x, 50%) var(--canvas-hover-y, 50%), rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.82) 42%, rgba(0, 0, 0, 0.28) 68%, rgba(0, 0, 0, 0.03) 86%, rgba(0, 0, 0, 0) 100%)',
                }}
            />

            <ReactFlow
                nodes={nodes}
                edges={styledEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onDrop={canMutateBoard ? onDrop : undefined}
                onDragOver={canMutateBoard ? onDragOver : undefined}
                fitView={false}
                defaultViewport={stableDefaultViewport}
                minZoom={0.1}
                maxZoom={2}
                deleteKeyCode={canMutateBoard ? ['Backspace', 'Delete'] : null}
                className={`${tool === 'hand' ? 'is-hand-tool' : ''} ${tool === 'pen' ? 'is-pen-tool' : ''} ${tool === 'arrow' ? 'is-arrow-tool' : ''} ${isConnecting ? 'is-connecting' : ''} ${isPerformanceInteractionActive ? 'is-performance-interaction' : ''} ${pendingTextInsertVariant ? 'is-text-insert' : ''}`}

                // ==========================================
                // DYNAMIC TOOL-BASED PROPS
                // ==========================================

                // 1. Panning Logic - Allow drag-to-pan in HAND mode
                panOnDrag={tool === 'hand' ? [0, 1, 2] : [1, 2]}

                // 2. Selection Logic
                selectionKeyCode={['Control', 'Meta']}
                multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
                selectionOnDrag={tool === 'select'}
                selectionMode={SelectionMode.Partial}

                // 3. Scroll behavior - Pan on scroll, Ctrl+scroll for zoom
                panOnScroll={true}
                zoomOnScroll={false}
                zoomOnPinch={true}

                // 4. Node Interaction - Only in SELECT mode
                nodesDraggable={canMutateBoard && tool === 'select'}
                nodesConnectable={canMutateBoard && tool === 'select'}
                elementsSelectable={true}
                onlyRenderVisibleElements={false}
                isValidConnection={isValidConnection}
                edgesUpdatable={false}
                connectOnClick={false}
                connectionMode={ConnectionMode.Loose}
                nodeDragThreshold={1}

                // 5. Cursor Styling based on mode
                style={{
                    backgroundColor: 'transparent',
                    cursor: pendingTextInsertVariant
                        ? 'text'
                        : tool === 'hand'
                        ? 'grab'
                        : tool === 'pen' || tool === 'arrow' || tool === 'frame'
                            ? 'crosshair'
                            : 'default'
                }}

                onNodeDragStart={() => {
                    if (selectedFrameId) {
                        selectFrame(null);
                    }
                    startInteraction();
                    document.body.classList.remove('is-node-pointer-down');
                    document.body.classList.add('is-dragging-node');
                }}
                onNodeDragStop={() => {
                    document.body.classList.remove('is-node-pointer-down');
                    document.body.classList.remove('is-dragging-node');
                    stopInteractionSoon();
                }}

                // 7. Viewport Center Sync - Update store when viewport changes
                onMoveStart={() => {
                    startInteraction();
                }}
                onMove={(_, viewport) => {
                    setBackgroundViewport(viewport);
                }}
                onMoveEnd={(_, viewport) => {
                    syncViewportState(viewport);
                    void saveCurrentViewport(true).catch((error) => {
                        console.error('Failed to save viewport:', error);
                    });
                    stopInteractionSoon();
                }}

                // 8. Connection State for Handle Visibility
                onConnectStart={useCallback((e: React.MouseEvent | React.TouchEvent) => {
                    setIsConnecting(true);
                    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
                    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
                    const startPos = { x: clientX, y: clientY };
                    connectStartPos.current = startPos;
                    connectCurrentPos.current = startPos;
                }, [])}
                onConnectEnd={useCallback(() => {
                    setIsConnecting(false);
                    connectStartPos.current = null;
                    connectCurrentPos.current = null;
                }, [])}

                // 9. Context Menu (Right-Click) & Click to Close
                onPaneContextMenu={useCallback((event: React.MouseEvent) => {
                    if (!canMutateBoard) return;
                    event.preventDefault();
                    setPendingTextInsertVariant(null);
                    setContextMenu({ x: event.clientX, y: event.clientY });
                }, [canMutateBoard, setPendingTextInsertVariant])}
                onNodeContextMenu={useCallback((event: React.MouseEvent) => {
                    if (!canMutateBoard) return;
                    event.preventDefault();
                    setPendingTextInsertVariant(null);
                    setContextMenu({ x: event.clientX, y: event.clientY });
                }, [canMutateBoard, setPendingTextInsertVariant])}
                onPaneClick={useCallback((event: React.MouseEvent) => {
                    clearTextSelection();
                    setContextMenu(null);
                    selectFrame(null);
                    if (!canMutateBoard) return;
                    if (pendingTextInsertVariant) {
                        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
                        setPendingTextInsertVariant(null);
                        const variantToInsert = pendingTextInsertVariant;

                        if (pendingTextInsertRafRef.current !== null) {
                            cancelAnimationFrame(pendingTextInsertRafRef.current);
                        }

                        pendingTextInsertRafRef.current = requestAnimationFrame(() => {
                            pendingTextInsertRafRef.current = null;
                            addTextNode(position, {
                                variant: variantToInsert,
                                isDraft: variantToInsert === 'plain',
                            });
                        });
                    }
                }, [addTextNode, canMutateBoard, pendingTextInsertVariant, screenToFlowPosition, selectFrame, setPendingTextInsertVariant])}
                onNodeClick={useCallback(() => {
                    setPendingTextInsertVariant(null);
                    setContextMenu(null);
                    selectFrame(null);
                }, [selectFrame, setPendingTextInsertVariant])}

                onInit={() => {
                    const currentViewport = getViewport();
                    const targetViewport =
                        stableDefaultViewport && Number.isFinite(stableDefaultViewport.zoom) && stableDefaultViewport.zoom > 0
                            ? stableDefaultViewport
                            : currentViewport && Number.isFinite(currentViewport.zoom) && currentViewport.zoom > 0
                                ? currentViewport
                                : { x: 0, y: 0, zoom: 1 };

                    if (
                        Math.abs(currentViewport.x - targetViewport.x) > 0.5 ||
                        Math.abs(currentViewport.y - targetViewport.y) > 0.5 ||
                        Math.abs(currentViewport.zoom - targetViewport.zoom) > 0.0001
                    ) {
                        setViewport(targetViewport);
                    }
                    setCurrentViewport(targetViewport);
                    setBackgroundViewport(targetViewport);

                    const metrics = getViewportMetrics(targetViewport);
                    setViewportCenter({ x: metrics.centerX, y: metrics.centerY });
                    setZoomLevel(metrics.zoom);

                    requestAnimationFrame(() => {
                        setIsCanvasReady(true);
                    });
                }}
            >
                {/* Mini map - must stay inside ReactFlow for viewport sync */}
                <MiniMap
                    nodeColor={minimapNodeColor}
                    maskColor="rgba(255, 255, 255, 0.8)"
                    className="!fixed !bottom-4 !right-4 !m-0 !z-[90] !bg-gray-50 !border !border-gray-200"
                    style={{
                        position: 'fixed',
                        right: 16,
                        bottom: 16,
                        margin: 0,
                    }}
                />
                <DrawingLayer readOnly={!canMutateBoard} />
                <ArrowLayer readOnly={!canMutateBoard} />
            </ReactFlow>

            <FrameLayer
                frames={frames}
                linkedNodes={frameLinkedNodes}
                selectedNodeIds={selectedNodeIds}
                selectedFrameId={selectedFrameId}
                draftFrame={draftFrame}
                onSelectFrame={(frameId) => {
                    setContextMenu(null);
                    selectFrame(frameId);
                }}
                onStartMoveFrame={(frameId, clientX, clientY) => {
                    const frame = frames.find((item) => item.id === frameId);
                    if (!frame) return;

                    frameMoveRef.current = {
                        frameId,
                        startFlowPosition: screenToFlowPosition({ x: clientX, y: clientY }),
                        startFramePosition: { x: frame.x, y: frame.y },
                        hasMoved: false,
                    };
                }}
                onSpawnAIInput={(frameId, position) => {
                    setContextMenu(null);
                    spawnFrameAIInput(frameId, position);
                }}
                onAttachFrameToNode={(frameId, nodeId) => attachFrameToNode(frameId, nodeId)}
                onDisconnectFrameLink={(frameId, nodeId) => disconnectFrameLink(frameId, nodeId)}
                screenToFlowPosition={screenToFlowPosition}
                readOnly={!canMutateBoard}
            />

            {/* Custom Zoom Controls - OUTSIDE ReactFlow to stay fixed in viewport */}
            <div
                data-frame-ignore="true"
                className="absolute bottom-4 left-4 bg-white border border-gray-200 shadow-md flex flex-col items-center overflow-hidden"
                style={{ borderRadius: '14px', zIndex: 100, pointerEvents: 'auto' }}
            >
                <button
                    onClick={() => zoomIn({ duration: 200 })}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600 font-medium text-lg"
                >
                    +
                </button>
                <div className="w-full h-px bg-gray-100" />
                <div className="w-10 h-8 flex items-center justify-center text-xs font-medium text-gray-500">
                    {Math.round(zoomLevel * 100)}%
                </div>
                <div className="w-full h-px bg-gray-100" />
                <button
                    onClick={() => zoomOut({ duration: 200 })}
                    className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600 font-medium text-lg"
                >
                    −
                </button>
            </div>


            {/* Context Menu */}
            <div data-frame-ignore="true">
                <CanvasContextMenu
                    x={contextMenu?.x ?? 0}
                    y={contextMenu?.y ?? 0}
                    isOpen={contextMenu !== null}
                    onClose={() => setContextMenu(null)}
                    hasSelection={nodes.some(n => n.selected) || selectedFrameId !== null}
                    hasClipboard={clipboard !== null}
                    onCopy={() => {
                        const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
                        copySelection(selectedNodeIds, []);
                    }}
                    onCut={() => {
                        const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
                        cutSelection(selectedNodeIds, []);
                    }}
                    onPaste={() => {
                        if (contextMenu) {
                            const flowPos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
                            pasteSelection(flowPos);
                        } else {
                            pasteSelection();
                        }
                    }}
                    onDuplicate={() => {
                        const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
                        duplicateSelection(selectedNodeIds, []);
                    }}
                    onSelectAll={() => {
                        useMindStore.setState(state => ({
                            selectedFrameId: null,
                            nodes: state.nodes.map(n => ({ ...n, selected: true }))
                        }));
                    }}
                    onDelete={() => {
                        const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
                        if (selectedFrameId) {
                            deleteFrame(selectedFrameId);
                            return;
                        }

                        useMindStore.setState(state => ({
                            nodes: state.nodes.filter(n => !selectedNodeIds.includes(n.id)),
                            edges: state.edges.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)),
                        }));
                    }}
                />
            </div>

            {uploadNotice && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm z-[100] pointer-events-none">
                    <p className="text-sm text-blue-900">{uploadNotice}</p>
                </div>
            )}

            {/* Image Limit Alert Toast */}
            {
                showLimitAlert && !hasUnlimitedImageNodes && !isExperimentSandbox && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg animate-in slide-in-from-top-2 z-[100] pointer-events-auto">
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
                )
            }
            {/* Guest Limit Modal */}
            {!isExperimentSandbox && (
                <GuestLimitModal
                    isOpen={guestLimitReason !== null}
                    onClose={() => setGuestLimitReason(null)}
                    reason={guestLimitReason || 'ai'}
                />
            )}
        </div>
    );
}

interface CanvasWrapperProps {
    initialViewport: { x: number; y: number; zoom: number };
    accessMode?: WorkspaceShareAccessRole | 'owner';
    sharedToken?: string;
    sharedBoardId?: string;
    onSharedAccessRevoked?: () => void;
}

/**
 * Canvas wrapper component with ReactFlowProvider
 * Provides the React Flow context for child components
 */
export default function CanvasWrapper({
    initialViewport,
    accessMode = 'owner',
    sharedToken,
    sharedBoardId,
    onSharedAccessRevoked,
}: CanvasWrapperProps) {
    return (
        <ReactFlowProvider>
            <CanvasInner
                initialViewport={initialViewport}
                accessMode={accessMode}
                sharedToken={sharedToken}
                sharedBoardId={sharedBoardId}
                onSharedAccessRevoked={onSharedAccessRevoked}
            />
        </ReactFlowProvider>
    );
}
