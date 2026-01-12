'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import getStroke from 'perfect-freehand';
import { useMindStore } from '@/store/useMindStore';
import { useReactFlow, useViewport } from 'reactflow';

/**
 * Get SVG path from stroke points
 */
function getSvgPathFromStroke(stroke: number[][]): string {
    if (!stroke.length) return '';

    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
}

/**
 * Bounds helper
 */
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function getStrokeBounds(points: number[][], size: number): Bounds {
    if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    // Add padding for stroke width
    const padding = size;
    return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding
    };
}

/**
 * Get stroke options helper
 */
const getStrokeOptions = (size: number) => ({
    size: size,
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    start: { cap: true },
    end: { cap: true },
});

/**
 * Memoized Stroke Component
 * Only re-calculates the SVG path when points, color, or size change.
 */
const MemoizedStroke = React.memo(({ points, color, size }: { points: number[][], color: string, size: number }) => {
    const d = useMemo(() => {
        const stroke = getStroke(points, getStrokeOptions(size));
        return getSvgPathFromStroke(stroke);
    }, [points, size]);

    return <path d={d} fill={color} />;
});
MemoizedStroke.displayName = 'MemoizedStroke';

/**
 * Simple Stroke Component (LOD)
 * Renders a simple polyline for low zoom levels to save performance.
 */
const SimpleStroke = React.memo(({ points, color, size }: { points: number[][], color: string, size: number }) => {
    const pointsStr = useMemo(() => {
        return points.map(p => `${p[0]},${p[1]}`).join(' ');
    }, [points]);

    return (
        <polyline
            points={pointsStr}
            fill="none"
            stroke={color}
            strokeWidth={size}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8} // Slight opacity to blend better at distance
        />
    );
});
SimpleStroke.displayName = 'SimpleStroke';

/**
 * Check if a point is near a stroke
 */
function isPointNearStroke(px: number, py: number, strokePoints: number[][], threshold: number): boolean {
    for (const [sx, sy] of strokePoints) {
        const dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
        if (dist < threshold) return true;
    }
    return false;
}

/**
 * Drawing Layer Component
 * Renders strokes INSIDE the ReactFlow viewport for perfect sync
 */
export default function DrawingLayer() {
    const currentPathRef = useRef<SVGPathElement>(null);
    const isDrawingRef = useRef(false);
    const currentPointsRef = useRef<number[][]>([]);
    const [viewportElement, setViewportElement] = useState<HTMLElement | null>(null);
    const [, setForceUpdate] = useState(0);

    // Track window size for culling
    const [windowSize, setWindowSize] = useState(() =>
        typeof window !== 'undefined'
            ? { width: window.innerWidth, height: window.innerHeight }
            : { width: 0, height: 0 }
    );

    const {
        tool,
        strokes,
        penColor,
        penSize,
        addStroke,
        isEraser,
        eraserSize,
        deleteStroke,
    } = useMindStore();

    const { screenToFlowPosition, getZoom } = useReactFlow();
    const { x, y, zoom } = useViewport();

    // Find the ReactFlow viewport element on mount
    useEffect(() => {
        const viewportPane = document.querySelector('.react-flow__viewport');
        if (viewportPane) {
            setViewportElement(viewportPane as HTMLElement);
        }

        // Track resize
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Convert screen coordinates to flow coordinates WITHOUT grid snapping
    const screenToCanvas = useCallback((clientX: number, clientY: number) => {
        // Get the React Flow container
        const flowContainer = document.querySelector('.react-flow');
        if (!flowContainer) return { x: clientX, y: clientY };

        const rect = flowContainer.getBoundingClientRect();
        // Use imperative getZoom to allow using this in callbacks without dependency cycling
        const currentZoom = getZoom();
        const viewportEl = document.querySelector('.react-flow__viewport');

        if (viewportEl) {
            const transform = window.getComputedStyle(viewportEl).transform;
            const matrix = new DOMMatrix(transform);

            // Convert screen position to flow position without snapping
            const x = (clientX - rect.left - matrix.e) / matrix.a;
            const y = (clientY - rect.top - matrix.f) / matrix.d;

            return { x, y };
        }

        // Fallback
        return screenToFlowPosition({ x: clientX, y: clientY });
    }, [screenToFlowPosition, getZoom]);

    // Directly update path element without React state
    const updateCurrentPath = useCallback(() => {
        if (!currentPathRef.current || currentPointsRef.current.length < 2) return;

        const stroke = getStroke(currentPointsRef.current, getStrokeOptions(penSize));
        const pathData = getSvgPathFromStroke(stroke);
        currentPathRef.current.setAttribute('d', pathData);
    }, [penSize]);

    // Erase strokes near point
    const eraseNearPoint = useCallback((px: number, py: number) => {
        const zoom = getZoom();
        const threshold = eraserSize / zoom;
        const strokesToDelete: string[] = [];

        for (const stroke of strokes) {
            if (isPointNearStroke(px, py, stroke.points, threshold)) {
                strokesToDelete.push(stroke.id);
            }
        }

        strokesToDelete.forEach(id => deleteStroke(id));
    }, [strokes, eraserSize, getZoom, deleteStroke]);

    // Use window event listeners for drawing
    useEffect(() => {
        if (tool !== 'pen') return;

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;

            const pos = screenToCanvas(e.clientX, e.clientY);

            if (isEraser) {
                eraseNearPoint(pos.x, pos.y);
                isDrawingRef.current = true;
            } else {
                isDrawingRef.current = true;
                currentPointsRef.current = [[pos.x, pos.y, 0.5]];

                if (currentPathRef.current) {
                    currentPathRef.current.setAttribute('d', '');
                    currentPathRef.current.style.display = 'block';
                }
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDrawingRef.current) return;

            const pos = screenToCanvas(e.clientX, e.clientY);

            if (isEraser) {
                eraseNearPoint(pos.x, pos.y);
            } else {
                currentPointsRef.current.push([pos.x, pos.y, 0.5]);
                updateCurrentPath();
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!isDrawingRef.current) return;
            if (e.button !== 0) return;

            isDrawingRef.current = false;

            if (!isEraser && currentPointsRef.current.length > 1) {
                addStroke({
                    points: currentPointsRef.current,
                    color: penColor,
                    size: penSize,
                });
            }

            currentPointsRef.current = [];

            if (currentPathRef.current) {
                currentPathRef.current.setAttribute('d', '');
                currentPathRef.current.style.display = 'none';
            }

            setForceUpdate(prev => prev + 1);
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [tool, screenToCanvas, penColor, penSize, addStroke, updateCurrentPath, isEraser, eraseNearPoint]);

    // Calculate stroke bounds once per stroke list update
    const strokeBounds = useMemo(() => {
        return new Map(strokes.map(s => [s.id, getStrokeBounds(s.points, s.size)]));
    }, [strokes]);

    // Filter visible strokes
    const visibleStrokes = useMemo(() => {
        if (windowSize.width === 0 || zoom === 0) return strokes;

        const visibleMinX = -x / zoom;
        const visibleMinY = -y / zoom;
        const visibleMaxX = (windowSize.width - x) / zoom;
        const visibleMaxY = (windowSize.height - y) / zoom;

        // Add buffer to avoid popping
        const BUFFER = 200 / zoom;

        const bufferedMinX = visibleMinX - BUFFER;
        const bufferedMinY = visibleMinY - BUFFER;
        const bufferedMaxX = visibleMaxX + BUFFER;
        const bufferedMaxY = visibleMaxY + BUFFER;

        return strokes.filter(stroke => {
            const bounds = strokeBounds.get(stroke.id);
            if (!bounds) return true;

            return (
                bounds.maxX >= bufferedMinX &&
                bounds.minX <= bufferedMaxX &&
                bounds.maxY >= bufferedMinY &&
                bounds.minY <= bufferedMaxY
            );
        });
    }, [strokes, strokeBounds, x, y, zoom, windowSize]);

    // LOD Decision
    const useSimpleStrokes = zoom < 0.5;

    // The SVG content that will be rendered inside the viewport
    const svgContent = (
        <svg
            className="react-flow__drawing-layer"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
                pointerEvents: 'none',
                zIndex: 5, // Below nodes but above background
            }}
        >
            <g>
                {visibleStrokes.map((stroke) => (
                    useSimpleStrokes ? (
                        <SimpleStroke
                            key={stroke.id}
                            points={stroke.points}
                            color={stroke.color}
                            size={stroke.size}
                        />
                    ) : (
                        <MemoizedStroke
                            key={stroke.id}
                            points={stroke.points}
                            color={stroke.color}
                            size={stroke.size}
                        />
                    )
                ))}

                {!isEraser && (
                    <path
                        ref={currentPathRef}
                        fill={penColor}
                        opacity={0.9}
                        style={{ display: 'none' }}
                    />
                )}
            </g>
        </svg>
    );

    // Use portal to render SVG inside the ReactFlow viewport
    if (viewportElement) {
        return createPortal(svgContent, viewportElement);
    }

    return null;
}
