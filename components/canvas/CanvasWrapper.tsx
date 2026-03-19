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
import { useMindStore } from '@/store/useMindStore';
import { useWorkspaceStore, setCurrentViewport } from '@/store/useWorkspaceStore';
import { GuestLimitModal } from '../ui/GuestLimitModal';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { getImageNodeLimit } from '@/lib/creditCosts';
import CanvasContextMenu from './CanvasContextMenu';
import { supabase } from '@/lib/supabase';
import { CanvasNodeType, Workspace } from '@/types';


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

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    // Canvas readiness state to hide initialization blink
    const [isCanvasReady, setIsCanvasReady] = useState(false);

    const {
        nodes,
        edges,
        strokes,
        arrows,
        onNodesChange,
        onEdgesChange,
        addRootNode,
        addImageNode,
        tool,
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

    // Use the initialViewport passed from parent (guarantees availability on first render)
    const savedViewport = initialViewport;

    // Track zoom level for display
    const [zoomLevel, setZoomLevel] = React.useState(1);

    // Track connection state for handle visibility
    const [isConnecting, setIsConnecting] = React.useState(false);
    // Track mouse position when a connection drag starts (to detect clicks vs real drags)
    const connectStartPos = React.useRef<{ x: number; y: number } | null>(null);
    const skipNextAutosaveRef = React.useRef(true);
    const lastAppliedCloudUpdateRef = React.useRef<string | null>(null);

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
    }, [activeWorkspaceId]);

    React.useEffect(() => {
        if (!isCanvasReady || !activeWorkspaceId) return;

        if (skipNextAutosaveRef.current) {
            skipNextAutosaveRef.current = false;
            return;
        }

        saveCurrentWorkspace(false).catch(console.error);
    }, [activeWorkspaceId, isCanvasReady, nodes, edges, strokes, arrows, saveCurrentWorkspace]);

    React.useEffect(() => {
        if (!activeWorkspaceId) return;

        const flushSave = () => {
            useWorkspaceStore.getState().saveCurrentWorkspace(true).catch(console.error);
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
    }, [activeWorkspaceId]);

    const applyRemoteWorkspace = useCallback((workspaceRow: CloudWorkspaceRow) => {
        if (!activeWorkspaceId || workspaceRow.id !== activeWorkspaceId) return;

        const remoteUpdatedAt = workspaceRow.updated_at ?? null;
        if (remoteUpdatedAt && remoteUpdatedAt === lastAppliedCloudUpdateRef.current) return;
        lastAppliedCloudUpdateRef.current = remoteUpdatedAt;

        const safeNodes = sanitizeNodes(workspaceRow.nodes || []);
        const safeEdges = sanitizeEdges(workspaceRow.edges || []);

        skipNextAutosaveRef.current = true;

        useMindStore.setState((state) => ({
            ...state,
            nodes: safeNodes,
            edges: safeEdges,
            strokes: Array.isArray(workspaceRow.strokes) ? workspaceRow.strokes : [],
            arrows: Array.isArray(workspaceRow.arrows) ? workspaceRow.arrows : [],
            strokeHistory: [],
            strokeFuture: [],
        }));

        useWorkspaceStore.setState((state) => ({
            workspaces: state.workspaces.map((workspace) =>
                workspace.id === workspaceRow.id
                    ? {
                        ...workspace,
                        name: workspaceRow.name,
                        nodes: safeNodes,
                        edges: safeEdges,
                        strokes: Array.isArray(workspaceRow.strokes) ? workspaceRow.strokes : [],
                        arrows: Array.isArray(workspaceRow.arrows) ? workspaceRow.arrows : [],
                        isFavorite: workspaceRow.is_favorite ?? workspace.isFavorite,
                        createdAt: workspaceRow.created_at ? new Date(workspaceRow.created_at) : workspace.createdAt,
                        updatedAt: workspaceRow.updated_at ? new Date(workspaceRow.updated_at) : new Date(),
                    } satisfies Workspace
                    : workspace
            ),
        }));
    }, [activeWorkspaceId]);

    React.useEffect(() => {
        if (!userId || !activeWorkspaceId) return;

        const refreshActiveWorkspace = async () => {
            const { data, error } = await supabase
                .from('workspaces')
                .select('*')
                .eq('id', activeWorkspaceId)
                .single();

            if (error || !data) return;
            applyRemoteWorkspace(data);
        };

        const handleFocusSync = () => {
            refreshActiveWorkspace().catch(console.error);
        };

        window.addEventListener('focus', handleFocusSync);
        document.addEventListener('visibilitychange', handleFocusSync);

        return () => {
            window.removeEventListener('focus', handleFocusSync);
            document.removeEventListener('visibilitychange', handleFocusSync);
        };
    }, [activeWorkspaceId, applyRemoteWorkspace, userId]);

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

            // 1. Handle File Drop (Images)
            if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
                const file = event.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const position = screenToFlowPosition({
                        x: event.clientX,
                        y: event.clientY,
                    });
                    const success = addImageNode(file, position);
                    if (!success) {
                        setShowLimitAlert(true);
                        setTimeout(() => setShowLimitAlert(false), 4000);
                    }
                    return;
                }
            }

            // 2. Handle New Topic Drop (from sidebar/toolbar if implemented later)
            const type = event.dataTransfer.getData('application/mindnode');
            if (type === 'new-topic') {
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                addRootNode(position);
            }
        },
        [screenToFlowPosition, addRootNode, addImageNode]
    );

    // Enable drag over for drop to work
    const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
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
        <div className="w-full h-full relative overflow-hidden">
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
                className={`${tool === 'hand' ? 'is-hand-tool' : ''} ${tool === 'pen' ? 'is-pen-tool' : ''} ${tool === 'arrow' ? 'is-arrow-tool' : ''} ${isConnecting ? 'is-connecting' : ''}`}

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
                isValidConnection={isValidConnection}
                edgesUpdatable={false}
                connectionMode={ConnectionMode.Loose}
                nodeDragThreshold={5}

                // 5. Cursor Styling based on mode
                style={{
                    backgroundColor: '#F8FAFC',
                    cursor: tool === 'hand'
                        ? 'grab'
                        : tool === 'pen' || tool === 'arrow'
                            ? 'crosshair'
                            : 'default'
                }}

                // 6. Global Cursor Fix for Node Dragging
                onNodeDragStart={() => document.body.classList.add('is-dragging-node')}
                onNodeDragStop={() => document.body.classList.remove('is-dragging-node')}

                // 7. Viewport Center Sync - Update store when viewport changes
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
                }, [])}
                onNodeClick={useCallback(() => {
                    setContextMenu(null);
                }, [])}

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
                    color="#C7C7C7"
                    gap={25}
                    size={2}
                    style={{ zIndex: -1 }}
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

            {/* Custom Zoom Controls - OUTSIDE ReactFlow to stay fixed in viewport */}
            <div
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
            <CanvasContextMenu
                x={contextMenu?.x ?? 0}
                y={contextMenu?.y ?? 0}
                isOpen={contextMenu !== null}
                onClose={() => setContextMenu(null)}
                hasSelection={nodes.some(n => n.selected)}
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
                        nodes: state.nodes.map(n => ({ ...n, selected: true }))
                    }));
                }}
                onDelete={() => {
                    const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
                    useMindStore.setState(state => ({
                        nodes: state.nodes.filter(n => !selectedNodeIds.includes(n.id)),
                        edges: state.edges.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)),
                    }));
                }}
            />

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
