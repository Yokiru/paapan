import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
    // Record of userId -> profile. 'guest' is used for unauthenticated users.
    profiles: Record<string, AISettingsProfile>;

    // Actions
    updateSettings: (userId: string | 'guest', settings: Partial<AISettingsProfile>) => void;
    getSettingsForUser: (userId: string | 'guest') => AISettingsProfile;
    resetSettings: (userId: string | 'guest') => void;
}

export const useAISettingsStore = create<AISettingsState>()(
    persist(
        (set, get) => ({
            profiles: {},

            updateSettings: (userId, settings) => set((state) => {
                const currentProfile = state.profiles[userId] || DEFAULT_PROFILE;
                return {
                    profiles: {
                        ...state.profiles,
                        [userId]: { ...currentProfile, ...settings }
                    }
                };
            }),

            getSettingsForUser: (userId) => {
                return get().profiles[userId] || DEFAULT_PROFILE;
            },

            resetSettings: (userId) => set((state) => {
                const newProfiles = { ...state.profiles };
                delete newProfiles[userId]; // Completely erase from memory dict
                return { profiles: newProfiles };
            }),
        }),
        {
            name: 'paapan-ai-settings-v2', // new unique key to drop legacy polluted storage
            storage: createJSONStorage(() => localStorage),
        }
    )
);
