"use client";

import React, { useCallback, useState } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlowProvider,
    SelectionMode,
    useReactFlow,
    Connection,
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
import { SubscriptionModal } from '../ui/SubscriptionModal';
import { GuestLimitModal } from '../ui/GuestLimitModal';
import { getImageNodeLimit } from '@/lib/creditCosts';
import CanvasContextMenu from './CanvasContextMenu';


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

interface CanvasInnerProps {
    initialViewport: { x: number; y: number; zoom: number };
}

/**
 * Inner canvas component that uses the React Flow hooks
 * Must be wrapped in ReactFlowProvider
 */
function CanvasInner({ initialViewport }: CanvasInnerProps) {
    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = React.useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

    const {
        nodes,
        edges,
        arrows,
        onNodesChange,
        onEdgesChange,
        addRootNode,
        addImageNode,
        tool,
        setTool,
        setViewportCenter,
        highlightedEdgeId,
        clipboard,
        copySelection,
        cutSelection,
        pasteSelection,
        duplicateSelection,
        undoStroke,
        redoStroke,
        guestLimitReason,
        setGuestLimitReason,
    } = useMindStore();

    const { screenToFlowPosition, getViewport, setViewport, zoomIn, zoomOut } = useReactFlow();

    // Use the initialViewport passed from parent (guarantees availability on first render)
    const savedViewport = initialViewport;

    // Track zoom level for display
    const [zoomLevel, setZoomLevel] = React.useState(1);

    // Track connection state for handle visibility
    const [isConnecting, setIsConnecting] = React.useState(false);

    // Store previous tool to restore after middle click release
    const prevToolRef = React.useRef<typeof tool>('select');

    // Middle Mouse Button (Wheel Click) Shortcut
    React.useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            // Middle button is 1
            if (e.button === 1) {
                e.preventDefault(); // Prevent default scroll/paste behavior
                if (tool !== 'hand') {
                    prevToolRef.current = tool;
                    setTool('hand');
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (e.button === 1) {
                e.preventDefault();
                // Only restore if we are currently in hand mode (which we triggered)
                // and if we have a valid previous tool
                if (tool === 'hand') {
                    setTool(prevToolRef.current);
                }
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [tool, setTool]);

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
    const onConnect = useCallback(
        (connection: Connection) => {
            const newEdge = {
                ...connection,
                id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
            };
            useMindStore.setState((state) => ({
                edges: addEdge(newEdge, state.edges),
            }));
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
        <>
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
                snapToGrid
                snapGrid={[25, 25]}
                deleteKeyCode={['Backspace', 'Delete']}
                className={`bg-[#F5F5F5] ${tool === 'hand' ? 'is-hand-tool' : ''} ${tool === 'pen' ? 'is-pen-tool' : ''} ${tool === 'arrow' ? 'is-arrow-tool' : ''} ${isConnecting ? 'is-connecting' : ''}`}

                // 9. Performance Optimization (Virtualization)
                // Like occlusion culling in games - only render what is visible

                // ==========================================
                // DYNAMIC TOOL-BASED PROPS
                // ==========================================

                // 1. Panning Logic - Allow drag-to-pan in HAND mode (Left=0, Middle=1)
                panOnDrag={tool === 'hand' ? [0, 1] : [1]}

                // 2. Selection Logic
                // Ctrl+Click or Meta+Click to add to selection
                selectionKeyCode={['Control', 'Meta']}
                multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
                // Lasso selection - only in SELECT mode
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
                // Prevent self-connections and duplicates
                isValidConnection={isValidConnection}
                // Disable moving existing edges
                edgesUpdatable={false}
                // Allow loose connections (any handle to any handle)
                connectionMode={ConnectionMode.Loose}
                // Prevent accidental node drags during handle clicks (must drag 5px to start)
                nodeDragThreshold={5}

                // 5. Cursor Styling based on mode
                // Using default browser cursors to prevent interaction locks and 404s
                style={{
                    cursor: tool === 'hand'
                        ? 'grab'
                        : tool === 'pen' || tool === 'arrow'
                            ? 'crosshair'
                            : 'default'
                }}

                // 6. Global Cursor Fix for Node Dragging
                // Apply a class to body to enforce cursor globally while dragging
                onNodeDragStart={() => document.body.classList.add('is-dragging-node')}
                onNodeDragStop={() => document.body.classList.remove('is-dragging-node')}

                // 7. Viewport Center Sync - Update store when viewport changes
                onMove={(_, viewport) => {
                    // Update zoom level in realtime during pan/zoom
                    setZoomLevel(viewport.zoom);
                    // Also update currentViewport in realtime so beforeunload has the latest value
                    setCurrentViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
                }}
                onMoveEnd={(_, viewport) => {
                    // Calculate center of visible area in flow coordinates
                    const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
                    const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
                    setViewportCenter({ x: centerX, y: centerY });
                    setZoomLevel(viewport.zoom);
                    // Save current viewport for persistence
                    setCurrentViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
                    // Immediately save to cloud/local to persist viewport changes
                    useWorkspaceStore.getState().saveCurrentWorkspace(true);
                }}

                // 8. Connection State for Handle Visibility
                onConnectStart={useCallback(() => setIsConnecting(true), [])}
                onConnectEnd={useCallback(() => setIsConnecting(false), [])}

                // 9. Context Menu (Right-Click)
                // 9. Context Menu (Right-Click) & Click to Close
                onPaneContextMenu={useCallback((event: React.MouseEvent) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY });
                }, [])}
                onNodeContextMenu={useCallback((event: React.MouseEvent, _node: any) => {
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
                }}
            >
                {/* Dot pattern background */}
                <Background
                    variant={BackgroundVariant.Dots}
                    color="#cbd5e1"
                    gap={24}
                    size={2.5}
                />

                {/* Custom Zoom Controls */}
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

                {/* Mini map for navigation */}
                <MiniMap
                    nodeColor={minimapNodeColor}
                    maskColor="rgba(255, 255, 255, 0.8)"
                    className="!bg-gray-50 !border !border-gray-200"
                />            <DrawingLayer />
                <ArrowLayer />
            </ReactFlow>

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
                                setShowUpgradeModal(true);
                            }}
                            className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                        >
                            Lihat Paket Upgrade
                        </button>
                    </div>
                )
            }

            {/* Subscription Modal */}
            <SubscriptionModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
            />

            {/* Guest Limit Modal */}
            <GuestLimitModal
                isOpen={guestLimitReason !== null}
                onClose={() => setGuestLimitReason(null)}
                reason={guestLimitReason || 'ai'}
            />
        </>
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
        <div className="w-full h-full">
            <ReactFlowProvider>
                <CanvasInner initialViewport={initialViewport} />
            </ReactFlowProvider>
        </div>
    );
}
