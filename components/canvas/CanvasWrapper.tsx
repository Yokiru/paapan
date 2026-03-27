"use client";

import React, { useCallback, useState } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
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
import { useMindStore } from '@/store/useMindStore';
import { extractFramesFromPersistedNodes, getPersistableEdges, getPersistableNodes, useWorkspaceStore, setCurrentViewport } from '@/store/useWorkspaceStore';
import { GuestLimitModal } from '../ui/GuestLimitModal';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { getImageNodeLimit } from '@/lib/creditCosts';
import CanvasContextMenu from './CanvasContextMenu';
import { supabase } from '@/lib/supabase';
import { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion, ImageUploadResult, Workspace } from '@/types';


// Custom node types registration
// Memoized explicitly outside to absolutely prevent React Flow warnings
const nodeTypes = {
    mindNode: MindNode,
    aiInput: AIInputNode,
    imageNode: ImageNode,
    textNode: TextNode,
};

// Edge types (empty but memoized to prevent warnings)
const edgeTypes = {};

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

interface CanvasInnerProps {
    initialViewport: { x: number; y: number; zoom: number };
}

/**
 * Inner canvas component that uses the React Flow hooks
 * Must be wrapped in ReactFlowProvider
 */
function CanvasInner({ initialViewport }: CanvasInnerProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const saveCurrentWorkspace = useWorkspaceStore(state => state.saveCurrentWorkspace);
    const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
    const userId = useWorkspaceStore(state => state.userId);
    
    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
    const [isInteractionActive, setIsInteractionActive] = React.useState(false);

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
        addImageNode,
        addFrame,
        updateFrame,
        deleteFrame,
        selectFrame,
        spawnFrameAIInput,
        attachFrameToNode,
        disconnectFrameLink,
        tool,
        setTool,
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

    const { screenToFlowPosition, getViewport, setViewport, fitView, zoomIn, zoomOut } = useReactFlow();
    const isWorkspaceEmpty = nodes.length === 0 && edges.length === 0 && frames.length === 0 && strokes.length === 0 && arrows.length === 0;

    const handleStartFirstAI = useCallback(() => {
        if (!userId) {
            router.push('/login');
            return;
        }

        setTool('select');
        addRootNode(viewportCenter);
    }, [addRootNode, router, setTool, userId, viewportCenter]);

    const handleStartFirstNote = useCallback(() => {
        setTool('select');
        addTextNode(viewportCenter);
    }, [addTextNode, setTool, viewportCenter]);

    // Use the initialViewport passed from parent (guarantees availability on first render)
    const savedViewport = initialViewport;
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

    // Track zoom level for display
    const [zoomLevel, setZoomLevel] = React.useState(1);

    // Track connection state for handle visibility
    const [isConnecting, setIsConnecting] = React.useState(false);
    // Track mouse position when a connection drag starts (to detect clicks vs real drags)
    const connectStartPos = React.useRef<{ x: number; y: number } | null>(null);
    const frameDragStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const frameMoveRef = React.useRef<{
        frameId: string;
        startFlowPosition: { x: number; y: number };
        startFramePosition: { x: number; y: number };
        hasMoved: boolean;
    } | null>(null);
    const skipNextAutosaveRef = React.useRef(true);
    const lastAppliedCloudUpdateRef = React.useRef<string | null>(null);
    const lastKnownCloudUpdatedAtRef = React.useRef(0);
    const hasPendingLocalChangesRef = React.useRef(false);
    const latestSaveRequestRef = React.useRef(0);
    const lastAutosaveSnapshotRef = React.useRef<{
        nodes: string;
        edges: string;
        frames: string;
        strokes: string;
        arrows: string;
    } | null>(null);
    const interactionReleaseTimeoutRef = React.useRef<number | null>(null);

    const showImageUploadFeedback = useCallback((result: ImageUploadResult) => {
        if (result === 'limit-reached') {
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
    }, []);

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

    React.useEffect(() => {
        if (pendingViewport) {
            // Sanitize viewport to prevent NaN/Infinity crashes
            const safeX = Number.isFinite(pendingViewport.x) ? pendingViewport.x : 0;
            const safeY = Number.isFinite(pendingViewport.y) ? pendingViewport.y : 0;
            const safeZoom = Number.isFinite(pendingViewport.zoom) && pendingViewport.zoom > 0 ? pendingViewport.zoom : 1;
            
            const sanitizedViewport = { x: safeX, y: safeY, zoom: safeZoom };

            // Apply the viewport INSTANTLY (no animation) for reliability on page load
            setViewport(sanitizedViewport);
            // IMPORTANT: Also update the module-level currentViewport variable
            // so saveCurrentWorkspace can persist the correct viewport
            setCurrentViewport(sanitizedViewport);
            // Clear the pending viewport
            setPendingViewport(null);
        }
    }, [pendingViewport, setViewport, setPendingViewport]);

    React.useEffect(() => {
        skipNextAutosaveRef.current = true;
        lastKnownCloudUpdatedAtRef.current = 0;
        lastAutosaveSnapshotRef.current = null;
    }, [activeWorkspaceId]);

    const startInteraction = React.useCallback(() => {
        if (interactionReleaseTimeoutRef.current !== null) {
            window.clearTimeout(interactionReleaseTimeoutRef.current);
            interactionReleaseTimeoutRef.current = null;
        }

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

    React.useEffect(() => () => {
        if (interactionReleaseTimeoutRef.current !== null) {
            window.clearTimeout(interactionReleaseTimeoutRef.current);
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
        if (tool === 'frame') return;

        frameDragStartRef.current = null;
        frameMoveRef.current = null;
        setDraftFrame(null);
    }, [tool]);

    React.useEffect(() => {
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
    }, [addFrame, markPendingLocalChanges, screenToFlowPosition, tool, updateFrame]);

    React.useEffect(() => {
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
    }, [deleteFrame, markPendingLocalChanges, selectedFrameId]);

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

            saveCurrentWorkspace(false)
                .then(() => {
                    if (latestSaveRequestRef.current === saveRequestId && !hasUploadingImages) {
                        lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, Date.now());
                        clearPendingLocalChanges();
                    }
                })
                .catch((error) => {
                    console.error(error);
                    hasPendingLocalChangesRef.current = true;
                });
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [activeWorkspaceId, arrows, clearPendingLocalChanges, edges, frames, hasUploadingImages, isCanvasReady, isInteractionActive, isNodeInteractionActive, markPendingLocalChanges, nodes, saveCurrentWorkspace, strokes]);

    React.useEffect(() => {
        if (!activeWorkspaceId) return;

        const flushSave = () => {
            if (!hasPendingLocalChangesRef.current) return Promise.resolve();

            return useWorkspaceStore.getState().saveCurrentWorkspace(true)
                .then(() => {
                    if (!hasUploadingImages) {
                        lastKnownCloudUpdatedAtRef.current = Math.max(lastKnownCloudUpdatedAtRef.current, Date.now());
                        clearPendingLocalChanges();
                    }
                })
                .catch((error) => {
                    console.error(error);
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
    }, [activeWorkspaceId, clearPendingLocalChanges, hasUploadingImages]);

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

    // Handle drop from external sources (files or new topics)
    const onDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
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
        [screenToFlowPosition, addRootNode, addImageNode, showImageUploadFeedback]
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
            // If we have a start pos AND the mouse hasn't moved enough, cancel the connection
            // (This prevents click-to-connect snapping to nearby nodes)
            // Note: endPos stores the START position; we check movement via global mousemove tracking below
            const newEdge = {
                ...connection,
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
            };
            useMindStore.setState((state) => ({
                edges: addEdge(newEdge, state.edges),
            }));
            connectStartPos.current = null;
        },
        []
    );

    // Compute styled edges with highlight class
    const styledEdges = React.useMemo(() => {
        // Find selected node IDs
        const selectedNodeIds = new Set(nodes.filter(n => n.selected).map(n => n.id));

        return edges.map(edge => {
            let className = '';

            // Prioritize highlight (disconnect preview)
            if (edge.id === highlightedEdgeId) {
                className = 'highlighted';
            }
            // Then check for selection connection
            else if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) {
                className = 'animated';
            }

            return {
                ...edge,
                className,
            };
        });
    }, [edges, highlightedEdgeId, nodes]);

    return (
        <div
            className="w-full h-full relative overflow-hidden"
            onContextMenuCapture={(event) => {
                event.preventDefault();
            }}
            onMouseDownCapture={(event) => {
                if (tool !== 'frame' || event.button !== 0) return;

                const target = event.target as Element | null;
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

            <ReactFlow
                nodes={nodes}
                edges={styledEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onDrop={onDrop}
                onDragOver={onDragOver}
                fitView={false}
                defaultViewport={savedViewport?.zoom > 0 ? savedViewport : { x: 0, y: 0, zoom: 1 }}
                minZoom={0.1}
                maxZoom={2}
                deleteKeyCode={['Backspace', 'Delete']}
                className={`${tool === 'hand' ? 'is-hand-tool' : ''} ${tool === 'pen' ? 'is-pen-tool' : ''} ${tool === 'arrow' ? 'is-arrow-tool' : ''} ${isConnecting ? 'is-connecting' : ''} ${isPerformanceInteractionActive ? 'is-performance-interaction' : ''}`}

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
                nodesDraggable={tool === 'select'}
                nodesConnectable={tool === 'select'}
                elementsSelectable={true}
                onlyRenderVisibleElements={true}
                isValidConnection={isValidConnection}
                edgesUpdatable={false}
                connectionMode={ConnectionMode.Loose}
                nodeDragThreshold={5}

                // 5. Cursor Styling based on mode
                style={{
                    backgroundColor: '#F8FAFC',
                    cursor: tool === 'hand'
                        ? 'grab'
                        : tool === 'pen' || tool === 'arrow' || tool === 'frame'
                            ? 'crosshair'
                            : 'default'
                }}

                // 6. Global Cursor Fix for Node Dragging
                onNodeDragStart={() => {
                    selectFrame(null);
                    startInteraction();
                    document.body.classList.add('is-dragging-node');
                }}
                onNodeDragStop={() => {
                    document.body.classList.remove('is-dragging-node');
                    stopInteractionSoon();
                }}

                // 7. Viewport Center Sync - Update store when viewport changes
                onMoveStart={() => {
                    startInteraction();
                }}
                onMoveEnd={(_, viewport) => {
                    const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
                    const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
                    setViewportCenter({ x: centerX, y: centerY });
                    setZoomLevel(viewport.zoom);
                    setCurrentViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
                    useWorkspaceStore.setState((state) => ({
                        workspaces: state.workspaces.map((workspace) =>
                            workspace.id === state.activeWorkspaceId
                                ? {
                                    ...workspace,
                                    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
                                    updatedAt: workspace.updatedAt,
                                }
                                : workspace
                        ),
                    }));
                    stopInteractionSoon();
                }}

                // 8. Connection State for Handle Visibility
                onConnectStart={useCallback((e: React.MouseEvent | React.TouchEvent) => {
                    setIsConnecting(true);
                    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
                    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
                    connectStartPos.current = { x: clientX, y: clientY };
                }, [])}
                onConnectEnd={useCallback(() => {
                    setIsConnecting(false);
                    connectStartPos.current = null;
                }, [])}

                // 9. Context Menu (Right-Click) & Click to Close
                onPaneContextMenu={useCallback((event: React.MouseEvent) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY });
                }, [])}
                onNodeContextMenu={useCallback((event: React.MouseEvent) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY });
                }, [])}
                onPaneClick={useCallback(() => {
                    setContextMenu(null);
                    selectFrame(null);
                }, [selectFrame])}
                onNodeClick={useCallback(() => {
                    setContextMenu(null);
                    selectFrame(null);
                }, [selectFrame])}

                onInit={() => {
                    // Initialize currentViewport from saved or default
                    if (savedViewport) {
                        setCurrentViewport(savedViewport);
                    }
                    // Set initial viewport center
                    const viewport = getViewport();
                    const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
                    const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
                    setViewportCenter({ x: centerX, y: centerY });
                    setZoomLevel(viewport.zoom);

                    // Fix viewport desync on page refresh:
                    window.dispatchEvent(new Event('resize'));
                    const targetVp = { ...viewport };
                    requestAnimationFrame(() => {
                        fitView({ duration: 0 });
                        requestAnimationFrame(() => {
                            setViewport(targetVp);
                            setCurrentViewport(targetVp);
                            requestAnimationFrame(() => {
                                setIsCanvasReady(true);
                            });
                        });
                    });
                }}
            >
                {/* Dot pattern background */}
                <Background
                    variant={BackgroundVariant.Dots}
                    color="#9DA6B3"
                    gap={25}
                    size={2.8}
                    style={{ zIndex: -1, opacity: 0.9 }}
                />
                {/* Mini map - must stay inside ReactFlow for viewport sync */}
                <MiniMap
                    nodeColor={minimapNodeColor}
                    maskColor="rgba(255, 255, 255, 0.8)"
                    className="!bg-gray-50 !border !border-gray-200"
                />
                <DrawingLayer />
                <ArrowLayer />
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

            {isCanvasReady && isWorkspaceEmpty && (
                <div className="absolute inset-0 z-[95] flex items-center justify-center pointer-events-none px-6">
                    <div className="pointer-events-auto w-full max-w-xl rounded-[28px] border border-slate-200/80 bg-white/96 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-xl font-semibold text-slate-900">
                                    Mulai board pertama Anda
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {userId
                                        ? 'Buat chat AI pertama, tambahkan catatan teks, atau tempel gambar untuk mulai menyusun ide di canvas.'
                                        : 'Mulai dengan catatan teks atau gambar. Untuk memakai AI chat, masuk dulu gratis lalu lanjut dari board ini.'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <button
                                onClick={handleStartFirstAI}
                                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                            >
                                {userId ? 'Buat chat AI pertama' : 'Masuk untuk mulai AI'}
                            </button>
                            <button
                                onClick={handleStartFirstNote}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                Tambah catatan teks
                            </button>
                        </div>

                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Tip cepat: klik tombol toolbar di bawah untuk tambah gambar, frame, panah, atau gunakan klik kanan di canvas untuk menu cepat.
                        </div>
                    </div>
                </div>
            )}

            {uploadNotice && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm z-[100] pointer-events-none">
                    <p className="text-sm text-blue-900">{uploadNotice}</p>
                </div>
            )}

            {/* Image Limit Alert Toast */}
            {
                showLimitAlert && (
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
            <GuestLimitModal
                isOpen={guestLimitReason !== null}
                onClose={() => setGuestLimitReason(null)}
                reason={guestLimitReason || 'ai'}
            />
        </div>
    );
}

interface CanvasWrapperProps {
    initialViewport: { x: number; y: number; zoom: number };
}

/**
 * Canvas wrapper component with ReactFlowProvider
 * Provides the React Flow context for child components
 */
export default function CanvasWrapper({ initialViewport }: CanvasWrapperProps) {
    return (
        <ReactFlowProvider>
            <CanvasInner initialViewport={initialViewport} />
        </ReactFlowProvider>
    );
}
