import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type AIResponseStyle = 'professional' | 'friendly' | 'concise';
export type AIResponseLanguage = 'en' | 'id';

export interface AISettingsProfile {
    responseStyle: AIResponseStyle;
    responseLanguage: AIResponseLanguage;
    userName: string;
    customInstructions: string;
}

const DEFAULT_PROFILE: AISettingsProfile = {
    responseStyle: 'friendly',
    responseLanguage: 'id',
    userName: '',
    customInstructions: '',
};

export interface AISettingsState {
    // Current active settings (loaded per user)
    currentSettings: AISettingsProfile;
    isLoaded: boolean;

    // Actions
    loadSettingsFromProfile: (userId: string) => Promise<void>;
    saveSettings: (userId: string, settings: Partial<AISettingsProfile>) => Promise<void>;
    resetSettings: () => void;
    getSettings: () => AISettingsProfile;
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
    currentSettings: { ...DEFAULT_PROFILE },
    isLoaded: false,

    /**
     * Load AI settings from Supabase `profiles` table.
     * This is called when a user logs in or the app initializes.
     */
    loadSettingsFromProfile: async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('ai_response_style, ai_language, ai_custom_instructions, ai_user_name')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[AISettings] Error loading from Supabase:', error);
                return;
            }

            if (data) {
                set({
                    currentSettings: {
                        responseStyle: (data.ai_response_style as AIResponseStyle) || DEFAULT_PROFILE.responseStyle,
                        responseLanguage: (data.ai_language as AIResponseLanguage) || DEFAULT_PROFILE.responseLanguage,
                        userName: data.ai_user_name || '',
                        customInstructions: data.ai_custom_instructions || '',
                    },
                    isLoaded: true,
                });
            } else {
                // Profile doesn't exist yet, use defaults
                set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: true });
            }
        } catch (err) {
            console.error('[AISettings] Failed to load settings:', err);
            set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: true });
        }
    },

    /**
     * Save AI settings to Supabase `profiles` table.
     * This is called when the user clicks "Save Preferences".
     */
    saveSettings: async (userId: string, settings: Partial<AISettingsProfile>) => {
        const currentSettings = get().currentSettings;
        const newSettings = { ...currentSettings, ...settings };

        // 1. Update local state immediately (Optimistic UI)
        set({ currentSettings: newSettings });

        // 2. Persist to Supabase
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    ai_response_style: newSettings.responseStyle,
                    ai_language: newSettings.responseLanguage,
                    ai_custom_instructions: newSettings.customInstructions || null,
                    ai_user_name: newSettings.userName || null,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'id' });

            if (error) {
                console.error('[AISettings] Error saving to Supabase:', error);
                // Revert on error
                set({ currentSettings });
            }
        } catch (err) {
            console.error('[AISettings] Failed to save settings:', err);
            set({ currentSettings });
        }
    },

    /**
     * Reset settings to defaults (on logout)
     */
    resetSettings: () => {
        set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: false });
    },

    /**
     * Get current settings (convenience getter for non-React contexts)
     */
    getSettings: () => {
        return get().currentSettings;
    },
}));
