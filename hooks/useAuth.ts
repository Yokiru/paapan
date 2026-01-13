'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';

interface UseAuthReturn {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
    updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
    refreshProfile: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch profile
    const refreshProfile = useCallback(async () => {
        if (!user) {
            setProfile(null);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            setProfile(data);
        } catch (err: any) {
            console.error('Error fetching profile:', err);
        }
    }, [user]);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            setIsLoading(true);

            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user || null);

            setIsLoading(false);
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user || null);

            if (event === 'SIGNED_OUT') {
                setProfile(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch profile when user changes
    useEffect(() => {
        if (user) {
            refreshProfile();
        }
    }, [user, refreshProfile]);

    // Sign in with email/password
    const signIn = useCallback(async (email: string, password: string) => {
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) throw signInError;

            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    }, []);

    // Sign up with email/password
    const signUp = useCallback(async (email: string, password: string, fullName: string) => {
        setError(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (signUpError) throw signUpError;

            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    }, []);

    // Sign out
    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setSession(null);
    }, []);

    // Sign in with Google
    const signInWithGoogle = useCallback(async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`
            }
        });
    }, []);

    // Reset password
    const resetPassword = useCallback(async (email: string) => {
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (resetError) throw resetError;

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }, []);

    // Update password
    const updatePassword = useCallback(async (newPassword: string) => {
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }, []);

    // Update profile
    const updateProfile = useCallback(async (updates: Partial<Profile>): Promise<boolean> => {
        if (!user) return false;

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', user.id);

            if (updateError) throw updateError;

            await refreshProfile();
            return true;
        } catch (err: any) {
            console.error('Error updating profile:', err);
            return false;
        }
    }, [user, refreshProfile]);

    return {
        user,
        profile,
        session,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile
    };
}
