import { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion, ImageNodeData, MindNodeData, TextNodeData } from '@/types';

type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type FrameCaptureResult = {
    textContext?: string;
    imageUrls: string[];
};

const NODE_DEFAULT_SIZES: Record<string, { width: number; height: number }> = {
    mindNode: { width: 350, height: 240 },
    aiInput: { width: 380, height: 120 },
    imageNode: { width: 300, height: 220 },
    textNode: { width: 360, height: 220 },
};

const getNumericValue = (value: unknown): number | null => (
    typeof value === 'number' && Number.isFinite(value) ? value : null
);

const getNodeRect = (node: CanvasNodeType): Rect => {
    const nodeRecord = node as CanvasNodeType & {
        style?: { width?: number | string; height?: number | string };
        measured?: { width?: number; height?: number };
    };
    const nodeType = typeof node.type === 'string' ? node.type : 'mindNode';
    const defaults = NODE_DEFAULT_SIZES[nodeType] || NODE_DEFAULT_SIZES.mindNode;
    const imageData = nodeType === 'imageNode' ? node.data as ImageNodeData : null;

    const width = getNumericValue(node.width)
        ?? getNumericValue(nodeRecord.measured?.width)
        ?? getNumericValue(typeof nodeRecord.style?.width === 'number' ? nodeRecord.style.width : null)
        ?? getNumericValue(imageData?.width)
        ?? defaults.width;

    const height = getNumericValue(node.height)
        ?? getNumericValue(nodeRecord.measured?.height)
        ?? getNumericValue(typeof nodeRecord.style?.height === 'number' ? nodeRecord.style.height : null)
        ?? getNumericValue(imageData?.height)
        ?? defaults.height;

    return {
        x: node.position.x,
        y: node.position.y,
        width,
        height,
    };
};

const intersects = (a: Rect, b: Rect) => (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
);

const getStrokeRect = (stroke: DrawingStroke): Rect | null => {
    if (!Array.isArray(stroke.points) || stroke.points.length === 0) return null;

    const xs = stroke.points.map((point) => point[0]).filter((value) => Number.isFinite(value));
    const ys = stroke.points.map((point) => point[1]).filter((value) => Number.isFinite(value));
    if (xs.length === 0 || ys.length === 0) return null;

    const padding = Math.max(stroke.size || 0, 4);

    return {
        x: Math.min(...xs) - padding,
        y: Math.min(...ys) - padding,
        width: Math.max(...xs) - Math.min(...xs) + padding * 2,
        height: Math.max(...ys) - Math.min(...ys) + padding * 2,
    };
};

const getArrowRect = (arrow: ArrowShape): Rect => {
    const xs = [arrow.start.x, arrow.control.x, arrow.end.x];
    const ys = [arrow.start.y, arrow.control.y, arrow.end.y];
    const padding = Math.max(arrow.size || 0, 4);

    return {
        x: Math.min(...xs) - padding,
        y: Math.min(...ys) - padding,
        width: Math.max(...xs) - Math.min(...xs) + padding * 2,
        height: Math.max(...ys) - Math.min(...ys) + padding * 2,
    };
};

const sortNodesForContext = (nodes: CanvasNodeType[]) => (
    [...nodes].sort((a, b) => {
        if (a.position.y !== b.position.y) {
            return a.position.y - b.position.y;
        }

        return a.position.x - b.position.x;
    })
);

export const captureFrameContext = ({
    frame,
    nodes,
    strokes,
    arrows,
    ignoreNodeIds = [],
}: {
    frame: FrameRegion;
    nodes: CanvasNodeType[];
    strokes: DrawingStroke[];
    arrows: ArrowShape[];
    ignoreNodeIds?: string[];
}): FrameCaptureResult => {
    const frameRect: Rect = {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
    };

    const ignoredIds = new Set(ignoreNodeIds);
    const insideNodes = sortNodesForContext(
        nodes.filter((node) => !ignoredIds.has(node.id) && node.type !== 'aiInput' && intersects(frameRect, getNodeRect(node)))
    );

    const mindNodes = insideNodes.filter((node) => node.type === 'mindNode');
    const textNodes = insideNodes.filter((node) => node.type === 'textNode');
    const imageNodes = insideNodes.filter((node) => node.type === 'imageNode');
    const strokeCount = strokes.filter((stroke) => {
        const strokeRect = getStrokeRect(stroke);
        return strokeRect ? intersects(frameRect, strokeRect) : false;
    }).length;
    const arrowCount = arrows.filter((arrow) => intersects(frameRect, getArrowRect(arrow))).length;

    const sections: string[] = [];

    if (mindNodes.length > 0) {
        sections.push([
            'AI chats di dalam frame:',
            ...mindNodes.map((node, index) => {
                const data = node.data as MindNodeData;
                return `${index + 1}. Pertanyaan: ${data.question || '-'}\nJawaban: ${data.response || '-'}`;
            }),
        ].join('\n\n'));
    }

    if (textNodes.length > 0) {
        sections.push([
            'Text notes di dalam frame:',
            ...textNodes.map((node, index) => {
                const data = node.data as TextNodeData;
                return `${index + 1}. ${data.content || '-'}`;
            }),
        ].join('\n\n'));
    }

    const imageUrls = imageNodes
        .map((node) => (node.data as ImageNodeData).src)
        .filter((url): url is string => typeof url === 'string' && url.length > 0);

    if (imageNodes.length > 0) {
        sections.push([
            `Ada ${imageNodes.length} gambar di dalam frame.`,
            ...imageNodes.map((node, index) => {
                const data = node.data as ImageNodeData;
                return `${index + 1}. ${data.fileName || 'Gambar tanpa nama'}`;
            }),
        ].join('\n'));
    }

    if (strokeCount > 0 || arrowCount > 0) {
        const annotations: string[] = [];

        if (strokeCount > 0) {
            annotations.push(`${strokeCount} coretan bebas`);
        }

        if (arrowCount > 0) {
            annotations.push(`${arrowCount} panah/anotasi garis`);
        }

        sections.push(`Anotasi visual di area frame: ${annotations.join(', ')}.`);
    }

    return {
        textContext: sections.length > 0 ? sections.join('\n\n') : undefined,
        imageUrls: [...new Set(imageUrls)],
    };
};
