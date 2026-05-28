export const PAAPAN_EXPERIMENT_HEADER = 'x-paapan-experiment-mode';
export const PAAPAN_EXPERIMENT_VALUE = 'experiment-v1';

export type ExperimentModeConfig = {
    enabled: true;
    storageNamespace: string;
    localOnly?: boolean;
    unlimitedBoards?: boolean;
    unlimitedCanvas?: boolean;
    unlimitedAI?: boolean;
    hideAuthUi?: boolean;
};

let currentExperimentMode: ExperimentModeConfig | null = null;

const DEFAULT_STORAGE_KEYS = {
    workspaces: 'spatial-ai-workspaces',
    activeWorkspace: 'spatial-ai-active-workspace',
};

export const setExperimentMode = (config: ExperimentModeConfig | null) => {
    currentExperimentMode = config;
};

export const getExperimentMode = () => currentExperimentMode;

export const isExperimentModeEnabled = () => currentExperimentMode?.enabled === true;

export const isExperimentLocalOnly = () => (
    isExperimentModeEnabled() && currentExperimentMode?.localOnly !== false
);

export const shouldBypassWorkspaceLimit = () => (
    isExperimentModeEnabled() && currentExperimentMode?.unlimitedBoards !== false
);

export const shouldBypassCanvasLimits = () => (
    isExperimentModeEnabled() && currentExperimentMode?.unlimitedCanvas !== false
);

export const shouldBypassAiLimit = () => (
    isExperimentModeEnabled() && currentExperimentMode?.unlimitedAI !== false
);

export const shouldHideExperimentAuthUi = () => (
    isExperimentModeEnabled() && currentExperimentMode?.hideAuthUi !== false
);

export const getWorkspaceStorageKeys = () => {
    if (!isExperimentModeEnabled()) {
        return DEFAULT_STORAGE_KEYS;
    }

    const namespace = currentExperimentMode?.storageNamespace?.trim() || PAAPAN_EXPERIMENT_VALUE;
    return {
        workspaces: `${DEFAULT_STORAGE_KEYS.workspaces}:${namespace}`,
        activeWorkspace: `${DEFAULT_STORAGE_KEYS.activeWorkspace}:${namespace}`,
    };
};
