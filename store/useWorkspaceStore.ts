"use client";

import { create } from 'zustand';
import { Edge } from 'reactflow';
import { Workspace, WorkspaceStoreState, CanvasNodeType, FrameRegion } from '@/types';
import { generateId } from '@/lib/utils';
import { useMindStore } from './useMindStore';
import { supabase } from '@/lib/supabase';
import { getWorkspaceLimit } from '@/lib/creditCosts';

// Guest workspace limit — stricter than Free to encourage sign-up
const GUEST_WORKSPACE_LIMIT = 1;

// Store for current viewport (set by CanvasWrapper)
let currentViewport = { x: 0, y: 0, zoom: 1 };

export const setCurrentViewport = (viewport: { x: number; y: number; zoom: number }) => {
    currentViewport = viewport;
};

export const getCurrentViewport = () => currentViewport;

const STORAGE_KEY = 'spatial-ai-workspaces';
const ACTIVE_WORKSPACE_KEY = 'spatial-ai-active-workspace';
export const FRAME_NODE_TYPE = '__frame_region__';

// Debounce helper for cloud saving
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 2000; // 2 seconds debounce
let pendingCloudSavePromise: Promise<void> | null = null;
let resolvePendingCloudSave: (() => void) | null = null;
let rejectPendingCloudSave: ((reason?: unknown) => void) | null = null;

const toError = (error: unknown): Error => {
    if (error instanceof Error) {
        return error;
    }

    if (typeof error === 'string') {
        return new Error(error);
    }

    if (error && typeof error === 'object') {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
            return new Error(maybeMessage);
        }

        try {
            return new Error(JSON.stringify(error));
        } catch {
            return new Error('Unknown workspace error');
        }
    }

    return new Error('Unknown workspace error');
};

const createPendingCloudSavePromise = () => {
    if (!pendingCloudSavePromise) {
        pendingCloudSavePromise = new Promise<void>((resolve, reject) => {
            resolvePendingCloudSave = resolve;
            rejectPendingCloudSave = reject;
        });
    }

    return pendingCloudSavePromise;
};

const settlePendingCloudSave = (error?: unknown) => {
    if (error) {
        rejectPendingCloudSave?.(toError(error));
    } else {
        resolvePendingCloudSave?.();
    }

    pendingCloudSavePromise = null;
    resolvePendingCloudSave = null;
    rejectPendingCloudSave = null;
};

/**
 * Utility to guarantee strictly valid numerical positions for React Flow nodes
 * This serves as an absolute firewall against infinite NaN layout crashes
 */
const sanitizeNodes = (nodes: unknown[]): CanvasNodeType[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map(node => {
        const safeNode = { ...(node as Record<string, unknown>) } as CanvasNodeType;
        if (!safeNode.position) safeNode.position = { x: 0, y: 0 };
        safeNode.position.x = typeof safeNode.position.x === 'number' && Number.isFinite(safeNode.position.x) ? safeNode.position.x : 0;
        safeNode.position.y = typeof safeNode.position.y === 'number' && Number.isFinite(safeNode.position.y) ? safeNode.position.y : 0;
        
        if (safeNode.width !== undefined && (typeof safeNode.width !== 'number' || !Number.isFinite(safeNode.width))) delete safeNode.width;
        if (safeNode.height !== undefined && (typeof safeNode.height !== 'number' || !Number.isFinite(safeNode.height))) delete safeNode.height;

        return safeNode;
    });
};

const sanitizeEdges = (edges: unknown[]): Edge[] => {
    if (!Array.isArray(edges)) return [];
    return edges.map(edge => {
        const safeEdge = { ...(edge as Edge) };
        delete safeEdge.selected;
        return safeEdge;
    });
};

const sanitizeFrame = (frame: Partial<FrameRegion>): FrameRegion | null => {
    const width = typeof frame.width === 'number' && Number.isFinite(frame.width) ? frame.width : 0;
    const height = typeof frame.height === 'number' && Number.isFinite(frame.height) ? frame.height : 0;

    if (width <= 0 || height <= 0) return null;

    return {
        id: typeof frame.id === 'string' && frame.id ? frame.id : generateId(),
        x: typeof frame.x === 'number' && Number.isFinite(frame.x) ? frame.x : 0,
        y: typeof frame.y === 'number' && Number.isFinite(frame.y) ? frame.y : 0,
        width,
        height,
        createdAt: frame.createdAt ? new Date(frame.createdAt) : new Date(),
        updatedAt: frame.updatedAt ? new Date(frame.updatedAt) : new Date(),
    };
};

type PersistedFrameCarrier = {
    id: string;
    type: typeof FRAME_NODE_TYPE;
    position: { x: number; y: number };
    data: { frame: FrameRegion };
};

const isPersistedFrameCarrier = (node: unknown): node is PersistedFrameCarrier => {
    return typeof node === 'object' && node !== null && (node as { type?: unknown }).type === FRAME_NODE_TYPE;
};

export const extractFramesFromPersistedNodes = (nodes: unknown[]): { nodes: unknown[]; frames: FrameRegion[] } => {
    if (!Array.isArray(nodes)) {
        return { nodes: [], frames: [] };
    }

    const visibleNodes: unknown[] = [];
    const frames: FrameRegion[] = [];

    nodes.forEach((node) => {
        if (isPersistedFrameCarrier(node)) {
            const frame = sanitizeFrame(node.data?.frame);
            if (frame) {
                frames.push(frame);
            }
            return;
        }

        visibleNodes.push(node);
    });

    return { nodes: visibleNodes, frames };
};

export const getPersistableNodes = (nodes: CanvasNodeType[]): CanvasNodeType[] => (
    nodes
        .filter((node) => {
        if (node.type !== 'imageNode') return true;

        const imageData = node.data as { isUploading?: boolean };
        return imageData.isUploading !== true;
    })
        .map((node) => {
            const persistableNode = { ...node } as CanvasNodeType & Record<string, unknown>;
            delete persistableNode.selected;
            delete persistableNode.dragging;
            delete persistableNode.resizing;
            delete persistableNode.positionAbsolute;
            delete persistableNode.measured;
            return persistableNode as CanvasNodeType;
        })
);

export const getPersistableEdges = (edges: Edge[]): Edge[] => (
    edges.map((edge) => {
        const persistableEdge = { ...edge };
        delete persistableEdge.selected;
        return persistableEdge;
    })
);

export const serializeWorkspaceNodes = (nodes: CanvasNodeType[], frames: FrameRegion[]): CanvasNodeType[] => {
    const visibleNodes = getPersistableNodes(nodes);
    const frameNodes = frames.map((frame) => ({
        id: `frame-region-${frame.id}`,
        type: FRAME_NODE_TYPE,
        position: { x: frame.x, y: frame.y },
        data: { frame },
    })) as unknown as CanvasNodeType[];

    return [...visibleNodes, ...frameNodes];
};

/**
 * Workspace Store - Managed hybrid persistence (LocalStorage for Guest, Supabase for User)
 */
export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
    workspaces: [],
    activeWorkspaceId: null,
    isSidebarOpen: false,
    isLoaded: false,
    userId: null,
    isLoading: false,

    setUserId: (userId: string | null) => {
        const currentUserId = get().userId;
        if (currentUserId !== userId) {
            set({ userId, isLoaded: false });
            get().loadWorkspaces();

            // Sync credits when user logs in
            import('./useCreditStore').then(({ useCreditStore }) => {
                useCreditStore.getState().initializeCredits();
            });

            // Load AI settings from Supabase for this user
            if (userId) {
                import('./useAISettingsStore').then(({ useAISettingsStore }) => {
                    useAISettingsStore.getState().loadSettingsFromProfile(userId);
                });
            }
        }
    },

    setSidebarOpen: (open: boolean) => {
        set({ isSidebarOpen: open });
    },

    createWorkspace: async (name?: string) => {
        // === WORKSPACE LIMIT CHECK (Client-side hint, server enforces) ===
        const { userId } = get();
        const currentCount = get().workspaces.length;

        if (!userId) {
            // Guest: max 1 workspace
            if (currentCount >= GUEST_WORKSPACE_LIMIT) return null;
        } else {
            // Client-side quick check (UX hint, not security boundary)
            const limit = getWorkspaceLimit();
            if (limit !== -1 && currentCount >= limit) return null;
            // Server-side tier enforcement runs non-blocking during cloud insert (see below)
        }

        // Save current workspace first to prevent data loss (Async, non-blocking)
        get().saveCurrentWorkspace(true).catch(console.error);

        const id = generateId();
        const newWorkspace: Workspace = {
            id,
            name: name || `My Board ${get().workspaces.length + 1}`,
            nodes: [],
            edges: [],
            frames: [],
            strokes: [],
            arrows: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isFavorite: false,
        };

        // Optimistic update
        set(state => ({
            workspaces: [newWorkspace, ...state.workspaces],
            activeWorkspaceId: id,
        }));

        // Clear canvas
        useMindStore.setState({ nodes: [], edges: [], frames: [], selectedFrameId: null, strokes: [], arrows: [], strokeHistory: [], strokeFuture: [], pendingViewport: { x: 0, y: 0, zoom: 1 } });

        if (userId) {
            // Cloud Create + Server-side validation (non-blocking for instant UX)
            try {
                const { data: cloudData, error } = await supabase
                    .from('workspaces')
                    .insert({
                        user_id: userId,
                        name: newWorkspace.name,
                        nodes: serializeWorkspaceNodes([], []),
                        edges: [],
                        strokes: [],
                        arrows: []
                    })
                    .select()
                    .single();

                if (error) throw error;

                const cloudId = cloudData?.id;
                // Update local workspace ID with the cloud ID
                if (cloudId) {
                    set(state => ({
                        workspaces: state.workspaces.map(w =>
                            w.id === id ? { ...w, id: cloudId } : w
                        ),
                        activeWorkspaceId: cloudId
                    }));
                }

                // SECURITY: Server-side tier enforcement (non-blocking — rollback if rejected)
                // Runs AFTER optimistic UI update so there's no delay felt by the user
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (!session?.access_token) return;
                    fetch('/api/workspace/validate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({ action: 'create_workspace' })
                    })
                    .then(r => r.json())
                    .then(validation => {
                        if (!validation.allowed && cloudId) {
                            // Rollback: delete from cloud and remove from local state
                            supabase.from('workspaces').delete().eq('id', cloudId).eq('user_id', userId).then(() => {
                                set(state => ({
                                    workspaces: state.workspaces.filter(w => w.id !== cloudId),
                                    activeWorkspaceId: state.workspaces.find(w => w.id !== cloudId)?.id || null
                                }));
                            });
                        }
                    })
                    .catch(() => {}); // Allow if validation call fails
                });

            } catch (e) {
                console.error("Cloud create failed", e);
            }
        } else {
            // Local Save
            void get().saveCurrentWorkspace(true).catch((error) => {
                console.error('Failed to save local workspace:', toError(error));
            });
        }

        return id;
    },

    switchWorkspace: async (workspaceId: string) => {
        // Save current first (Async, non-blocking)
        get().saveCurrentWorkspace(true).catch(console.error);

        const workspace = get().workspaces.find(w => w.id === workspaceId);
        if (!workspace) return;

        // Deep copy to prevent React Flow mutation bugs across renders
        const safeNodes = sanitizeNodes(JSON.parse(JSON.stringify(workspace.nodes || [])));
        const safeEdges = sanitizeEdges(JSON.parse(JSON.stringify(workspace.edges || [])));

        // Load into mind store
        useMindStore.setState({
            nodes: safeNodes,
            edges: safeEdges,
            frames: workspace.frames || [],
            selectedFrameId: null,
            strokes: workspace.strokes || [],
            arrows: workspace.arrows || [],
            strokeHistory: [],
            strokeFuture: [],
            // Set pending viewport for CanvasWrapper to apply
            pendingViewport: workspace.viewport || { x: 0, y: 0, zoom: 1 },
        });

        set({ activeWorkspaceId: workspaceId });

        if (!get().userId) {
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
        }
    },

    deleteWorkspace: async (workspaceId: string) => {
        const state = get();
        const { userId } = state;
        const newWorkspaces = state.workspaces.filter(w => w.id !== workspaceId);

        // Switch active if needed
        let newActiveId = state.activeWorkspaceId;
        if (state.activeWorkspaceId === workspaceId) {
            newActiveId = newWorkspaces.length > 0 ? newWorkspaces[0].id : null;
            if (newActiveId) {
                const newActive = newWorkspaces.find(w => w.id === newActiveId);
                if (newActive) {
                    const safeNodes = sanitizeNodes(JSON.parse(JSON.stringify(newActive.nodes || [])));
                    const safeEdges = sanitizeEdges(JSON.parse(JSON.stringify(newActive.edges || [])));
                    useMindStore.setState({
                        nodes: safeNodes,
                        edges: safeEdges,
                        frames: newActive.frames || [],
                        selectedFrameId: null,
                        strokes: newActive.strokes || [],
                        arrows: newActive.arrows || [],
                        strokeHistory: [],
                        strokeFuture: [],
                        pendingViewport: newActive.viewport || { x: 0, y: 0, zoom: 1 },
                    });
                }
            } else {
                useMindStore.setState({ nodes: [], edges: [], frames: [], selectedFrameId: null, strokes: [], arrows: [], strokeHistory: [], strokeFuture: [], pendingViewport: { x: 0, y: 0, zoom: 1 } });
            }
        }

        set({
            workspaces: newWorkspaces,
            activeWorkspaceId: newActiveId,
        });

        if (userId) {
            const { error } = await supabase
                .from('workspaces')
                .delete()
                .eq('id', workspaceId)
                .eq('user_id', userId);
            if (error) console.error("Cloud delete failed", toError(error));
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newWorkspaces));
            if (newActiveId) localStorage.setItem(ACTIVE_WORKSPACE_KEY, newActiveId);
            else localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
        }
    },

    renameWorkspace: async (workspaceId: string, newName: string) => {
        const { userId } = get();
        set(state => ({
            workspaces: state.workspaces.map(w =>
                w.id === workspaceId ? { ...w, name: newName, updatedAt: new Date() } : w
            ),
        }));

        if (userId) {
            const { error } = await supabase
                .from('workspaces')
                .update({ name: newName, updated_at: new Date().toISOString() })
                .eq('id', workspaceId)
                .eq('user_id', userId);

            if (error) {
                console.error('Failed to rename workspace:', toError(error));
            }
        } else {
            void get().saveCurrentWorkspace(true).catch((error) => {
                console.error('Failed to save local workspace:', toError(error));
            });
        }
    },

    toggleWorkspaceFavorite: async (workspaceId: string) => {
        const { userId } = get();
        // Optimistic
        let newState = false;
        set(state => {
            const ws = state.workspaces.find(w => w.id === workspaceId);
            if (ws) newState = !ws.isFavorite;
            return {
                workspaces: state.workspaces.map(w =>
                    w.id === workspaceId ? { ...w, isFavorite: !w.isFavorite } : w
                ),
            };
        });

        if (userId) {
            const { error } = await supabase
                .from('workspaces')
                .update({ is_favorite: newState })
                .eq('id', workspaceId)
                .eq('user_id', userId);

            if (error) {
                console.error('Failed to toggle workspace favorite:', toError(error));
            }
        } else {
            void get().saveCurrentWorkspace(true).catch((error) => {
                console.error('Failed to save local workspace:', toError(error));
            });
        }
    },

    saveCurrentWorkspace: async (immediate = false) => {
        const state = get();
        if (!state.activeWorkspaceId) return;

        const mindState = useMindStore.getState();

        const updatedWorkspaces = state.workspaces.map(w =>
            w.id === state.activeWorkspaceId
                ? {
                    ...w,
                    nodes: getPersistableNodes(mindState.nodes),
                    edges: getPersistableEdges(mindState.edges),
                    frames: mindState.frames,
                    strokes: mindState.strokes,
                    arrows: mindState.arrows,
                    viewport: currentViewport,
                    updatedAt: new Date(),
                }
                : w
        );

        set({ workspaces: updatedWorkspaces });

        if (state.userId) {
            // Cloud Save Logic
            const saveToCloud = async () => {
                const ws = updatedWorkspaces.find(w => w.id === state.activeWorkspaceId);
                if (ws) {
                    const { error } = await supabase
                        .from('workspaces')
                        .update({
                            nodes: serializeWorkspaceNodes(ws.nodes, ws.frames),
                            edges: ws.edges,
                            strokes: ws.strokes,
                            arrows: ws.arrows,
                            viewport_x: currentViewport.x,
                            viewport_y: currentViewport.y,
                            viewport_zoom: currentViewport.zoom,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', ws.id)
                        .eq('user_id', state.userId);

                    if (error) {
                        throw toError(error);
                    }
                }
            };

            if (saveTimeout) clearTimeout(saveTimeout);

            if (immediate) {
                try {
                    await saveToCloud();
                    settlePendingCloudSave();
                } catch (error) {
                    const normalizedError = toError(error);
                    settlePendingCloudSave(normalizedError);
                    throw normalizedError;
                }
            } else {
                const pendingSave = createPendingCloudSavePromise();

                saveTimeout = setTimeout(() => {
                    void (async () => {
                        try {
                            await saveToCloud();
                            settlePendingCloudSave();
                        } catch (error) {
                            const normalizedError = toError(error);
                            console.error('Cloud autosave failed:', normalizedError);
                            settlePendingCloudSave(normalizedError);
                        } finally {
                            saveTimeout = null;
                        }
                    })();
                }, SAVE_DELAY);

                return pendingSave;
            }

        } else {
            // Local Save
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWorkspaces));
            } catch (e) {
                console.error('Failed to save workspaces to localStorage:', e);
            }
        }
    },

    loadWorkspaces: async () => {
        const { userId, isLoading } = get();

        // Guard: prevent parallel execution (race condition)
        if (isLoading) {
            console.log('[Workspace] loadWorkspaces skipped — already loading');
            return;
        }
        set({ isLoading: true });

        if (userId) {
            // Cloud Load
            try {
                const { data, error } = await supabase
                    .from('workspaces')
                    .select('*')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false });

                if (error) {
                    throw toError(error);
                }

                if (data) {
                    const workspaces: Workspace[] = data.map((w) => {
                        const extracted = extractFramesFromPersistedNodes(w.nodes || []);

                        return {
                            id: w.id,
                            name: w.name,
                            nodes: sanitizeNodes(extracted.nodes),
                            edges: sanitizeEdges(w.edges || []),
                            frames: extracted.frames,
                            strokes: w.strokes || [],
                            arrows: w.arrows || [],
                            viewport: { x: w.viewport_x || 0, y: w.viewport_y || 0, zoom: w.viewport_zoom || 1 },
                            createdAt: new Date(w.created_at),
                            updatedAt: new Date(w.updated_at),
                            isFavorite: w.is_favorite
                        };
                    });

                    const activeId = workspaces.length > 0 ? workspaces[0].id : null;

                    set({ workspaces, activeWorkspaceId: activeId });

                    if (activeId) {
                        const active = workspaces.find(w => w.id === activeId);
                        if (active) {
                            const safeNodes = sanitizeNodes(JSON.parse(JSON.stringify(active.nodes || [])));
                            const safeEdges = sanitizeEdges(JSON.parse(JSON.stringify(active.edges || [])));
                            useMindStore.setState({
                                nodes: safeNodes,
                                edges: safeEdges,
                                frames: active.frames || [],
                                selectedFrameId: null,
                                strokes: active.strokes || [],
                                arrows: active.arrows || [],
                                strokeHistory: [],
                                strokeFuture: [],
                                pendingViewport: active.viewport || { x: 0, y: 0, zoom: 1 },
                            });
                        }
                    } else {
                        if (workspaces.length === 0) {
                            get().createWorkspace("My First Workspace");
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load cloud workspaces", toError(e));
            }
        } else {
            // Local Load
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                const activeId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);

                if (stored) {
                    const workspaces: Workspace[] = JSON.parse(stored);
                    workspaces.forEach(w => {
                        w.createdAt = new Date(w.createdAt);
                        w.updatedAt = new Date(w.updatedAt);
                        w.frames = (w.frames || []).map((frame) => ({
                            ...frame,
                            createdAt: new Date(frame.createdAt),
                            updatedAt: new Date(frame.updatedAt),
                        }));
                    });
                    set({ workspaces, activeWorkspaceId: activeId || (workspaces[0]?.id || null) });
                    const active = workspaces.find(w => w.id === (activeId || workspaces[0]?.id));
                    if (active) {
                        const safeNodes = sanitizeNodes(JSON.parse(JSON.stringify(active.nodes || [])));
                        const safeEdges = sanitizeEdges(JSON.parse(JSON.stringify(active.edges || [])));
                        useMindStore.setState({
                            nodes: safeNodes,
                            edges: safeEdges,
                            frames: active.frames || [],
                            selectedFrameId: null,
                            strokes: active.strokes || [],
                            arrows: active.arrows || [],
                            strokeHistory: [],
                            strokeFuture: [],
                            pendingViewport: active.viewport || { x: 0, y: 0, zoom: 1 },
                        });
                    }
                } else {
                    get().createWorkspace('My First Workspace');
                }
            } catch (e) {
                console.error('Failed to load local workspaces', e);
                get().createWorkspace('My First Workspace');
            }
        }
        set({ isLoaded: true, isLoading: false });
    },

    getActiveWorkspace: () => {
        const state = get();
        return state.workspaces.find(w => w.id === state.activeWorkspaceId) || null;
    },
}));
