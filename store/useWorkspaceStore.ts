"use client";

import { create } from 'zustand';
import { Edge } from 'reactflow';
import { Workspace, WorkspaceStoreState, CanvasNodeType, FrameRegion } from '@/types';
import { generateId } from '@/lib/utils';
import { useMindStore } from './useMindStore';
import { supabase } from '@/lib/supabase';
import { getWorkspaceLimit } from '@/lib/creditCosts';
import { getWorkspaceStorageKeys, isExperimentLocalOnly, shouldBypassWorkspaceLimit } from '@/lib/experimentMode';

// Guest workspace limit — stricter than Free to encourage sign-up
const GUEST_WORKSPACE_LIMIT = 1;

const generateWorkspaceId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
};

const normalizeLocalWorkspace = (workspace: Workspace): Workspace => ({
    ...workspace,
    createdAt: workspace.createdAt ? new Date(workspace.createdAt) : new Date(),
    updatedAt: workspace.updatedAt ? new Date(workspace.updatedAt) : new Date(),
    frames: (workspace.frames || []).map((frame) => ({
        ...frame,
        createdAt: frame.createdAt ? new Date(frame.createdAt) : new Date(),
        updatedAt: frame.updatedAt ? new Date(frame.updatedAt) : new Date(),
    })),
    shareVisibility: workspace.shareVisibility === 'link_view' ? 'link_view' : 'private',
    shareAccessRole: 'viewer',
    allowPublicDuplicate: workspace.allowPublicDuplicate !== false,
    sharedAt: workspace.sharedAt ? new Date(workspace.sharedAt) : null,
    shareUpdatedAt: workspace.shareUpdatedAt ? new Date(workspace.shareUpdatedAt) : null,
});

const isUuid = (value: string) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
);

// Store for current viewport (set by CanvasWrapper)
let currentViewport = { x: 0, y: 0, zoom: 1 };

export const setCurrentViewport = (viewport: { x: number; y: number; zoom: number }) => {
    currentViewport = viewport;
};

export const getCurrentViewport = () => currentViewport;

export const FRAME_NODE_TYPE = '__frame_region__';

// Debounce helper for cloud saving
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 2000; // 2 seconds debounce
let viewportSaveTimeout: NodeJS.Timeout | null = null;
const VIEWPORT_SAVE_DELAY = 350;
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

export const isTransientWorkspaceNetworkError = (error: unknown) => {
    const normalized = toError(error);
    const message = normalized.message.toLowerCase();

    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('load failed') ||
        message.includes('fetch failed') ||
        message.includes('network request failed')
    );
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const shouldUseCloudSync = (userId: string | null) => Boolean(userId) && !isExperimentLocalOnly();

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
        const effectiveUserId = isExperimentLocalOnly() ? null : userId;
        const currentUserId = get().userId;
        if (currentUserId !== effectiveUserId) {
            set({ userId: effectiveUserId, isLoaded: false });
            get().loadWorkspaces();

            // Sync credits when user logs in
            if (effectiveUserId) {
                import('./useCreditStore').then(({ useCreditStore }) => {
                    useCreditStore.getState().initializeCredits();
                });
            }

            // Load AI settings from Supabase for this user
            if (effectiveUserId) {
                import('./useAISettingsStore').then(({ useAISettingsStore }) => {
                    useAISettingsStore.getState().loadSettingsFromProfile(effectiveUserId);
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
        const cloudSyncEnabled = shouldUseCloudSync(userId);
        const currentCount = get().workspaces.length;

        if (!cloudSyncEnabled) {
            // Guest: max 1 workspace
            if (!shouldBypassWorkspaceLimit() && currentCount >= GUEST_WORKSPACE_LIMIT) return null;
        } else {
            // Client-side quick check (UX hint, not security boundary)
            const limit = getWorkspaceLimit();
            if (limit !== -1 && currentCount >= limit) return null;
            // Server-side tier enforcement runs non-blocking during cloud insert (see below)
        }

        // Save current workspace first to prevent data loss (Async, non-blocking)
        get().saveCurrentWorkspace(true).catch(console.error);

        const id = generateWorkspaceId();
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
            shareVisibility: 'private',
            allowPublicDuplicate: true,
            sharedAt: null,
            shareUpdatedAt: null,
        };

        // Optimistic update
        set(state => ({
            workspaces: [newWorkspace, ...state.workspaces],
            activeWorkspaceId: id,
        }));

        // Clear canvas
        useMindStore.setState({ nodes: [], edges: [], frames: [], selectedFrameId: null, strokes: [], arrows: [], strokeHistory: [], strokeFuture: [], pendingViewport: { x: 0, y: 0, zoom: 1 } });

        if (cloudSyncEnabled && userId) {
            // Cloud Create + Server-side validation (non-blocking for instant UX)
            try {
                const { data: cloudData, error } = await supabase
                    .from('workspaces')
                    .insert({
                        id,
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

                    // If the user already started editing before the cloud ID arrived,
                    // immediately persist the latest canvas snapshot to the fresh row so
                    // remote sync can't overwrite local work with the initial blank row.
                    const latestMindState = useMindStore.getState();
                    const latestWorkspaceState = get();
                    const latestWorkspace = latestWorkspaceState.workspaces.find(w => w.id === cloudId);

                    const frames = latestMindState.frames;
                    const nodesToPersist = latestWorkspace?.nodes?.length
                        ? latestWorkspace.nodes
                        : getPersistableNodes(latestMindState.nodes);
                    const edgesToPersist = latestWorkspace?.edges?.length
                        ? latestWorkspace.edges
                        : getPersistableEdges(latestMindState.edges);
                    const strokesToPersist = latestWorkspace?.strokes?.length
                        ? latestWorkspace.strokes
                        : latestMindState.strokes;
                    const arrowsToPersist = latestWorkspace?.arrows?.length
                        ? latestWorkspace.arrows
                        : latestMindState.arrows;

                    const latestViewport = latestWorkspace?.viewport || currentViewport;

                    const { error: syncError } = await supabase
                        .from('workspaces')
                        .update({
                            nodes: serializeWorkspaceNodes(nodesToPersist, frames),
                            edges: edgesToPersist,
                            strokes: strokesToPersist,
                            arrows: arrowsToPersist,
                            viewport_x: latestViewport.x,
                            viewport_y: latestViewport.y,
                            viewport_zoom: latestViewport.zoom,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', cloudId)
                        .eq('user_id', userId);

                    if (syncError) {
                        console.error('Failed to sync new cloud workspace snapshot:', toError(syncError));
                    }
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
        const currentActiveWorkspaceId = get().activeWorkspaceId;

        // Save current first only when actually leaving a different board.
        // On page refresh, the route may ask us to "switch" to the already-active
        // board before React Flow has restored its viewport; saving then would
        // overwrite the stored viewport with the module default {0,0,1}.
        const currentWorkspace = get().workspaces.find(w => w.id === currentActiveWorkspaceId);
        if (currentActiveWorkspaceId && currentActiveWorkspaceId !== workspaceId && !currentWorkspace?.isExternalShare) {
            get().saveCurrentWorkspace(true).catch(console.error);
        }

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
        setCurrentViewport(workspace.viewport || { x: 0, y: 0, zoom: 1 });

        set({ activeWorkspaceId: workspaceId });

        if (!shouldUseCloudSync(get().userId)) {
            const storageKeys = getWorkspaceStorageKeys();
            localStorage.setItem(storageKeys.activeWorkspace, workspaceId);
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

        if (shouldUseCloudSync(userId)) {
            const { error } = await supabase
                .from('workspaces')
                .delete()
                .eq('id', workspaceId)
                .eq('user_id', userId);
            if (error) console.error("Cloud delete failed", toError(error));
        } else {
            const storageKeys = getWorkspaceStorageKeys();
            localStorage.setItem(storageKeys.workspaces, JSON.stringify(newWorkspaces));
            if (newActiveId) localStorage.setItem(storageKeys.activeWorkspace, newActiveId);
            else localStorage.removeItem(storageKeys.activeWorkspace);
        }
    },

    renameWorkspace: async (workspaceId: string, newName: string) => {
        const { userId } = get();
        set(state => ({
            workspaces: state.workspaces.map(w =>
                w.id === workspaceId ? { ...w, name: newName, updatedAt: new Date() } : w
            ),
        }));

        if (shouldUseCloudSync(userId)) {
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

        if (shouldUseCloudSync(userId)) {
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
        const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (activeWorkspace?.isExternalShare) return;

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

        if (shouldUseCloudSync(state.userId) && state.userId) {
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

            const saveToCloudWithRetry = async () => {
                try {
                    await saveToCloud();
                } catch (error) {
                    if (!isTransientWorkspaceNetworkError(error)) {
                        throw toError(error);
                    }

                    await wait(700);
                    await saveToCloud();
                }
            };

            if (saveTimeout) clearTimeout(saveTimeout);

            if (immediate) {
                try {
                    await saveToCloudWithRetry();
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
                            await saveToCloudWithRetry();
                            settlePendingCloudSave();
                        } catch (error) {
                            const normalizedError = toError(error);
                            if (isTransientWorkspaceNetworkError(normalizedError)) {
                                console.warn('Cloud autosave temporarily unavailable:', normalizedError.message);
                            } else {
                                console.error('Cloud autosave failed:', normalizedError);
                            }
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
                const storageKeys = getWorkspaceStorageKeys();
                localStorage.setItem(storageKeys.workspaces, JSON.stringify(updatedWorkspaces));
            } catch (e) {
                console.error('Failed to save workspaces to localStorage:', e);
            }
        }
    },

    saveCurrentViewport: async (immediate = false) => {
        const state = get();
        if (!state.activeWorkspaceId) return;

        const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (!activeWorkspace || activeWorkspace.isExternalShare) return;

        const viewport = currentViewport;
        const safeViewport = {
            x: Number.isFinite(viewport.x) ? viewport.x : 0,
            y: Number.isFinite(viewport.y) ? viewport.y : 0,
            zoom: Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1,
        };

        set((currentState) => ({
            workspaces: currentState.workspaces.map((workspace) =>
                workspace.id === currentState.activeWorkspaceId
                    ? { ...workspace, viewport: safeViewport }
                    : workspace
            ),
        }));

        if (shouldUseCloudSync(state.userId) && state.userId) {
            const saveViewportToCloud = async () => {
                const latestState = get();
                const latestWorkspace = latestState.workspaces.find(w => w.id === latestState.activeWorkspaceId);
                if (!latestWorkspace || latestWorkspace.isExternalShare) return;

                const latestViewport = latestWorkspace.viewport || safeViewport;
                const { error } = await supabase
                    .from('workspaces')
                    .update({
                        viewport_x: latestViewport.x,
                        viewport_y: latestViewport.y,
                        viewport_zoom: latestViewport.zoom,
                    })
                    .eq('id', latestWorkspace.id)
                    .eq('user_id', state.userId);

                if (error) {
                    throw toError(error);
                }
            };

            const saveViewportToCloudWithRetry = async () => {
                try {
                    await saveViewportToCloud();
                } catch (error) {
                    if (!isTransientWorkspaceNetworkError(error)) {
                        throw toError(error);
                    }

                    await wait(700);
                    await saveViewportToCloud();
                }
            };

            if (viewportSaveTimeout) clearTimeout(viewportSaveTimeout);

            if (immediate) {
                await saveViewportToCloudWithRetry();
            } else {
                viewportSaveTimeout = setTimeout(() => {
                    void saveViewportToCloudWithRetry().catch((error) => {
                        const normalizedError = toError(error);
                        if (isTransientWorkspaceNetworkError(normalizedError)) {
                            console.warn('Viewport autosave temporarily unavailable:', normalizedError.message);
                        } else {
                            console.error('Viewport autosave failed:', normalizedError);
                        }
                    }).finally(() => {
                        viewportSaveTimeout = null;
                    });
                }, VIEWPORT_SAVE_DELAY);
            }

            return;
        }

        try {
            const storageKeys = getWorkspaceStorageKeys();
            localStorage.setItem(storageKeys.workspaces, JSON.stringify(get().workspaces));
        } catch (error) {
            console.error('Failed to save workspace viewport to localStorage:', error);
        }
    },

    promoteLocalWorkspaceToCloud: async (workspaceId?: string) => {
        const { userId } = get();
        if (!userId || typeof window === 'undefined') return null;

        const storageKeys = getWorkspaceStorageKeys();
        const stored = localStorage.getItem(storageKeys.workspaces);
        if (!stored) return null;

        let localWorkspaces: Workspace[] = [];
        try {
            const parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) return null;
            localWorkspaces = parsed.map((workspace) => normalizeLocalWorkspace(workspace));
        } catch {
            return null;
        }

        const targetWorkspaceId = workspaceId || localStorage.getItem(storageKeys.activeWorkspace) || localWorkspaces[0]?.id;
        if (!targetWorkspaceId) return null;

        const localWorkspace = localWorkspaces.find((workspace) => workspace.id === targetWorkspaceId);
        if (!localWorkspace || localWorkspace.isExternalShare) return null;

        if (isUuid(localWorkspace.id)) {
            const { data: existingWorkspace } = await supabase
                .from('workspaces')
                .select('id')
                .eq('id', localWorkspace.id)
                .eq('user_id', userId)
                .maybeSingle();

            if (existingWorkspace?.id) {
                return existingWorkspace.id;
            }
        }

        const canPreserveLocalId = isUuid(localWorkspace.id);
        const { data, error } = await supabase
            .from('workspaces')
            .insert({
                ...(canPreserveLocalId ? { id: localWorkspace.id } : {}),
                user_id: userId,
                name: localWorkspace.name,
                nodes: serializeWorkspaceNodes(localWorkspace.nodes || [], localWorkspace.frames || []),
                edges: localWorkspace.edges || [],
                strokes: localWorkspace.strokes || [],
                arrows: localWorkspace.arrows || [],
                viewport_x: localWorkspace.viewport?.x || 0,
                viewport_y: localWorkspace.viewport?.y || 0,
                viewport_zoom: localWorkspace.viewport?.zoom || 1,
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to promote local workspace to cloud:', toError(error));
            return null;
        }

        const cloudId = data?.id || localWorkspace.id;

        localStorage.setItem(
            storageKeys.workspaces,
            JSON.stringify(localWorkspaces.filter((workspace) => workspace.id !== localWorkspace.id))
        );

        if (localStorage.getItem(storageKeys.activeWorkspace) === localWorkspace.id) {
            localStorage.removeItem(storageKeys.activeWorkspace);
        }

        return cloudId;
    },

    loadWorkspaces: async () => {
        const { userId, isLoading } = get();

        // Guard: prevent parallel execution (race condition)
        if (isLoading) {
            console.log('[Workspace] loadWorkspaces skipped — already loading');
            return;
        }
        set({ isLoading: true });

        if (shouldUseCloudSync(userId) && userId) {
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
                            isFavorite: w.is_favorite,
                            shareVisibility: w.share_visibility === 'link_view' ? 'link_view' : 'private',
                            shareAccessRole: 'viewer',
                            allowPublicDuplicate: w.allow_public_duplicate !== false,
                            sharedAt: w.shared_at ? new Date(w.shared_at) : null,
                            shareUpdatedAt: w.share_updated_at ? new Date(w.share_updated_at) : null,
                        };
                    });

                    const activeId = workspaces.length > 0 ? workspaces[0].id : null;

                    set({ workspaces, activeWorkspaceId: activeId });

                    if (activeId) {
                        const active = workspaces.find(w => w.id === activeId);
                        if (active) {
                            const safeNodes = sanitizeNodes(JSON.parse(JSON.stringify(active.nodes || [])));
                            const safeEdges = sanitizeEdges(JSON.parse(JSON.stringify(active.edges || [])));
                            const activeViewport = active.viewport || { x: 0, y: 0, zoom: 1 };
                            setCurrentViewport(activeViewport);
                            useMindStore.setState({
                                nodes: safeNodes,
                                edges: safeEdges,
                                frames: active.frames || [],
                                selectedFrameId: null,
                                strokes: active.strokes || [],
                                arrows: active.arrows || [],
                                strokeHistory: [],
                                strokeFuture: [],
                                pendingViewport: activeViewport,
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
                const storageKeys = getWorkspaceStorageKeys();
                const stored = localStorage.getItem(storageKeys.workspaces);
                const activeId = localStorage.getItem(storageKeys.activeWorkspace);

                if (stored) {
                    const workspaces: Workspace[] = JSON.parse(stored);
                    workspaces.forEach(w => {
                        w.createdAt = new Date(w.createdAt);
                        w.updatedAt = new Date(w.updatedAt);
                        w.shareVisibility = w.shareVisibility === 'link_view' ? 'link_view' : 'private';
                        w.shareAccessRole = 'viewer';
                        w.allowPublicDuplicate = w.allowPublicDuplicate !== false;
                        w.sharedAt = w.sharedAt ? new Date(w.sharedAt) : null;
                        w.shareUpdatedAt = w.shareUpdatedAt ? new Date(w.shareUpdatedAt) : null;
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
                        const activeViewport = active.viewport || { x: 0, y: 0, zoom: 1 };
                        setCurrentViewport(activeViewport);
                        useMindStore.setState({
                            nodes: safeNodes,
                            edges: safeEdges,
                            frames: active.frames || [],
                            selectedFrameId: null,
                            strokes: active.strokes || [],
                            arrows: active.arrows || [],
                            strokeHistory: [],
                            strokeFuture: [],
                            pendingViewport: activeViewport,
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
