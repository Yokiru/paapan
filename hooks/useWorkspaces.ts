'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, Workspace as SupabaseWorkspace } from '@/lib/supabase';

interface UseWorkspacesReturn {
    workspaces: SupabaseWorkspace[];
    activeWorkspace: SupabaseWorkspace | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    createWorkspace: (name?: string) => Promise<SupabaseWorkspace | null>;
    updateWorkspace: (id: string, updates: Partial<SupabaseWorkspace>) => Promise<boolean>;
    deleteWorkspace: (id: string) => Promise<boolean>;
    setActiveWorkspace: (id: string) => void;
    saveWorkspaceContent: (id: string, nodes: any[], edges: any[], strokes: any[], viewport?: { x: number; y: number; zoom: number }) => Promise<boolean>;
    refreshWorkspaces: () => Promise<void>;
    toggleFavorite: (id: string) => Promise<boolean>;
}

export function useWorkspaces(): UseWorkspacesReturn {
    const [workspaces, setWorkspaces] = useState<SupabaseWorkspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            }
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUserId(session?.user?.id || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch workspaces
    const refreshWorkspaces = useCallback(async () => {
        if (!userId) {
            setWorkspaces([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('workspaces')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;

            setWorkspaces(data || []);

            // Set first workspace as active if none selected
            if (data && data.length > 0 && !activeWorkspaceId) {
                setActiveWorkspaceId(data[0].id);
            }
        } catch (err: any) {
            console.error('Error fetching workspaces:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [userId, activeWorkspaceId]);

    // Auto-fetch when userId changes
    useEffect(() => {
        if (userId) {
            refreshWorkspaces();
        }
    }, [userId, refreshWorkspaces]);

    // Get active workspace
    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null;

    // Create new workspace
    const createWorkspace = useCallback(async (name?: string): Promise<SupabaseWorkspace | null> => {
        if (!userId) return null;

        try {
            const { data, error: insertError } = await supabase
                .from('workspaces')
                .insert({
                    user_id: userId,
                    name: name || `My Board ${workspaces.length + 1}`,
                    nodes: [],
                    edges: [],
                    strokes: []
                })
                .select()
                .single();

            if (insertError) throw insertError;

            await refreshWorkspaces();
            if (data) {
                setActiveWorkspaceId(data.id);
            }

            return data;
        } catch (err: any) {
            console.error('Error creating workspace:', err);
            setError(err.message);
            return null;
        }
    }, [userId, workspaces.length, refreshWorkspaces]);

    // Update workspace
    const updateWorkspace = useCallback(async (id: string, updates: Partial<SupabaseWorkspace>): Promise<boolean> => {
        try {
            const { error: updateError } = await supabase
                .from('workspaces')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (updateError) throw updateError;

            await refreshWorkspaces();
            return true;
        } catch (err: any) {
            console.error('Error updating workspace:', err);
            setError(err.message);
            return false;
        }
    }, [refreshWorkspaces]);

    // Delete workspace
    const deleteWorkspace = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error: deleteError } = await supabase
                .from('workspaces')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            // Switch to another workspace if deleting active
            if (activeWorkspaceId === id) {
                const remaining = workspaces.filter(w => w.id !== id);
                setActiveWorkspaceId(remaining.length > 0 ? remaining[0].id : null);
            }

            await refreshWorkspaces();
            return true;
        } catch (err: any) {
            console.error('Error deleting workspace:', err);
            setError(err.message);
            return false;
        }
    }, [activeWorkspaceId, workspaces, refreshWorkspaces]);

    // Save workspace content (nodes, edges, strokes)
    const saveWorkspaceContent = useCallback(async (
        id: string,
        nodes: any[],
        edges: any[],
        strokes: any[],
        viewport?: { x: number; y: number; zoom: number }
    ): Promise<boolean> => {
        try {
            const updates: Partial<SupabaseWorkspace> = {
                nodes,
                edges,
                strokes,
                updated_at: new Date().toISOString()
            };

            if (viewport) {
                updates.viewport_x = viewport.x;
                updates.viewport_y = viewport.y;
                updates.viewport_zoom = viewport.zoom;
            }

            const { error: updateError } = await supabase
                .from('workspaces')
                .update(updates)
                .eq('id', id);

            if (updateError) throw updateError;

            return true;
        } catch (err: any) {
            console.error('Error saving workspace:', err);
            setError(err.message);
            return false;
        }
    }, []);

    // Toggle favorite
    const toggleFavorite = useCallback(async (id: string): Promise<boolean> => {
        const workspace = workspaces.find(w => w.id === id);
        if (!workspace) return false;

        return updateWorkspace(id, { is_favorite: !workspace.is_favorite });
    }, [workspaces, updateWorkspace]);

    // Set active workspace
    const setActiveWorkspace = useCallback((id: string) => {
        setActiveWorkspaceId(id);
    }, []);

    return {
        workspaces,
        activeWorkspace,
        isLoading,
        error,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        setActiveWorkspace,
        saveWorkspaceContent,
        refreshWorkspaces,
        toggleFavorite
    };
}
