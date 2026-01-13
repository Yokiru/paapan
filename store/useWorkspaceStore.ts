"use client";

import { create } from 'zustand';
import { Edge } from 'reactflow';
import { Workspace, WorkspaceStoreState, CanvasNodeType } from '@/types';
import { generateId } from '@/lib/utils';
import { useMindStore } from './useMindStore';
import { supabase } from '@/lib/supabase';

// Store for current viewport (set by CanvasWrapper)
let currentViewport = { x: 0, y: 0, zoom: 1 };

export const setCurrentViewport = (viewport: { x: number; y: number; zoom: number }) => {
    currentViewport = viewport;
};

export const getCurrentViewport = () => currentViewport;

const STORAGE_KEY = 'spatial-ai-workspaces';
const ACTIVE_WORKSPACE_KEY = 'spatial-ai-active-workspace';

// Debounce helper for cloud saving
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 2000; // 2 seconds debounce

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
        }
    },

    setSidebarOpen: (open: boolean) => {
        set({ isSidebarOpen: open });
    },

    createWorkspace: async (name?: string) => {
        // Save current workspace first to prevent data loss
        await get().saveCurrentWorkspace();

        const { userId } = get();
        const id = generateId();
        const newWorkspace: Workspace = {
            id,
            name: name || `My Board ${get().workspaces.length + 1}`,
            nodes: [],
            edges: [],
            strokes: [],
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
        useMindStore.setState({ nodes: [], edges: [], strokes: [], strokeHistory: [], strokeFuture: [] });

        if (userId) {
            // Cloud Create
            try {
                const { error } = await supabase
                    .from('workspaces')
                    .insert({
                        // If we generate ID client side, we might conflict if using UUID.
                        // Supabase uses UUID. workspace.id in app is generateId() (short string).
                        // If schema is UUID, this will fail.
                        // Schema check: id is UUID in DB?
                        // Schema says: id uuid default gen_random_uuid()
                        // So I should let DB generate ID or use valid UUID.
                        // generateId() in utils probably returns shortid/nanoid.
                        // Let's assume for now we let DB generate ID and we update store?
                        // OR we force local ID to be UUID if logged in?
                        // Let's check schema/previous file.
                        // Schema: id uuid.

                        // FIX: We need valid UUID for supabase.
                        // But for optimistic UI we need an ID immediately.
                        // For now let's use the local object.
                        // Actually, if we use Supabase, we should probably fetch the inserted row.

                        user_id: userId,
                        name: newWorkspace.name,
                        nodes: [],
                        edges: [],
                        strokes: []
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Since DB generates UUID, and our local uses something else likely, we should reload workspaces.
                // But that disrupts UI.
                // Ideally we send a UUID.

                // Let's reload to be safe and get the real UUID.
                get().loadWorkspaces();

            } catch (e) {
                console.error("Cloud create failed", e);
            }
        } else {
            // Local Save
            get().saveCurrentWorkspace();
        }

        return id;
    },

    switchWorkspace: async (workspaceId: string) => {
        // Save current first
        await get().saveCurrentWorkspace();

        const workspace = get().workspaces.find(w => w.id === workspaceId);
        if (!workspace) return;

        // Load into mind store
        useMindStore.setState({
            nodes: workspace.nodes,
            edges: workspace.edges,
            strokes: workspace.strokes || [],
            strokeHistory: [],
            strokeFuture: [],
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
                    useMindStore.setState({
                        nodes: newActive.nodes,
                        edges: newActive.edges,
                        strokes: newActive.strokes || [],
                        strokeHistory: [],
                        strokeFuture: [],
                    });
                }
            } else {
                useMindStore.setState({ nodes: [], edges: [], strokes: [], strokeHistory: [], strokeFuture: [] });
            }
        }

        set({
            workspaces: newWorkspaces,
            activeWorkspaceId: newActiveId,
        });

        if (userId) {
            const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
            if (error) console.error("Cloud delete failed", error);
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
            await supabase.from('workspaces').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', workspaceId);
        } else {
            get().saveCurrentWorkspace();
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
            await supabase.from('workspaces').update({ is_favorite: newState }).eq('id', workspaceId);
        } else {
            get().saveCurrentWorkspace();
        }
    },

    saveCurrentWorkspace: async () => {
        const state = get();
        if (!state.activeWorkspaceId) return;

        const mindState = useMindStore.getState();

        const updatedWorkspaces = state.workspaces.map(w =>
            w.id === state.activeWorkspaceId
                ? {
                    ...w,
                    nodes: mindState.nodes,
                    edges: mindState.edges,
                    strokes: mindState.strokes,
                    viewport: currentViewport,
                    updatedAt: new Date(),
                }
                : w
        );

        set({ workspaces: updatedWorkspaces });

        if (state.userId) {
            // Debounced Cloud Save
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                const ws = updatedWorkspaces.find(w => w.id === state.activeWorkspaceId);
                if (ws) {
                    await supabase.from('workspaces').update({
                        nodes: ws.nodes,
                        edges: ws.edges,
                        strokes: ws.strokes,
                        viewport_x: currentViewport.x,
                        viewport_y: currentViewport.y,
                        viewport_zoom: currentViewport.zoom,
                        updated_at: new Date().toISOString()
                    }).eq('id', ws.id);
                }
            }, SAVE_DELAY);

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
        const { userId } = get();
        set({ isLoading: true });

        if (userId) {
            // Cloud Load
            try {
                const { data, error } = await supabase
                    .from('workspaces')
                    .select('*')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false });

                if (data) {
                    const workspaces: Workspace[] = data.map(w => ({
                        id: w.id,
                        name: w.name,
                        nodes: w.nodes || [],
                        edges: w.edges || [],
                        strokes: w.strokes || [],
                        viewport: { x: w.viewport_x || 0, y: w.viewport_y || 0, zoom: w.viewport_zoom || 1 },
                        createdAt: new Date(w.created_at),
                        updatedAt: new Date(w.updated_at),
                        isFavorite: w.is_favorite
                    }));

                    const activeId = workspaces.length > 0 ? workspaces[0].id : null;

                    set({ workspaces, activeWorkspaceId: activeId });

                    if (activeId) {
                        const active = workspaces.find(w => w.id === activeId);
                        if (active) {
                            useMindStore.setState({
                                nodes: active.nodes,
                                edges: active.edges,
                                strokes: active.strokes || [],
                                strokeHistory: [],
                                strokeFuture: [],
                            });
                        }
                    } else {
                        // Create default if none? Handle DB trigger might have done it.
                        // If empty, create one
                        if (workspaces.length === 0) {
                            get().createWorkspace("My First Workspace");
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to load cloud workspaces", e);
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
                    });
                    set({ workspaces, activeWorkspaceId: activeId || (workspaces[0]?.id || null) });
                    const active = workspaces.find(w => w.id === (activeId || workspaces[0]?.id));
                    if (active) {
                        useMindStore.setState({
                            nodes: active.nodes,
                            edges: active.edges,
                            strokes: active.strokes || [],
                            strokeHistory: [],
                            strokeFuture: [],
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
