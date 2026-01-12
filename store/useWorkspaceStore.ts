"use client";

import { create } from 'zustand';
import { Edge } from 'reactflow';
import { Workspace, WorkspaceStoreState, CanvasNodeType } from '@/types';
import { generateId } from '@/lib/utils';
import { useMindStore } from './useMindStore';

// Store for current viewport (set by CanvasWrapper)
let currentViewport = { x: 0, y: 0, zoom: 1 };

export const setCurrentViewport = (viewport: { x: number; y: number; zoom: number }) => {
    currentViewport = viewport;
};

export const getCurrentViewport = () => currentViewport;

const STORAGE_KEY = 'spatial-ai-workspaces';
const ACTIVE_WORKSPACE_KEY = 'spatial-ai-active-workspace';

/**
 * Workspace Store - Manages multiple workspaces with localStorage persistence
 */
export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
    workspaces: [],
    activeWorkspaceId: null,
    isSidebarOpen: false,
    isLoaded: false, // Track if workspaces have been loaded from localStorage

    setSidebarOpen: (open: boolean) => {
        set({ isSidebarOpen: open });
    },

    createWorkspace: (name?: string) => {
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

        set(state => ({
            workspaces: [newWorkspace, ...state.workspaces],
            activeWorkspaceId: id,
        }));

        // Clear the canvas for new workspace
        useMindStore.setState({ nodes: [], edges: [], strokes: [], strokeHistory: [], strokeFuture: [] });

        // Save to localStorage
        get().saveCurrentWorkspace();

        return id;
    },

    switchWorkspace: (workspaceId: string) => {
        // Save current workspace first
        get().saveCurrentWorkspace();

        const workspace = get().workspaces.find(w => w.id === workspaceId);
        if (!workspace) return;

        // Load workspace into mind store
        useMindStore.setState({
            nodes: workspace.nodes,
            edges: workspace.edges,
            strokes: workspace.strokes || [],
            strokeHistory: [],
            strokeFuture: [],
        });

        set({ activeWorkspaceId: workspaceId });

        // Save active workspace to localStorage
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
    },

    deleteWorkspace: (workspaceId: string) => {
        const state = get();
        const newWorkspaces = state.workspaces.filter(w => w.id !== workspaceId);

        // If deleting active workspace, switch to another
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

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newWorkspaces));
        if (newActiveId) {
            localStorage.setItem(ACTIVE_WORKSPACE_KEY, newActiveId);
        } else {
            localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
        }
    },

    renameWorkspace: (workspaceId: string, newName: string) => {
        set(state => ({
            workspaces: state.workspaces.map(w =>
                w.id === workspaceId ? { ...w, name: newName, updatedAt: new Date() } : w
            ),
        }));
        get().saveCurrentWorkspace();
    },

    toggleWorkspaceFavorite: (workspaceId: string) => {
        set(state => ({
            workspaces: state.workspaces.map(w =>
                w.id === workspaceId ? { ...w, isFavorite: !w.isFavorite } : w
            ),
        }));
        get().saveCurrentWorkspace();
    },

    saveCurrentWorkspace: () => {
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

        // Save to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWorkspaces));
        } catch (e) {
            console.error('Failed to save workspaces to localStorage:', e);
        }
    },

    loadWorkspaces: () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const activeId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);

            if (stored) {
                const workspaces: Workspace[] = JSON.parse(stored);
                // Convert date strings back to Date objects
                workspaces.forEach(w => {
                    w.createdAt = new Date(w.createdAt);
                    w.updatedAt = new Date(w.updatedAt);
                });

                set({ workspaces, activeWorkspaceId: activeId || (workspaces[0]?.id || null) });

                // Load active workspace into mind store
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
                // No saved workspaces, create initial one
                get().createWorkspace('My First Workspace');
            }
            set({ isLoaded: true });
        } catch (e) {
            console.error('Failed to load workspaces from localStorage:', e);
            get().createWorkspace('My First Workspace');
            set({ isLoaded: true });
        }
    },

    getActiveWorkspace: () => {
        const state = get();
        return state.workspaces.find(w => w.id === state.activeWorkspaceId) || null;
    },
}));
