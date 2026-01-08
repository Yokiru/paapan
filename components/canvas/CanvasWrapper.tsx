"use client";

import React, { useCallback } from 'react';
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
import { useMindStore } from '@/store/useMindStore';

// Custom node types registration
const nodeTypes = {
    mindNode: MindNode,
    aiInput: AIInputNode,
    imageNode: ImageNode,
    textNode: TextNode,
};

/**
 * Inner canvas component that uses the React Flow hooks
 * Must be wrapped in ReactFlowProvider
 */
function CanvasInner() {
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        addRootNode,
        addImageNode,
        tool,
        setTool,
        setViewportCenter,
        highlightedEdgeId
    } = useMindStore();

    const { screenToFlowPosition, getViewport } = useReactFlow();

    // Track zoom level for display
    const [zoomLevel, setZoomLevel] = React.useState(1);

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
                    addImageNode(file, position);
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
        return edges.map(edge => ({
            ...edge,
            className: edge.id === highlightedEdgeId ? 'highlighted' : '',
        }));
    }, [edges, highlightedEdgeId]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView={false}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.1}
            maxZoom={2}
            snapToGrid
            snapGrid={[25, 25]}
            deleteKeyCode={['Backspace', 'Delete']}
            className={`bg-white ${tool === 'hand' ? 'is-hand-tool' : ''}`}

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

            // 3. Always allow scroll-wheel to pan
            panOnScroll={true}

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
            // Using custom PNG cursor files
            style={{
                cursor: tool === 'hand'
                    ? 'url("/cursors/handopen.png") 12 12, grab'
                    : 'url("/cursors/handpointing.png") 6 0, default'
            }}

            // 6. Global Cursor Fix for Node Dragging
            // Apply a class to body to enforce cursor globally while dragging
            onNodeDragStart={() => document.body.classList.add('is-dragging-node')}
            onNodeDragStop={() => document.body.classList.remove('is-dragging-node')}

            // 7. Viewport Center Sync - Update store when viewport changes
            onMoveEnd={(_, viewport) => {
                // Calculate center of visible area in flow coordinates
                const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
                const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;
                setViewportCenter({ x: centerX, y: centerY });
                setZoomLevel(viewport.zoom);
            }}
            onInit={() => {
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

            {/* Zoom/pan controls */}
            <Controls
                className="!bg-white !border !border-gray-200 !rounded-2xl !shadow-md"
                showInteractive={false}
            />

            {/* Mini map for navigation */}
            <MiniMap
                nodeColor={minimapNodeColor}
                maskColor="rgba(255, 255, 255, 0.8)"
                className="!bg-gray-50 !border !border-gray-200 !rounded-lg"
            />

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm text-sm font-medium text-gray-600">
                {Math.round(zoomLevel * 100)}%
            </div>
        </ReactFlow>
    );
}

/**
 * Canvas wrapper component with ReactFlowProvider
 * Provides the React Flow context for child components
 */
export default function CanvasWrapper() {
    return (
        <div className="w-full h-full">
            <ReactFlowProvider>
                <CanvasInner />
            </ReactFlowProvider>
        </div>
    );
}
