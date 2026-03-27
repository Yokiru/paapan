import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { AIModel, canAccessModel, DEFAULT_MODEL, getModelById, getPreferredByokDefaultModelId, PlanType, toDisplayModelDescription, toDisplayModelName } from '@/lib/aiModels';
import { getCurrentTier } from '@/lib/creditCosts';

const SELECTED_MODEL_STORAGE_KEY = 'paapan-selected-model-id';
const BYOK_STORAGE_KEY = 'paapan-api-key';
const BYOK_VALIDATED_AT_STORAGE_KEY = 'paapan-api-key-validated-at';
const AI_PROVIDER_MODE_STORAGE_KEY = 'paapan-ai-provider-mode';
const BYOK_PROVIDER_STORAGE_KEY = 'paapan-byok-provider';
const BYOK_VISIBLE_MODELS_STORAGE_KEY = 'paapan-byok-visible-models';
const BYOK_AVAILABLE_MODELS_STORAGE_KEY = 'paapan-byok-available-models';

const getStoredSelectedModelId = () => {
    if (typeof window === 'undefined') return DEFAULT_MODEL.id;

    const storedModelId = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
    return storedModelId || DEFAULT_MODEL.id;
};

const persistSelectedModelId = (modelId: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
};

const getStoredCustomApiKey = () => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(BYOK_STORAGE_KEY) || '';
};

const getStoredAIProviderMode = (): AIProviderMode => {
    if (typeof window === 'undefined') return 'paapan';
    const stored = window.localStorage.getItem(AI_PROVIDER_MODE_STORAGE_KEY);
    return stored === 'byok' ? 'byok' : 'paapan';
};

const getStoredByokProvider = (): AIProvider => {
    if (typeof window === 'undefined') return 'gemini';
    const stored = window.localStorage.getItem(BYOK_PROVIDER_STORAGE_KEY);
    return stored === 'openai' || stored === 'anthropic' || stored === 'openrouter' ? stored : 'gemini';
};

const getStoredByokVisibleModelIds = () => {
    if (typeof window === 'undefined') return DEFAULT_BYOK_VISIBLE_MODEL_IDS;

    const raw = window.localStorage.getItem(BYOK_VISIBLE_MODELS_STORAGE_KEY);
    if (!raw) return DEFAULT_BYOK_VISIBLE_MODEL_IDS;

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return DEFAULT_BYOK_VISIBLE_MODEL_IDS;

        const filtered = parsed
            .filter((value): value is string => typeof value === 'string')
            .filter((value, index, array) => array.indexOf(value) === index);

        return filtered.length > 0 ? filtered.slice(0, 3) : DEFAULT_BYOK_VISIBLE_MODEL_IDS;
    } catch {
        return DEFAULT_BYOK_VISIBLE_MODEL_IDS;
    }
};

const normalizeStoredByokModels = (models: AIModel[]) => models.map((item) => ({
    ...item,
    name: toDisplayModelName(item.id, item.name),
    description: toDisplayModelDescription(item.id, item.description),
}));

const getStoredByokAvailableModels = (): AIModel[] => {
    if (typeof window === 'undefined') return [];

    const raw = window.localStorage.getItem(BYOK_AVAILABLE_MODELS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return normalizeStoredByokModels(parsed.filter((item): item is AIModel =>
            Boolean(item) &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.description === 'string' &&
            (item.requiredTier === 'free' || item.requiredTier === 'plus' || item.requiredTier === 'pro')
        ));
    } catch {
        return [];
    }
};

const getStoredByokValidatedAt = () => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(BYOK_VALIDATED_AT_STORAGE_KEY);
};

const persistCustomApiKey = (apiKey: string) => {
    if (typeof window === 'undefined') return;

    if (apiKey.trim()) {
        window.localStorage.setItem(BYOK_STORAGE_KEY, apiKey.trim());
        return;
    }

    window.localStorage.removeItem(BYOK_STORAGE_KEY);
};

const persistByokValidatedAt = (value: string | null) => {
    if (typeof window === 'undefined') return;

    if (value) {
        window.localStorage.setItem(BYOK_VALIDATED_AT_STORAGE_KEY, value);
        return;
    }

    window.localStorage.removeItem(BYOK_VALIDATED_AT_STORAGE_KEY);
};

const persistAIProviderMode = (mode: AIProviderMode) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AI_PROVIDER_MODE_STORAGE_KEY, mode);
};

const persistByokProvider = (provider: AIProvider) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BYOK_PROVIDER_STORAGE_KEY, provider);
};

const persistByokVisibleModelIds = (modelIds: string[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BYOK_VISIBLE_MODELS_STORAGE_KEY, JSON.stringify(modelIds));
};

const persistByokAvailableModels = (models: AIModel[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BYOK_AVAILABLE_MODELS_STORAGE_KEY, JSON.stringify(normalizeStoredByokModels(models)));
};

const ALL_MODEL_IDS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
const DEFAULT_BYOK_VISIBLE_MODEL_IDS = ALL_MODEL_IDS;

const getFallbackModelId = (hasByok: boolean) => {
    const currentTier = getCurrentTier() as PlanType;
    const selectedModel = getModelById(getStoredSelectedModelId());

    if (canAccessModel(currentTier, selectedModel.requiredTier, { hasByok })) {
        return selectedModel.id;
    }

    return DEFAULT_MODEL.id;
};

const getErrorMessage = (error: unknown) => {
    if (!error || typeof error !== 'object') return '';

    const maybeMessage = 'message' in error ? error.message : '';
    return typeof maybeMessage === 'string' ? maybeMessage : '';
};

const isMissingColumnError = (error: unknown, columnName: string) => {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes(columnName.toLowerCase());
};

const getStringField = (data: Record<string, unknown>, key: string, fallback = '') => {
    const value = data[key];
    return typeof value === 'string' ? value : fallback;
};

const getBooleanField = (data: Record<string, unknown>, key: string, fallback = false) => {
    const value = data[key];
    return typeof value === 'boolean' ? value : fallback;
};

const isAIModel = (value: unknown): value is AIModel => {
    if (!value || typeof value !== 'object') return false;

    const model = value as Partial<AIModel>;
    return typeof model.id === 'string'
        && typeof model.name === 'string'
        && typeof model.description === 'string'
        && (model.requiredTier === 'free' || model.requiredTier === 'plus' || model.requiredTier === 'pro');
};

export type AIResponseStyle = 'concise' | 'balanced' | 'detailed';
export type AIResponseLanguage = 'en' | 'id';
export type BYOKValidationState = 'idle' | 'checking' | 'valid' | 'invalid';
export type AIProviderMode = 'paapan' | 'byok';
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface AISettingsProfile {
    responseStyle: AIResponseStyle;
    responseLanguage: AIResponseLanguage;
    userName: string;
    customInstructions: string;
    allowWebSearch: boolean;
}

const DEFAULT_PROFILE: AISettingsProfile = {
    responseStyle: 'balanced',
    responseLanguage: 'id',
    userName: '',
    customInstructions: '',
    allowWebSearch: false,
};

export interface AISettingsState {
    currentSettings: AISettingsProfile;
    isLoaded: boolean;
    selectedModelId: string;
    customApiKey: string;
    aiProviderMode: AIProviderMode;
    byokProvider: AIProvider;
    byokAvailableModels: AIModel[];
    byokVisibleModelIds: string[];
    byokValidationState: BYOKValidationState;
    byokError: string | null;
    byokLastValidatedAt: string | null;

    setSelectedModel: (modelId: string) => void;
    setCustomApiKey: (apiKey: string) => void;
    setAIProviderMode: (mode: AIProviderMode) => void;
    setByokProvider: (provider: AIProvider) => void;
    toggleByokVisibleModel: (modelId: string) => void;
    validateCustomApiKey: () => Promise<boolean>;
    clearCustomApiKey: () => void;

    loadSettingsFromProfile: (userId: string) => Promise<void>;
    saveSettings: (userId: string, settings: Partial<AISettingsProfile>) => Promise<void>;
    resetSettings: () => void;
    getSettings: () => AISettingsProfile;
    hasActiveCustomKey: () => boolean;
    isByokModeEnabled: () => boolean;
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
    currentSettings: { ...DEFAULT_PROFILE },
    isLoaded: false,
    selectedModelId: getStoredSelectedModelId(),
    customApiKey: getStoredCustomApiKey(),
    aiProviderMode: getStoredAIProviderMode(),
    byokProvider: getStoredByokProvider(),
    byokAvailableModels: getStoredByokAvailableModels(),
    byokVisibleModelIds: getStoredByokVisibleModelIds(),
    byokValidationState: getStoredCustomApiKey() && getStoredByokValidatedAt() ? 'valid' : 'idle',
    byokError: null,
    byokLastValidatedAt: getStoredByokValidatedAt(),

    setSelectedModel: (modelId: string) => {
        persistSelectedModelId(modelId);

        set({ selectedModelId: modelId });
    },

    setCustomApiKey: (apiKey: string) => {
        persistCustomApiKey(apiKey);
        persistByokValidatedAt(null);
        persistByokAvailableModels([]);

        set({
            customApiKey: apiKey.trim(),
            byokValidationState: apiKey.trim() ? 'idle' : 'idle',
            byokError: null,
            byokLastValidatedAt: null,
            byokAvailableModels: [],
        });
    },

    setAIProviderMode: (mode: AIProviderMode) => {
        const currentTier = getCurrentTier() as PlanType;
        const nextMode = currentTier === 'api-pro' ? 'byok' : mode;
        persistAIProviderMode(nextMode);
        const state = get();
        const canKeepCurrentModel = nextMode === 'byok'
            ? state.byokVisibleModelIds.includes(state.selectedModelId)
            : canAccessModel(currentTier, getModelById(state.selectedModelId).requiredTier, { hasByok: false });
        const nextSelectedModelId = canKeepCurrentModel
            ? state.selectedModelId
            : nextMode === 'byok'
                ? state.byokVisibleModelIds[0]
                : DEFAULT_MODEL.id;

        persistSelectedModelId(nextSelectedModelId);
        set({
            aiProviderMode: nextMode,
            selectedModelId: nextSelectedModelId,
        });
    },

    setByokProvider: (provider: AIProvider) => {
        const nextProvider = provider === 'gemini' ? 'gemini' : provider;
        persistByokProvider(nextProvider);
        persistByokValidatedAt(null);
        persistByokAvailableModels([]);
        set({
            byokProvider: nextProvider,
            byokValidationState: 'idle',
            byokError: nextProvider === 'gemini' ? null : 'Provider ini sedang disiapkan dan belum bisa dipakai.',
            byokLastValidatedAt: null,
            byokAvailableModels: [],
        });
    },

    toggleByokVisibleModel: (modelId: string) => {
        const state = get();
        if (state.byokAvailableModels.length > 0 && !state.byokAvailableModels.some((model) => model.id === modelId)) return;
        const exists = state.byokVisibleModelIds.includes(modelId);
        let nextModelIds = state.byokVisibleModelIds;

        if (exists) {
            if (state.byokVisibleModelIds.length === 1) {
                return;
            }
            nextModelIds = state.byokVisibleModelIds.filter((id) => id !== modelId);
        } else {
            if (state.byokVisibleModelIds.length >= 3) {
                nextModelIds = [...state.byokVisibleModelIds.slice(0, -1), modelId];
            } else {
                nextModelIds = [...state.byokVisibleModelIds, modelId];
            }
        }

        persistByokVisibleModelIds(nextModelIds);

        const selectedModelAllowed = nextModelIds.includes(state.selectedModelId);
        const nextSelectedModelId = selectedModelAllowed ? state.selectedModelId : nextModelIds[0];

        if (nextSelectedModelId) {
            persistSelectedModelId(nextSelectedModelId);
        }

        set({
            byokVisibleModelIds: nextModelIds,
            selectedModelId: nextSelectedModelId || DEFAULT_MODEL.id,
        });
    },

    validateCustomApiKey: async () => {
        const apiKey = get().customApiKey.trim();
        if (!apiKey) {
            set({
                byokValidationState: 'invalid',
                byokError: 'Masukkan API key Gemini Anda terlebih dahulu.',
                byokLastValidatedAt: null,
            });
            return false;
        }

        set({
            byokValidationState: 'checking',
            byokError: null,
        });

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                set({
                    byokValidationState: 'invalid',
                    byokError: 'Silakan login dulu untuk memvalidasi API key pribadi Anda.',
                    byokLastValidatedAt: null,
                });
                return false;
            }

            const response = await fetch('/api/byok/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ apiKey, provider: get().byokProvider }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const nextError = typeof data.error === 'string'
                    ? data.error
                    : 'API key belum bisa divalidasi saat ini. Coba lagi sebentar lagi.';

                persistByokValidatedAt(null);
                persistByokAvailableModels([]);
                set({
                    byokValidationState: 'invalid',
                    byokError: nextError,
                    byokLastValidatedAt: null,
                    byokAvailableModels: [],
                });
                return false;
            }

            const validatedAt = new Date().toISOString();
            const rawAvailableModels: unknown[] = Array.isArray(data.availableModels) ? data.availableModels : [];
            const availableModels = rawAvailableModels.filter(isAIModel);
            const nextAvailableModels = availableModels.length > 0 ? availableModels : get().byokAvailableModels;
            const nextAvailableModelIds = nextAvailableModels.map((model) => model.id);
            const recommendedModelId = typeof data.recommendedModelId === 'string' && nextAvailableModelIds.includes(data.recommendedModelId)
                ? data.recommendedModelId
                : getPreferredByokDefaultModelId(nextAvailableModelIds);
            const nextVisibleModelIds = nextAvailableModelIds.length > 0
                ? nextAvailableModelIds.slice(0, 3)
                : get().byokVisibleModelIds;
            const nextSelectedModelId = recommendedModelId || nextVisibleModelIds[0] || get().selectedModelId;

            persistByokValidatedAt(validatedAt);
            persistByokAvailableModels(nextAvailableModels);
            persistByokVisibleModelIds(nextVisibleModelIds);
            persistSelectedModelId(nextSelectedModelId);
            set({
                byokValidationState: 'valid',
                byokError: null,
                byokLastValidatedAt: validatedAt,
                byokAvailableModels: nextAvailableModels,
                byokVisibleModelIds: nextVisibleModelIds,
                selectedModelId: nextSelectedModelId,
            });
            return true;
        } catch (error) {
            persistByokValidatedAt(null);
            persistByokAvailableModels([]);
            set({
                byokValidationState: 'invalid',
                byokError: 'Gagal menghubungi server untuk memvalidasi API key. Coba lagi sebentar lagi.',
                byokLastValidatedAt: null,
                byokAvailableModels: [],
            });
            return false;
        }
    },

    clearCustomApiKey: () => {
        persistCustomApiKey('');
        persistByokValidatedAt(null);
        persistByokAvailableModels([]);
        const fallbackModelId = getFallbackModelId(false);
        persistSelectedModelId(fallbackModelId);
        const fallbackMode = getCurrentTier() === 'api-pro' ? 'byok' : 'paapan';
        persistAIProviderMode(fallbackMode);
        set({
            customApiKey: '',
            aiProviderMode: fallbackMode,
            byokValidationState: 'idle',
            byokError: null,
            byokLastValidatedAt: null,
            byokProvider: 'gemini',
            byokAvailableModels: [],
            byokVisibleModelIds: DEFAULT_BYOK_VISIBLE_MODEL_IDS,
            selectedModelId: fallbackModelId,
        });
    },

    loadSettingsFromProfile: async (userId: string) => {
        try {
            const primaryQuery = await supabase
                .from('profiles')
                .select('ai_response_style, ai_language, ai_custom_instructions, ai_user_name, ai_allow_web_search')
                .eq('id', userId)
                .maybeSingle();

            let data = primaryQuery.data as Record<string, unknown> | null;
            let error = primaryQuery.error;

            if (error && isMissingColumnError(error, 'ai_allow_web_search')) {
                const fallbackQuery = await supabase
                    .from('profiles')
                    .select('ai_response_style, ai_language, ai_custom_instructions, ai_user_name')
                    .eq('id', userId)
                    .maybeSingle();

                data = fallbackQuery.data as Record<string, unknown> | null;
                error = fallbackQuery.error;
            }

            if (error && error.code !== 'PGRST116') {
                console.warn('[AISettings] Falling back to default settings because profile settings could not be loaded.', getErrorMessage(error) || error);
                set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: true });
                return;
            }

            if (data) {
                set({
                    currentSettings: {
                        responseStyle: getStringField(data, 'ai_response_style', DEFAULT_PROFILE.responseStyle) as AIResponseStyle,
                        responseLanguage: getStringField(data, 'ai_language', DEFAULT_PROFILE.responseLanguage) as AIResponseLanguage,
                        userName: getStringField(data, 'ai_user_name'),
                        customInstructions: getStringField(data, 'ai_custom_instructions'),
                        allowWebSearch: getBooleanField(data, 'ai_allow_web_search', DEFAULT_PROFILE.allowWebSearch),
                    },
                    isLoaded: true,
                });
            } else {
                set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: true });
            }
        } catch (err) {
            console.error('[AISettings] Failed to load settings:', err);
            set({ currentSettings: { ...DEFAULT_PROFILE }, isLoaded: true });
        }
    },

    saveSettings: async (userId: string, settings: Partial<AISettingsProfile>) => {
        const currentSettings = get().currentSettings;
        const newSettings = { ...currentSettings, ...settings };

        set({ currentSettings: newSettings });

        try {
            const updatePayload = {
                ai_response_style: newSettings.responseStyle,
                ai_language: newSettings.responseLanguage,
                ai_custom_instructions: newSettings.customInstructions || null,
                ai_user_name: newSettings.userName || null,
                ai_allow_web_search: newSettings.allowWebSearch,
                updated_at: new Date().toISOString(),
            };

            let { error } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', userId);

            if (error && isMissingColumnError(error, 'ai_allow_web_search')) {
                const fallbackPayload = {
                    ai_response_style: newSettings.responseStyle,
                    ai_language: newSettings.responseLanguage,
                    ai_custom_instructions: newSettings.customInstructions || null,
                    ai_user_name: newSettings.userName || null,
                    updated_at: new Date().toISOString(),
                };

                const fallbackResult = await supabase
                    .from('profiles')
                    .update(fallbackPayload)
                    .eq('id', userId);

                error = fallbackResult.error;
            }

            if (error) {
                console.error('[AISettings] Error saving to Supabase:', error.message, error.code, error.details);
                set({ currentSettings });
            }
        } catch (err) {
            console.error('[AISettings] Failed to save settings:', err);
            set({ currentSettings });
        }
    },

    resetSettings: () => {
        persistCustomApiKey('');
        persistByokValidatedAt(null);
        persistByokAvailableModels([]);
        persistAIProviderMode('paapan');
        persistByokVisibleModelIds(DEFAULT_BYOK_VISIBLE_MODEL_IDS);
        persistSelectedModelId(DEFAULT_MODEL.id);
        set({
            currentSettings: { ...DEFAULT_PROFILE },
            isLoaded: false,
            customApiKey: '',
            aiProviderMode: 'paapan',
            byokProvider: 'gemini',
            byokAvailableModels: [],
            byokVisibleModelIds: DEFAULT_BYOK_VISIBLE_MODEL_IDS,
            byokValidationState: 'idle',
            byokError: null,
            byokLastValidatedAt: null,
            selectedModelId: DEFAULT_MODEL.id,
        });
    },

    getSettings: () => get().currentSettings,

    hasActiveCustomKey: () => {
        const state = get();
        return Boolean(state.customApiKey.trim()) && state.byokValidationState === 'valid';
    },

    isByokModeEnabled: () => {
        const state = get();
        return state.aiProviderMode === 'byok' && state.hasActiveCustomKey();
    },
}));
