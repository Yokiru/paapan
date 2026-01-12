"use client";

import { create } from 'zustand';
import {
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Edge
} from 'reactflow';
import { MindNodeType, MindStoreState, SmartTag, ToolMode, CanvasNodeType, AIInputNodeType, MindNodeData, PastelColor, DrawingStroke } from '@/types';
import { generateId, getRandomPastelColor } from '@/lib/utils';
import { generateAIResponse } from '@/lib/gemini';

// Position offsets for spawning AI Input based on handle
const HANDLE_OFFSETS: Record<string, { x: number; y: number }> = {
    top: { x: 0, y: -120 },
    bottom: { x: 0, y: 280 }, // Increased to ensure input appears below taller cards
    left: { x: -420, y: 0 },
    right: { x: 420, y: 0 },
};

/**
 * Zustand store for managing the canvas state
 * Handles nodes, edges, tool mode, and all canvas-related actions
 */
export const useMindStore = create<MindStoreState>((set, get) => ({
    // Initial state
    nodes: [],
    edges: [],

    // Tool state - default to 'select' mode
    tool: 'select' as ToolMode,

    // Viewport center - default to center of initial viewport
    viewportCenter: { x: 400, y: 300 },

    // Conversion state
    isProcessingConversion: false,

    // Edge highlight state (for disconnect preview)
    highlightedEdgeId: null as string | null,

    // Search state
    searchQuery: '' as string,
    searchMode: 'keyword' as 'keyword' | 'tag',

    // Set the active tool
    setTool: (tool: ToolMode) => {
        set({ tool });
    },

    // Set viewport center (called when viewport changes)
    setViewportCenter: (center: { x: number; y: number }) => {
        set({ viewportCenter: center });
    },

    // Set highlighted edge (for disconnect preview)
    setHighlightedEdge: (edgeId: string | null) => {
        set({ highlightedEdgeId: edgeId });
    },

    // Search functions
    setSearchQuery: (query: string) => {
        set({ searchQuery: query });
    },

    setSearchMode: (mode: 'keyword' | 'tag') => {
        set({ searchMode: mode });
    },

    // Get matching node IDs based on search
    getMatchingNodeIds: () => {
        const state = get();
        const query = state.searchQuery.toLowerCase().trim();
        if (!query) return [];

        const matchingIds: string[] = [];

        state.nodes.forEach(node => {
            if (state.searchMode === 'keyword') {
                // Search in question and response for MindNodes
                if (node.type === 'mindNode') {
                    const data = node.data as MindNodeData;
                    if (
                        data.question?.toLowerCase().includes(query) ||
                        data.response?.toLowerCase().includes(query)
                    ) {
                        matchingIds.push(node.id);
                    }
                }
                // Search in content for TextNodes
                if (node.type === 'textNode') {
                    const content = (node.data as any).content?.toLowerCase() || '';
                    if (content.includes(query)) {
                        matchingIds.push(node.id);
                    }
                }
            } else {
                // Search in tags for MindNodes
                if (node.type === 'mindNode') {
                    const data = node.data as MindNodeData;
                    const hasMatchingTag = data.tags?.some(tag =>
                        tag.label.toLowerCase().includes(query)
                    );
                    if (hasMatchingTag) {
                        matchingIds.push(node.id);
                    }
                }
            }
        });

        return matchingIds;
    },

    // Favorites state
    isFavoritesFilterActive: false as boolean,

    setFavoritesFilterActive: (active: boolean) => {
        set({ isFavoritesFilterActive: active });
    },

    toggleFavorite: (nodeId: string) => {
        set(state => ({
            nodes: state.nodes.map(node => {
                if (node.id === nodeId && node.type === 'mindNode') {
                    const mindNode = node as MindNodeType;
                    return {
                        ...mindNode,
                        data: {
                            ...mindNode.data,
                            isFavorite: !mindNode.data.isFavorite
                        }
                    } as MindNodeType;
                }
                return node;
            }) as CanvasNodeType[]
        }));
    },

    getFavoriteCount: () => {
        const state = get();
        return state.nodes.filter(node => {
            if (node.type === 'mindNode') {
                return (node.data as MindNodeData).isFavorite === true;
            }
            return false;
        }).length;
    },

    // Drawing state
    strokes: [] as DrawingStroke[],
    strokeHistory: [] as DrawingStroke[][], // Undo history (past states)
    strokeFuture: [] as DrawingStroke[][], // Redo history (future states)
    currentStroke: null as { points: number[][]; color: string; size: number } | null,
    penColor: '#1e1e1e' as string,
    penSize: 4 as number,
    isEraser: false as boolean,
    eraserSize: 20 as number,

    addStroke: (stroke: Omit<DrawingStroke, 'id'>) => {
        const newStroke: DrawingStroke = {
            id: generateId(),
            ...stroke,
        };
        set(state => ({
            strokeHistory: [...state.strokeHistory, state.strokes], // Save current state to history
            strokeFuture: [], // Clear redo stack
            strokes: [...state.strokes, newStroke]
        }));
    },

    setCurrentStroke: (stroke: { points: number[][]; color: string; size: number } | null) => {
        set({ currentStroke: stroke });
    },

    setPenColor: (color: string) => {
        set({ penColor: color });
    },

    setPenSize: (size: number) => {
        set({ penSize: size });
    },

    setIsEraser: (isEraser: boolean) => {
        set({ isEraser });
    },

    setEraserSize: (size: number) => {
        set({ eraserSize: size });
    },

    undoStroke: () => {
        set(state => {
            if (state.strokeHistory.length === 0) return state;
            const previousStrokes = state.strokeHistory[state.strokeHistory.length - 1];
            return {
                strokeFuture: [state.strokes, ...state.strokeFuture],
                strokeHistory: state.strokeHistory.slice(0, -1),
                strokes: previousStrokes,
            };
        });
    },

    redoStroke: () => {
        set(state => {
            if (state.strokeFuture.length === 0) return state;
            const nextStrokes = state.strokeFuture[0];
            return {
                strokeHistory: [...state.strokeHistory, state.strokes],
                strokeFuture: state.strokeFuture.slice(1),
                strokes: nextStrokes,
            };
        });
    },

    clearStrokes: () => {
        set(state => ({
            strokeHistory: [...state.strokeHistory, state.strokes],
            strokeFuture: [],
            strokes: [],
        }));
    },

    deleteStroke: (strokeId: string) => {
        set(state => ({
            strokeHistory: [...state.strokeHistory, state.strokes],
            strokeFuture: [],
            strokes: state.strokes.filter(s => s.id !== strokeId),
        }));
    },

    getFavoriteNodeIds: () => {
        const state = get();
        return state.nodes
            .filter(node => {
                if (node.type === 'mindNode') {
                    return (node.data as MindNodeData).isFavorite === true;
                }
                return false;
            })
            .map(node => node.id);
    },


    // Handle node position/selection changes from React Flow
    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes as any) as CanvasNodeType[],
        });
    },

    // Handle edge changes from React Flow
    onEdgesChange: (changes: EdgeChange[]) => {
        // If conversion in progress, ignore 'remove' events to prevent accidental edge loss
        // This acts as a circuit breaker for React Flow's internal cleanup
        const state = get();
        if (state.isProcessingConversion) {
            const hasRemovals = changes.some(c => c.type === 'remove');
            if (hasRemovals) {
                changes = changes.filter(c => c.type !== 'remove');
                if (changes.length === 0) return;
            }
        }

        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    // Add a new root node at the specified position (spawns as AI Input first)
    addRootNode: (position: { x: number; y: number }) => {
        const nodeId = generateId();
        const color = getRandomPastelColor();

        // Spawn as AIInputNode first - user types question, then AI responds
        const newNode: AIInputNodeType = {
            id: nodeId,
            type: 'aiInput',
            position,
            data: {
                contextParentId: '', // No parent for root
                inputValue: '',
                color: color,
            },
        };

        // Deselect all other nodes
        const updatedNodes = get().nodes.map(n => ({ ...n, selected: false }));

        // New node is selected
        const newNodeWithSelection = { ...newNode, selected: true };

        set({
            nodes: [...updatedNodes, newNodeWithSelection],
        });
    },

    // Update specific data for a node
    updateNodeData: (nodeId, data) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        data: { ...node.data, ...data },
                    } as CanvasNodeType;
                }
                return node;
            }),
        });
    },

    // Spawn AI Input node from a handle click
    spawnAIInput: (parentId: string, handleId: string) => {
        const parentNode = get().nodes.find(n => n.id === parentId);
        if (!parentNode) return;

        const nodeId = generateId();
        const offset = HANDLE_OFFSETS[handleId] || HANDLE_OFFSETS.right;
        const parentColor = (parentNode.data as MindNodeData).color || 'pastel-blue';

        const newNode: AIInputNodeType = {
            id: nodeId,
            type: 'aiInput',
            position: {
                x: parentNode.position.x + offset.x,
                y: parentNode.position.y + offset.y,
            },
            data: {
                contextParentId: parentId,
                inputValue: '',
                color: parentColor,
            },
        };

        // Create edge based on handle direction:
        // All handles are now type="source" (ConnectionMode.Loose allows any-to-any)
        // sourceHandle = clicked handle on parent, targetHandle = opposite side on child

        // Map clicked handle to parent's source handle (direct ID, no suffix)
        const sourceHandleMap: Record<string, string> = {
            top: 'top',
            bottom: 'bottom',
            left: 'left',
            right: 'right',
        };

        // Map clicked handle to child's target handle (opposite side)
        const targetHandleMap: Record<string, string> = {
            top: 'bottom',    // Spawn above -> child's bottom connects to parent's top
            bottom: 'top',    // Spawn below -> child's top connects to parent's bottom
            left: 'right',    // Spawn left -> child's right connects to parent's left
            right: 'left',    // Spawn right -> child's left connects to parent's right
        };

        const newEdge: Edge = {
            id: `edge-${parentId}-${nodeId}`,
            source: parentId,
            target: nodeId,
            sourceHandle: sourceHandleMap[handleId] || 'right',
            targetHandle: targetHandleMap[handleId] || 'left',
        };

        // Deselect all other nodes
        const updatedNodes = get().nodes.map(n => ({ ...n, selected: false }));

        // New node is selected (and explicit zIndex just in case)
        const newNodeWithSelection = { ...newNode, selected: true };

        set({
            // Place new node at end of array (top) AND selected
            nodes: [...updatedNodes, newNodeWithSelection],
            edges: [...get().edges, newEdge],
        });
    },

    // Convert AI Input to full Mind Node
    convertAIInputToMind: async (nodeId: string, question: string) => {
        const state = get();
        const aiNode = state.nodes.find(n => n.id === nodeId);
        if (!aiNode || aiNode.type !== 'aiInput') return;

        // 0. LOCK DELETION
        // Prevent React Flow from cleaning up edges during this transition
        set({ isProcessingConversion: true });

        // Gather context from all connected nodes
        const connectedNodes = state.getConnectedNodes(nodeId);

        // Get text context from MindNodes
        const mindNodeContext = connectedNodes
            .filter(n => n.type === 'mindNode')
            .map(n => {
                const data = n.data as MindNodeData;
                return `${data.question}\n${data.response}`;
            })
            .filter(Boolean);

        // Get text content from TextNodes
        const textNodeContext = connectedNodes
            .filter(n => n.type === 'textNode')
            .map(n => (n.data as any).content)
            .filter(Boolean);

        // Combine all text context
        const contextQuestions = [...mindNodeContext, ...textNodeContext].join('\n\n');

        // Get image URLs from ImageNodes
        const imageUrls = connectedNodes
            .filter(n => n.type === 'imageNode')
            .map(n => (n.data as any).src)
            .filter(Boolean);

        const color = (aiNode.data as any).color || 'pastel-blue';

        // Show loading state - convert to mindNode with typing indicator
        set({
            nodes: get().nodes.map(node => {
                if (node.id === nodeId) {
                    return {
                        ...node,
                        type: 'mindNode',
                        // Set default dimensions for resizable node
                        width: 350,
                        height: undefined, // Auto-height based on content
                        style: { width: 350 },
                        data: {
                            question,
                            response: '●●●', // Typing indicator
                            tags: [{ id: generateId(), label: 'AI Generated' }],
                            color,
                            createdAt: new Date(),
                            isTyping: true, // Flag for animation
                        } as MindNodeData,
                    } as MindNodeType;
                }
                return node;
            }),
        });

        // Generate real AI response (with images if present)
        try {
            const aiResponse = await generateAIResponse(
                question,
                contextQuestions || undefined,
                imageUrls.length > 0 ? imageUrls : undefined
            );

            // Typewriter effect - reveal text character by character
            const typewriterSpeed = 15; // ms per character
            let currentIndex = 0;

            const typewriterInterval = setInterval(() => {
                currentIndex += 2; // Type 2 chars at a time for speed
                const partialResponse = aiResponse.substring(0, currentIndex);

                set({
                    nodes: get().nodes.map(node => {
                        if (node.id === nodeId) {
                            return {
                                ...node,
                                data: {
                                    ...(node.data as MindNodeData),
                                    response: partialResponse + (currentIndex < aiResponse.length ? '▌' : ''),
                                    isTyping: currentIndex < aiResponse.length,
                                },
                            } as MindNodeType;
                        }
                        return node;
                    }),
                });

                if (currentIndex >= aiResponse.length) {
                    clearInterval(typewriterInterval);
                    // Final update without cursor
                    set({
                        nodes: get().nodes.map(node => {
                            if (node.id === nodeId) {
                                return {
                                    ...node,
                                    data: {
                                        ...(node.data as MindNodeData),
                                        response: aiResponse,
                                        isTyping: false,
                                    },
                                } as MindNodeType;
                            }
                            return node;
                        }),
                    });
                }
            }, typewriterSpeed);

        } catch (error) {
            console.error('AI generation error:', error);
            // Update with error message
            set({
                nodes: get().nodes.map(node => {
                    if (node.id === nodeId) {
                        return {
                            ...node,
                            data: {
                                ...(node.data as MindNodeData),
                                response: 'Sorry, I couldn\'t generate a response. Please try again.',
                                isTyping: false,
                            },
                        } as MindNodeType;
                    }
                    return node;
                }),
            });
        }

        // FORCE REFRESH EDGES
        set((state) => ({
            edges: state.edges.map(edge => {
                if (edge.source === nodeId || edge.target === nodeId) {
                    return { ...edge };
                }
                return edge;
            })
        }));

        // RELEASE LOCK
        setTimeout(() => {
            set((state) => ({
                isProcessingConversion: false,
                edges: [...state.edges]
            }));
        }, 500);
    },

    // Update a tag's label
    updateTag: (nodeId: string, tagId: string, newLabel: string) => {
        set({
            nodes: get().nodes.map(node => {
                if (node.id === nodeId && node.type === 'mindNode') {
                    const data = node.data as MindNodeData;
                    return {
                        ...node,
                        data: {
                            ...data,
                            tags: data.tags.map(tag =>
                                tag.id === tagId ? { ...tag, label: newLabel } : tag
                            ),
                        },
                    };
                }
                return node;
            }),
        });
    },

    // Add a new tag to a node
    addTag: (nodeId: string, label: string) => {
        set({
            nodes: get().nodes.map(node => {
                if (node.id === nodeId && node.type === 'mindNode') {
                    const data = node.data as MindNodeData;
                    return {
                        ...node,
                        data: {
                            ...data,
                            tags: [...data.tags, { id: generateId(), label }],
                        },
                    };
                }
                return node;
            }),
        });
    },

    // Remove a tag from a node
    removeTag: (nodeId: string, tagId: string) => {
        set({
            nodes: get().nodes.map(node => {
                if (node.id === nodeId && node.type === 'mindNode') {
                    const data = node.data as MindNodeData;
                    return {
                        ...node,
                        data: {
                            ...data,
                            tags: data.tags.filter(tag => tag.id !== tagId),
                        },
                    };
                }
                return node;
            }),
        });
    },

    // Add an image node
    addImageNode: (file: File, position: { x: number; y: number }) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            if (!src) return;

            // Generate a simple ID
            const nodeId = `img-${Date.now()}`;

            const newNode: any = { // Using any temporarily to avoid strict type issues during implementation
                id: nodeId,
                type: 'imageNode',
                position,
                style: { width: 300 }, // Initial size for React Flow
                data: {
                    src,
                    fileName: file.name,
                    width: 300, // Keep data sync if needed, but style is primary for display
                    rotation: 0
                }
            };

            set((state) => {
                // Deselect all other nodes
                const updatedNodes = state.nodes.map(n => ({ ...n, selected: false }));
                const newNodeWithSelection = { ...newNode, selected: true };
                return {
                    nodes: [...updatedNodes, newNodeWithSelection],
                };
            });
        };
        reader.readAsDataURL(file);
    },

    // Add a new Text Node at given position
    addTextNode: (position: { x: number; y: number }) => {
        const nodeId = generateId();
        const color = getRandomPastelColor();

        const newNode: any = {
            id: nodeId,
            type: 'textNode',
            position,
            data: {
                content: '',
                fontSize: 'medium' as const,
                fontWeight: 'normal' as const,
                textAlign: 'left' as const,
                color,
            },
        };

        // Deselect all other nodes
        const updatedNodes = get().nodes.map(n => ({ ...n, selected: false }));
        const newNodeWithSelection = { ...newNode, selected: true };

        set({
            nodes: [...updatedNodes, newNodeWithSelection],
        });
    },

    // Update node color and propagate to all connected children
    updateNodeColorWithChildren: (nodeId: string, color: PastelColor) => {
        const edges = get().edges;
        const nodes = get().nodes;

        // Find all connected node IDs (both directions since edges can be reversed)
        const visited = new Set<string>();

        const getConnectedChildIds = (currentId: string): string[] => {
            if (visited.has(currentId)) return [];
            visited.add(currentId);

            const connectedIds: string[] = [];

            edges.forEach(edge => {
                // Check both directions - node could be source or target
                if (edge.source === currentId && !visited.has(edge.target)) {
                    connectedIds.push(edge.target);
                }
                if (edge.target === currentId && !visited.has(edge.source)) {
                    connectedIds.push(edge.source);
                }
            });

            // Recursively get all connected nodes
            const allConnected: string[] = [...connectedIds];
            connectedIds.forEach(connectedId => {
                allConnected.push(...getConnectedChildIds(connectedId));
            });

            return allConnected;
        };

        const connectedIds = getConnectedChildIds(nodeId);
        const nodesToUpdate = new Set([nodeId, ...connectedIds]);

        set({
            nodes: nodes.map(node => {
                if (nodesToUpdate.has(node.id)) {
                    return {
                        ...node,
                        data: { ...node.data, color },
                    } as CanvasNodeType;
                }
                return node;
            }),
        });
    },

    // Get all connected nodes (bidirectional traversal)
    // Traverses entire connected graph to ensure AI gets full context
    getConnectedNodes: (nodeId: string) => {
        const edges = get().edges;
        const nodes = get().nodes;

        const connectedIds = new Set<string>();

        // Recursive function to find ALL connected nodes (both directions)
        const findConnected = (currentId: string) => {
            edges.forEach(edge => {
                // Check both directions
                if (edge.source === currentId && !connectedIds.has(edge.target)) {
                    connectedIds.add(edge.target);
                    findConnected(edge.target);
                }
                if (edge.target === currentId && !connectedIds.has(edge.source)) {
                    connectedIds.add(edge.source);
                    findConnected(edge.source);
                }
            });
        };

        findConnected(nodeId);

        // Return all connected nodes except the node itself
        return nodes.filter(n => connectedIds.has(n.id) && n.id !== nodeId);
    },

    // Get all edges connected to a specific handle on a node
    getEdgesForHandle: (nodeId: string, handleId: string) => {
        const edges = get().edges;
        return edges.filter(edge =>
            (edge.source === nodeId && edge.sourceHandle === handleId) ||
            (edge.target === nodeId && edge.targetHandle === handleId)
        );
    },

    // Disconnect (remove) a specific edge
    disconnectEdge: (edgeId: string) => {
        set({
            edges: get().edges.filter(edge => edge.id !== edgeId),
        });
    },

    // Delete a node and all connected edges
    deleteNode: (nodeId: string) => {
        set({
            // Remove the node
            nodes: get().nodes.filter(n => n.id !== nodeId),
            // Remove all edges connected to this node
            edges: get().edges.filter(edge =>
                edge.source !== nodeId && edge.target !== nodeId
            ),
        });
    },

    // Regenerate AI response for a node (re-ask with same question)
    regenerateNode: async (nodeId: string) => {
        const state = get();
        const node = state.nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'mindNode') return;

        const data = node.data as MindNodeData;
        const question = data.question;
        if (!question) return;

        // Show loading state
        set({
            nodes: get().nodes.map(n => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        data: {
                            ...(n.data as MindNodeData),
                            response: '●●●',
                            isTyping: true,
                        },
                    } as MindNodeType;
                }
                return n;
            }),
        });

        // Gather context from connected nodes
        const connectedNodes = state.getConnectedNodes(nodeId);

        const mindNodeContext = connectedNodes
            .filter(n => n.type === 'mindNode')
            .map(n => {
                const d = n.data as MindNodeData;
                return `${d.question}\n${d.response}`;
            })
            .filter(Boolean);

        const textNodeContext = connectedNodes
            .filter(n => n.type === 'textNode')
            .map(n => (n.data as any).content)
            .filter(Boolean);

        const contextQuestions = [...mindNodeContext, ...textNodeContext].join('\n\n');

        const imageUrls = connectedNodes
            .filter(n => n.type === 'imageNode')
            .map(n => (n.data as any).src)
            .filter(Boolean);

        try {
            const aiResponse = await generateAIResponse(
                question,
                contextQuestions || undefined,
                imageUrls.length > 0 ? imageUrls : undefined
            );

            // Typewriter effect
            const typewriterSpeed = 15;
            let currentIndex = 0;

            const typewriterInterval = setInterval(() => {
                currentIndex += 2;
                if (currentIndex >= aiResponse.length) {
                    clearInterval(typewriterInterval);
                    set({
                        nodes: get().nodes.map(n => {
                            if (n.id === nodeId) {
                                return {
                                    ...n,
                                    data: {
                                        ...(n.data as MindNodeData),
                                        response: aiResponse,
                                        isTyping: false,
                                    },
                                } as MindNodeType;
                            }
                            return n;
                        }),
                    });
                } else {
                    set({
                        nodes: get().nodes.map(n => {
                            if (n.id === nodeId) {
                                return {
                                    ...n,
                                    data: {
                                        ...(n.data as MindNodeData),
                                        response: aiResponse.slice(0, currentIndex) + '▌',
                                        isTyping: true,
                                    },
                                } as MindNodeType;
                            }
                            return n;
                        }),
                    });
                }
            }, typewriterSpeed);
        } catch (error) {
            console.error('Regenerate error:', error);
            set({
                nodes: get().nodes.map(n => {
                    if (n.id === nodeId) {
                        return {
                            ...n,
                            data: {
                                ...(n.data as MindNodeData),
                                response: 'Sorry, I encountered an error. Please try again.',
                                isTyping: false,
                            },
                        } as MindNodeType;
                    }
                    return n;
                }),
            });
        }
    },

    // Duplicate a node (create a copy next to it)
    duplicateNode: (nodeId: string) => {
        const state = get();
        const node = state.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const newNodeId = generateId();
        const offset = 50; // Offset position

        const newNode = {
            ...node,
            id: newNodeId,
            position: {
                x: node.position.x + offset,
                y: node.position.y + offset,
            },
            selected: false,
            data: {
                ...node.data,
                // If MindNode, update tags with new IDs
                ...(node.type === 'mindNode' && {
                    tags: (node.data as MindNodeData).tags.map(tag => ({
                        ...tag,
                        id: generateId(),
                    })),
                }),
            },
        };

        set({
            nodes: [...get().nodes, newNode as CanvasNodeType],
        });
    },


    // Toggle Collapse/Expand for a node's children
    toggleNodeCollapse: (nodeId: string) => {
        const state = get();
        const targetNode = state.nodes.find(n => n.id === nodeId);
        if (!targetNode || targetNode.type !== 'mindNode') return;

        const isCollapsing = !(targetNode.data as MindNodeData).collapsed;

        // 1. Update the target node's collapsed state
        const updatedNodes = state.nodes.map(node => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: { ...node.data, collapsed: isCollapsing }
                };
            }
            return node;
        });

        // 2. Recursive function to set visibility
        const setVisibilityRecursively = (currentId: string, shouldHide: boolean) => {
            // Find all children connected to currentId
            const childrenEdges = state.edges.filter(e => e.source === currentId);
            const childrenIds = childrenEdges.map(e => e.target);

            childrenIds.forEach(childId => {
                const childNode = updatedNodes.find(n => n.id === childId);
                if (!childNode) return;

                // Update child visibility
                const childIndex = updatedNodes.findIndex(n => n.id === childId);
                if (childIndex !== -1) {
                    updatedNodes[childIndex] = {
                        ...updatedNodes[childIndex],
                        hidden: shouldHide
                    };
                }

                // Recurse:
                if (shouldHide) {
                    setVisibilityRecursively(childId, true);
                } else {
                    // Only expand descendants if this child is NOT collapsed itself
                    const isChildCollapsed = (childNode.type === 'mindNode' && (childNode.data as MindNodeData).collapsed);
                    if (!isChildCollapsed) {
                        setVisibilityRecursively(childId, false);
                    }
                }
            });
        };

        setVisibilityRecursively(nodeId, isCollapsing);

        set({ nodes: updatedNodes as CanvasNodeType[] });
    },

    // Tidy Up / Auto-Layout nodes respecting original handle directions
    tidyUpNodes: () => {
        const nodes = get().nodes;
        const edges = get().edges;

        if (nodes.length === 0) return;

        // Configuration - offsets based on handle direction (increased for clarity)
        const DIRECTION_OFFSETS: Record<string, { x: number; y: number }> = {
            top: { x: 0, y: -300 },
            bottom: { x: 0, y: 300 },
            left: { x: -500, y: 0 },
            right: { x: 500, y: 0 },
        };
        const STACK_OFFSET = 450; // Offset for multiple children in same direction (node width + gap)

        // Build edge info with direction
        interface EdgeInfo {
            childId: string;
            direction: string;
        }
        const childrenByParent: Record<string, EdgeInfo[]> = {};
        const parentMap: Record<string, string> = {};

        edges.forEach(edge => {
            const direction = edge.sourceHandle || 'bottom'; // Default to bottom
            if (!childrenByParent[edge.source]) childrenByParent[edge.source] = [];
            childrenByParent[edge.source].push({ childId: edge.target, direction });
            parentMap[edge.target] = edge.source;
        });

        // Find root nodes (no incoming edges)
        const rootNodes = nodes.filter(n => !parentMap[n.id]);

        if (rootNodes.length === 0 && nodes.length > 0) {
            rootNodes.push(nodes[0]);
        }

        // Position nodes
        const nodePositions: Record<string, { x: number; y: number }> = {};
        const placedNodes = new Set<string>();

        // Recursive positioning function with level tracking
        const positionNode = (nodeId: string, x: number, y: number, level: number) => {
            if (placedNodes.has(nodeId)) return;
            placedNodes.add(nodeId);
            nodePositions[nodeId] = { x, y };

            // Get children grouped by direction
            const childrenInfo = childrenByParent[nodeId] || [];
            const byDirection: Record<string, string[]> = {
                top: [],
                bottom: [],
                left: [],
                right: [],
            };

            childrenInfo.forEach(info => {
                const dir = info.direction || 'bottom';
                if (!byDirection[dir]) byDirection[dir] = [];
                byDirection[dir].push(info.childId);
            });

            // Position children in each direction with level-based spacing
            const levelMultiplier = 1 + level * 0.3; // Increase spacing for deeper levels

            Object.entries(byDirection).forEach(([direction, childIds]) => {
                if (childIds.length === 0) return;

                const baseOffset = DIRECTION_OFFSETS[direction] || DIRECTION_OFFSETS.bottom;
                const adjustedStackOffset = STACK_OFFSET * levelMultiplier;

                childIds.forEach((childId, index) => {
                    // Calculate stacking offset for multiple children in same direction
                    let stackX = 0;
                    let stackY = 0;

                    if (direction === 'top' || direction === 'bottom') {
                        // Stack horizontally for vertical directions
                        const totalWidth = (childIds.length - 1) * adjustedStackOffset;
                        stackX = -totalWidth / 2 + index * adjustedStackOffset;
                    } else {
                        // Stack vertically for horizontal directions
                        const totalHeight = (childIds.length - 1) * adjustedStackOffset;
                        stackY = -totalHeight / 2 + index * adjustedStackOffset;
                    }

                    const childX = x + baseOffset.x * levelMultiplier + stackX;
                    const childY = y + baseOffset.y * levelMultiplier + stackY;

                    positionNode(childId, childX, childY, level + 1);
                });
            });
        };

        // Position each root and its tree
        let rootX = 0;
        const ROOT_GAP = 600;

        rootNodes.forEach(root => {
            positionNode(root.id, rootX, 0, 0); // Start at level 0
            rootX += ROOT_GAP;
        });

        // Handle disconnected nodes
        const disconnected = nodes.filter(n => !placedNodes.has(n.id));
        if (disconnected.length > 0) {
            const maxY = Math.max(...Object.values(nodePositions).map(p => p.y), 0);
            let disconnectedX = 0;

            disconnected.forEach(node => {
                nodePositions[node.id] = { x: disconnectedX, y: maxY + 300 };
                disconnectedX += 450;
            });
        }

        // ========== COLLISION DETECTION & RESOLUTION ==========
        const NODE_WIDTH = 380;
        const NODE_HEIGHT = 200;
        const PADDING = 40;

        // Check if two nodes overlap
        const nodesOverlap = (pos1: { x: number; y: number }, pos2: { x: number; y: number }) => {
            const overlapX = Math.abs(pos1.x - pos2.x) < (NODE_WIDTH + PADDING);
            const overlapY = Math.abs(pos1.y - pos2.y) < (NODE_HEIGHT + PADDING);
            return overlapX && overlapY;
        };

        // Resolve overlaps iteratively (max 50 iterations to prevent infinite loop)
        const nodeIds = Object.keys(nodePositions);
        for (let iteration = 0; iteration < 50; iteration++) {
            let hasOverlap = false;

            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const id1 = nodeIds[i];
                    const id2 = nodeIds[j];
                    const pos1 = nodePositions[id1];
                    const pos2 = nodePositions[id2];

                    if (nodesOverlap(pos1, pos2)) {
                        hasOverlap = true;

                        // Calculate push direction
                        const dx = pos2.x - pos1.x;
                        const dy = pos2.y - pos1.y;

                        // Push apart by half the required distance each
                        const pushX = dx === 0 ? 50 : (dx > 0 ? 50 : -50);
                        const pushY = dy === 0 ? 30 : (dy > 0 ? 30 : -30);

                        nodePositions[id1] = { x: pos1.x - pushX, y: pos1.y - pushY };
                        nodePositions[id2] = { x: pos2.x + pushX, y: pos2.y + pushY };
                    }
                }
            }

            // If no overlaps found, we're done
            if (!hasOverlap) break;
        }

        // Apply positions
        set({
            nodes: nodes.map(node => ({
                ...node,
                position: nodePositions[node.id] || node.position,
            })) as CanvasNodeType[],
        });
    },
}));
