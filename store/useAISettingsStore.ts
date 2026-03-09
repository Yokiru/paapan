import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AIResponseStyle = 'professional' | 'friendly' | 'concise';
export type AIResponseLanguage = 'en' | 'id';

export interface AISettingsState {
    responseStyle: AIResponseStyle;
    responseLanguage: AIResponseLanguage;
    userName: string;
    customInstructions: string;

    // Actions
    updateSettings: (settings: Partial<Omit<AISettingsState, 'updateSettings' | 'resetSettings'>>) => void;
    resetSettings: () => void;
}

export const useAISettingsStore = create<AISettingsState>()(
    persist(
        (set) => ({
            responseStyle: 'friendly',
            responseLanguage: 'id',
            userName: '',
            customInstructions: '',

            updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
            resetSettings: () => set({
                responseStyle: 'friendly',
                responseLanguage: 'id',
                userName: '',
                customInstructions: '',
            }),
        }),
        {
            name: 'paapan-ai-settings', // name of the item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default the 'localStorage' is used
        }
    )
);
