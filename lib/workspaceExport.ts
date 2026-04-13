"use client";

import { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion } from '@/types';

export type WorkspaceExportFormat = 'png' | 'jpg' | 'webp' | 'pdf';
export type WorkspaceExportTheme = 'light' | 'dark';

type Bounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type WorkspaceExportInput = {
    nodes: CanvasNodeType[];
    frames: FrameRegion[];
    strokes: DrawingStroke[];
    arrows: ArrowShape[];
};

export const EXPORT_PADDING = 80;
export const EXPORT_BACKGROUND_COLOR = '#F8FAFC';
export const EXPORT_DOT_COLOR = '#BCC5D1';
export const EXPORT_THEME_COLORS: Record<WorkspaceExportTheme, { background: string; dot: string }> = {
    light: {
        background: '#F8FAFC',
        dot: '#BCC5D1',
    },
    dark: {
        background: '#0F172A',
        dot: '#334155',
    },
};
const EXPORT_DOT_SIZE = 25;
const MAX_EXPORT_SIDE = 2400;
const MIN_EXPORT_WIDTH = 640;
const MIN_EXPORT_HEIGHT = 480;

const DEFAULT_NODE_SIZE: Record<CanvasNodeType['type'], { width: number; height: number }> = {
    mindNode: { width: 350, height: 240 },
    aiInput: { width: 380, height: 88 },
    imageNode: { width: 240, height: 240 },
    textNode: { width: 240, height: 160 },
};

const EXPORT_IGNORED_SELECTORS = [
    '[data-export-ignore="true"]',
    '.react-flow__minimap',
    '.react-flow__controls',
    '.react-flow__attribution',
    '.react-flow__panel',
    '.react-flow__handle',
    '.react-flow__resize-control',
    '.react-flow__resize-control-line',
    '.react-flow__resize-control-handle',
    '.react-flow__selection',
    '.react-flow__selectionpane',
    '.react-flow__nodesselection',
    '.react-flow__node-toolbar',
    '.handle-menu',
    '.node-settings-menu',
    '[data-highlight-toolbar-ignore="true"]',
    '[data-frame-handle-dot="true"]',
].join(', ');

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const mergeBounds = (current: Bounds | null, next: Bounds | null): Bounds | null => {
    if (!next) return current;
    if (!current) return next;

    return {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
    };
};

const rectToBounds = (rect: Rect | null): Bounds | null => {
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;

    return {
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
    };
};

const getNodeRect = (node: CanvasNodeType): Rect => {
    const fallback = DEFAULT_NODE_SIZE[node.type];
    const width = typeof node.width === 'number' && Number.isFinite(node.width) && node.width > 0
        ? node.width
        : fallback.width;
    const height = typeof node.height === 'number' && Number.isFinite(node.height) && node.height > 0
        ? node.height
        : fallback.height;

    return {
        x: node.position.x,
        y: node.position.y,
        width,
        height,
    };
};

const getStrokeBounds = (stroke: DrawingStroke): Bounds | null => {
    if (!stroke.points.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of stroke.points) {
        const [x, y] = point;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    const padding = Math.max(stroke.size || 1, 1);

    return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
    };
};

const getArrowBounds = (arrow: ArrowShape): Bounds | null => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let t = 0; t <= 1; t += 0.05) {
        const inverse = 1 - t;
        const x =
            inverse * inverse * arrow.start.x +
            2 * inverse * t * arrow.control.x +
            t * t * arrow.end.x;
        const y =
            inverse * inverse * arrow.start.y +
            2 * inverse * t * arrow.control.y +
            t * t * arrow.end.y;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
    }

    const padding = Math.max((arrow.size || 2) * 5, 18);

    return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
    };
};

export const getWorkspaceExportRect = ({
    nodes,
    frames,
    strokes,
    arrows,
}: WorkspaceExportInput): Rect | null => {
    let bounds: Bounds | null = null;

    for (const node of nodes) {
        bounds = mergeBounds(bounds, rectToBounds(getNodeRect(node)));
    }

    for (const frame of frames) {
        bounds = mergeBounds(bounds, rectToBounds({
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
        }));
    }

    for (const stroke of strokes) {
        bounds = mergeBounds(bounds, getStrokeBounds(stroke));
    }

    for (const arrow of arrows) {
        bounds = mergeBounds(bounds, getArrowBounds(arrow));
    }

    if (!bounds) return null;

    return {
        x: bounds.minX,
        y: bounds.minY,
        width: Math.max(bounds.maxX - bounds.minX, 1),
        height: Math.max(bounds.maxY - bounds.minY, 1),
    };
};

export const getWorkspaceExportLayout = (
    rect: Rect,
    options?: {
        padding?: number;
        maxSide?: number;
        minWidth?: number;
        minHeight?: number;
    }
) => {
    const padding = options?.padding ?? EXPORT_PADDING;
    const maxSide = options?.maxSide ?? MAX_EXPORT_SIDE;
    const minWidth = options?.minWidth ?? MIN_EXPORT_WIDTH;
    const minHeight = options?.minHeight ?? MIN_EXPORT_HEIGHT;
    const rawWidth = Math.max(Math.ceil(rect.width + padding * 2), minWidth);
    const rawHeight = Math.max(Math.ceil(rect.height + padding * 2), minHeight);
    const scale = Math.min(1, maxSide / Math.max(rawWidth, rawHeight));
    const width = Math.max(Math.round(rawWidth * scale), 1);
    const height = Math.max(Math.round(rawHeight * scale), 1);
    const translateX = (padding - rect.x) * scale;
    const translateY = (padding - rect.y) * scale;
    const dotSize = clamp(EXPORT_DOT_SIZE * scale, 8, EXPORT_DOT_SIZE);

    return {
        width,
        height,
        scale,
        translateX,
        translateY,
        dotSize,
        dotRadius: clamp(1.45 * scale, 0.6, 1.45),
        dotFade: clamp(1.62 * scale, 0.9, 1.62),
    };
};

export const getWorkspaceExportWrapperStyle = (rect: Rect) => {
    const layout = getWorkspaceExportLayout(rect);

    return {
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        position: 'relative',
        overflow: 'hidden',
        display: 'block',
        backgroundColor: EXPORT_BACKGROUND_COLOR,
        backgroundImage: `radial-gradient(circle, ${EXPORT_DOT_COLOR} ${layout.dotRadius.toFixed(2)}px, transparent ${layout.dotFade.toFixed(2)}px)`,
        backgroundSize: `${layout.dotSize.toFixed(2)}px ${layout.dotSize.toFixed(2)}px`,
        backgroundPosition: `${layout.translateX}px ${layout.translateY}px`,
    } satisfies Partial<CSSStyleDeclaration>;
};

export const getWorkspaceExportCloneStyle = (rect: Rect) => {
    const layout = getWorkspaceExportLayout(rect);

    return {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        transform: `translate(${layout.translateX}px, ${layout.translateY}px) scale(${layout.scale})`,
        transformOrigin: '0 0',
        overflow: 'visible',
    } satisfies Partial<CSSStyleDeclaration>;
};

export const shouldIncludeExportNode = (node: HTMLElement | SVGElement) => {
    if (!node.matches) return true;
    if (node.classList.contains('react-flow__viewport')) return true;

    return !node.matches(EXPORT_IGNORED_SELECTORS) && !node.closest(EXPORT_IGNORED_SELECTORS);
};

export const stripExportUiElements = (root: HTMLElement) => {
    const ignoredNodes = root.querySelectorAll(EXPORT_IGNORED_SELECTORS);

    ignoredNodes.forEach((node) => {
        node.remove();
    });
};

export const buildWorkspaceExportFileName = (workspaceName: string | null | undefined, format: WorkspaceExportFormat) => {
    const safeBaseName = (workspaceName || 'paapan-board')
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    const dateStamp = new Date().toISOString().slice(0, 10);

    return `${safeBaseName || 'paapan-board'}-${dateStamp}.${format}`;
};
