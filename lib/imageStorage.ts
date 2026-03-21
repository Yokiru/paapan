import { CanvasNodeType } from '@/types';

const getImageStorageKey = (node: CanvasNodeType) => {
    if (node.type !== 'imageNode') return null;

    const imageData = node.data as { storagePath?: string; src?: string };
    return imageData.storagePath || imageData.src || null;
};

const getImageStorageBytes = (node: CanvasNodeType) => {
    if (node.type !== 'imageNode') return 0;

    const imageData = node.data as { storageBytes?: number; src?: string };
    if (typeof imageData.storageBytes === 'number' && Number.isFinite(imageData.storageBytes)) {
        return imageData.storageBytes;
    }

    if (typeof imageData.src === 'string') {
        return imageData.src.length;
    }

    return 0;
};

export const getUniqueImageStorageUsageBytes = (nodes: CanvasNodeType[]) => {
    const seenKeys = new Set<string>();

    return nodes.reduce((total, node) => {
        const key = getImageStorageKey(node);
        if (!key || seenKeys.has(key)) {
            return total;
        }

        seenKeys.add(key);
        return total + getImageStorageBytes(node);
    }, 0);
};

export const formatStorageBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
