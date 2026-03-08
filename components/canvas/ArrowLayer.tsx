'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useMindStore } from '@/store/useMindStore';
import { useReactFlow, useViewport } from 'reactflow';
import { ArrowShape } from '@/types';

/** Get bounding box of a quadratic Bézier curve (start, control, end) */
function getArrowBoundingBox(arrow: ArrowShape): { minX: number; minY: number; maxX: number; maxY: number } {
    // Sample points along the Bézier for an approximate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
        const mt = 1 - t;
        const x = mt * mt * arrow.start.x + 2 * mt * t * arrow.control.x + t * t * arrow.end.x;
        const y = mt * mt * arrow.start.y + 2 * mt * t * arrow.control.y + t * t * arrow.end.y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    // Add padding equal to stroke size
    const pad = (arrow.size || 4) * 2;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** Check if two rects intersect */
function rectsIntersect(
    r1: { minX: number; minY: number; maxX: number; maxY: number },
    r2: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
    return r1.minX <= r2.maxX && r1.maxX >= r2.minX && r1.minY <= r2.maxY && r1.maxY >= r2.minY;
}

/**
 * Calculate the tangent angle at the end of a quadratic Bézier curve.
 * The tangent at t=1 is the direction from the control point to the end point.
 */
function getArrowheadAngle(control: { x: number; y: number }, end: { x: number; y: number }): number {
    return Math.atan2(end.y - control.y, end.x - control.x);
}

/**
 * Generate a smooth, rounded arrowhead path (FigJam/tldraw style).
 * Returns an SVG path `d` string using curves for a sleek look.
 */
function getArrowheadPath(end: { x: number; y: number }, angle: number, size: number): string {
    const headLength = Math.max(size * 4.5, 16);
    const headWidth = Math.max(size * 2.8, 9);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Left and right wing base points
    const left = {
        x: end.x - headLength * cos + headWidth * sin,
        y: end.y - headLength * sin - headWidth * cos,
    };
    const right = {
        x: end.x - headLength * cos - headWidth * sin,
        y: end.y - headLength * sin + headWidth * cos,
    };

    // Control points for the curved wings (pulled inward for roundness)
    const ctrlLeft = {
        x: end.x - headLength * 0.55 * cos + headWidth * 0.4 * sin,
        y: end.y - headLength * 0.55 * sin - headWidth * 0.4 * cos,
    };
    const ctrlRight = {
        x: end.x - headLength * 0.55 * cos - headWidth * 0.4 * sin,
        y: end.y - headLength * 0.55 * sin + headWidth * 0.4 * cos,
    };

    // Smooth curved arrowhead: left wing → tip → right wing, with curves
    return `M ${left.x} ${left.y} Q ${ctrlLeft.x} ${ctrlLeft.y} ${end.x} ${end.y} Q ${ctrlRight.x} ${ctrlRight.y} ${right.x} ${right.y}`;
}

/**
 * ArrowLayer — Renders free-form arrows (FigJam-style) on the canvas.
 * 
 * IMPORTANT: The container div is ALWAYS pointerEvents: 'none' so that
 * all mouse events (including middle-click pan) pass through to ReactFlow.
 * Only individual SVG elements (hit-test paths, drag handles) have pointerEvents: 'auto'.
 * Arrow creation uses window-level event listeners instead of React event handlers.
 */
export default function ArrowLayer() {
    const { arrows, addArrow, updateArrow, deleteArrow, tool, setTool } = useMindStore();
    const { screenToFlowPosition } = useReactFlow();
    const viewport = useViewport();

    // State for creating new arrows
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);

    // State for selecting/dragging existing arrows
    const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
    const selectedArrowIdRef = useRef<string | null>(null);
    useEffect(() => { selectedArrowIdRef.current = selectedArrowId; }, [selectedArrowId]);

    const [selectedArrowIds, setSelectedArrowIds] = useState<Set<string>>(new Set());

    // Refs for handle dragging (avoids async state race conditions)
    const isDraggingHandleRef = useRef(false);
    const draggingHandleRef = useRef<'start' | 'control' | 'end' | null>(null);

    // Group drag state for multi-select
    const isDraggingGroupRef = useRef(false);
    const groupDragStartRef = useRef<{ x: number; y: number } | null>(null);
    // Ref mirror of selectedArrowIds so window-level closures never go stale
    const selectedArrowIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => { selectedArrowIdsRef.current = selectedArrowIds; }, [selectedArrowIds]);

    // Lasso state
    const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const lassoStartRef = useRef<{ x: number; y: number } | null>(null);
    const isLassoingRef = useRef(false);

    // Canvas size tracking
    const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => {
            setCanvasSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Deselect arrow when tool switches away from select/arrow
    useEffect(() => {
        if (tool !== 'select' && tool !== 'arrow') {
            setSelectedArrowId(null);
            setSelectedArrowIds(new Set());
        }
    }, [tool]);

    // Keyboard shortcuts (Delete, Copy, Paste, Cut, Duplicate)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

            const state = useMindStore.getState();
            const isCtrl = e.ctrlKey || e.metaKey;

            // Delete selected arrow(s) on Delete/Backspace key
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (!(tool === 'select' || tool === 'arrow')) return;

                if (selectedArrowIdsRef.current.size > 0) {
                    selectedArrowIdsRef.current.forEach(id => deleteArrow(id));
                    setSelectedArrowIds(new Set());
                } else if (selectedArrowId) {
                    deleteArrow(selectedArrowId);
                    setSelectedArrowId(null);
                }
                return;
            }

            // Clipboard shortcuts
            if (isCtrl && tool === 'select') {
                const selectedNodeIds = state.nodes.filter(n => n.selected).map(n => n.id);
                const selectedArrowIdsArray = Array.from(selectedArrowIdsRef.current);
                if (selectedArrowId && !selectedArrowIdsArray.includes(selectedArrowId)) {
                    selectedArrowIdsArray.push(selectedArrowId);
                }

                if (e.key.toLowerCase() === 'c') {
                    state.copySelection(selectedNodeIds, selectedArrowIdsArray);
                } else if (e.key.toLowerCase() === 'x') {
                    state.cutSelection(selectedNodeIds, selectedArrowIdsArray);
                    // Clear local selection state
                    setSelectedArrowIds(new Set());
                    setSelectedArrowId(null);
                } else if (e.key.toLowerCase() === 'v') {
                    const success = state.pasteSelection();
                    if (!success) {
                        window.dispatchEvent(new Event('mindnode-limit-reached'));
                    }
                } else if (e.key.toLowerCase() === 'd') {
                    e.preventDefault(); // Prevent browser bookmark dialog
                    const success = state.duplicateSelection(selectedNodeIds, selectedArrowIdsArray);
                    if (!success) {
                        window.dispatchEvent(new Event('mindnode-limit-reached'));
                    }
                    // Re-select? The nodes will be selected, arrows won't be yet natively. 
                    // Let's just trust Zustand for nodes. Arrows might need re-selection manually.
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedArrowId, tool, deleteArrow, setSelectedArrowIds, setSelectedArrowId]);

    // ---- DESELECT LOGIC ----
    const clickedOnArrowElementRef = useRef(false);

    useEffect(() => {
        if (tool !== 'select' && tool !== 'arrow') return;

        const handleWindowClick = (e: MouseEvent) => {
            if (e.button !== 0) return;
            // Ignore click if we just finished lassoing recently
            if (isLassoingRef.current) return;
            // Ignore if we clicked on an arrow element directly
            if (clickedOnArrowElementRef.current) {
                clickedOnArrowElementRef.current = false;
                return;
            }

            setSelectedArrowId(null);
            setSelectedArrowIds(new Set());
        };

        const timer = setTimeout(() => {
            window.addEventListener('click', handleWindowClick);
        }, 0);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleWindowClick);
        };
    }, [tool]);

    // ---- ARROW CREATION via window-level events ----
    // Also handles LASSO SELECTION in select mode
    const isDrawingRef = useRef(false);
    const drawStartRef = useRef<{ x: number; y: number } | null>(null);
    const drawEndRef = useRef<{ x: number; y: number } | null>(null);
    const dragOnArrowRef = useRef(false); // true if mousedown was ON an arrow

    useEffect(() => {
        const toolRef = tool;

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;

            if (toolRef === 'arrow') {
                // Prevent native text selection while drawing
                document.body.style.userSelect = 'none';

                // Arrow creation mode
                const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                isDrawingRef.current = true;
                drawStartRef.current = flowPos;
                drawEndRef.current = flowPos;
                setIsDrawing(true);
                setDrawStart(flowPos);
                setDrawEnd(flowPos);

            } else if (toolRef === 'select') {
                // Only start lasso if not clicking ON an arrow element
                if (clickedOnArrowElementRef.current) {
                    dragOnArrowRef.current = true;
                    return;
                }
                dragOnArrowRef.current = false;

                // Prevent native text selection while lassoing
                document.body.style.userSelect = 'none';

                // Start lasso tracking in SCREEN coords
                lassoStartRef.current = { x: e.clientX, y: e.clientY };
                isLassoingRef.current = false; // don't show yet until we move
                setLassoRect(null);
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (toolRef === 'arrow' && isDrawingRef.current) {
                const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                drawEndRef.current = flowPos;
                setDrawEnd(flowPos);

            } else if (toolRef === 'select') {
                // --- Group drag active ---
                if (isDraggingGroupRef.current && groupDragStartRef.current) {
                    const current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                    const dx = current.x - groupDragStartRef.current.x;
                    const dy = current.y - groupDragStartRef.current.y;
                    groupDragStartRef.current = current;

                    // Move each selected arrow in the store
                    const selectedSet = selectedArrowIdsRef.current;
                    const singleSelected = selectedArrowIdRef.current;
                    const dragTargetIds = selectedSet.size > 0
                        ? Array.from(selectedSet)
                        : (singleSelected ? [singleSelected] : []);

                    const currentSelectedArrows = useMindStore.getState().arrows
                        .filter(a => dragTargetIds.includes(a.id));

                    currentSelectedArrows.forEach(arrow => {
                        updateArrow(arrow.id, {
                            start: { x: arrow.start.x + dx, y: arrow.start.y + dy },
                            control: { x: arrow.control.x + dx, y: arrow.control.y + dy },
                            end: { x: arrow.end.x + dx, y: arrow.end.y + dy },
                        });
                    });
                    return;
                }

                // --- Lasso drag ---
                if (lassoStartRef.current && !dragOnArrowRef.current) {
                    const dx = e.clientX - lassoStartRef.current.x;
                    const dy = e.clientY - lassoStartRef.current.y;
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        isLassoingRef.current = true;

                        const minX = Math.min(e.clientX, lassoStartRef.current.x);
                        const minY = Math.min(e.clientY, lassoStartRef.current.y);
                        const maxX = Math.max(e.clientX, lassoStartRef.current.x);
                        const maxY = Math.max(e.clientY, lassoStartRef.current.y);

                        setLassoRect({
                            x: minX,
                            y: minY,
                            w: maxX - minX,
                            h: maxY - minY,
                        });

                        // Calculate live selections
                        const topLeft = screenToFlowPosition({ x: minX, y: minY });
                        const bottomRight = screenToFlowPosition({ x: maxX, y: maxY });
                        const lassoFlowRect = {
                            minX: topLeft.x, minY: topLeft.y,
                            maxX: bottomRight.x, maxY: bottomRight.y,
                        };

                        const currentArrows = useMindStore.getState().arrows;
                        const hitIds = new Set<string>();
                        currentArrows.forEach(arrow => {
                            const bb = getArrowBoundingBox(arrow);
                            if (rectsIntersect(bb, lassoFlowRect)) {
                                hitIds.add(arrow.id);
                            }
                        });

                        if (hitIds.size === 1) {
                            const singleHitId = Array.from(hitIds)[0];
                            setSelectedArrowId(singleHitId);
                            setSelectedArrowIds(new Set());
                        } else if (hitIds.size > 1) {
                            setSelectedArrowIds(hitIds);
                            setSelectedArrowId(null);
                        } else {
                            setSelectedArrowIds(new Set());
                            setSelectedArrowId(null);
                        }
                    }
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            // Restore native text selection
            document.body.style.userSelect = '';

            if (toolRef === 'arrow') {
                if (!isDrawingRef.current) return;

                const start = drawStartRef.current;
                const end = drawEndRef.current;

                if (start && end) {
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 20) {
                        addArrow({
                            start,
                            control: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
                            end,
                            color: '#6b7280',
                            size: 4,
                        });

                        requestAnimationFrame(() => {
                            const latestArrows = useMindStore.getState().arrows;
                            if (latestArrows.length > 0) {
                                setSelectedArrowId(latestArrows[latestArrows.length - 1].id);
                            }
                        });
                    }
                }

                isDrawingRef.current = false;
                drawStartRef.current = null;
                drawEndRef.current = null;
                setIsDrawing(false);
                setDrawStart(null);
                setDrawEnd(null);

            } else if (toolRef === 'select') {
                // If not lassing and not dragging group and not on an arrow and not dragging a handle, check deselect
                if (!isLassoingRef.current && !isDraggingGroupRef.current && !dragOnArrowRef.current && !isDraggingHandleRef.current) {
                    setSelectedArrowIds(new Set());
                    setSelectedArrowId(null);
                }

                isDraggingGroupRef.current = false;
                groupDragStartRef.current = null;
                lassoStartRef.current = null;
                dragOnArrowRef.current = false;
                setLassoRect(null);

                // Delay resetting isLassoingRef and clickedOnArrowElementRef to let the native DOM 'click' event pass safely
                setTimeout(() => {
                    isLassoingRef.current = false;
                    clickedOnArrowElementRef.current = false;
                }, 50);
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [tool, screenToFlowPosition, addArrow]);

    // ---- HANDLE DRAGGING via window-level events ----
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingHandleRef.current || !draggingHandleRef.current || !selectedArrowIdRef.current) return;
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            updateArrow(selectedArrowIdRef.current, { [draggingHandleRef.current]: flowPos });
        };

        const handleMouseUp = () => {
            isDraggingHandleRef.current = false;
            draggingHandleRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [screenToFlowPosition, updateArrow]);

    // ---- HANDLE DRAGGING (Select/Arrow Tool) ----
    const handleHandleMouseDown = useCallback((e: React.MouseEvent, arrowId: string, handle: 'start' | 'control' | 'end') => {
        e.stopPropagation();
        e.preventDefault();
        clickedOnArrowElementRef.current = true;
        setSelectedArrowId(arrowId);
        draggingHandleRef.current = handle;
        isDraggingHandleRef.current = true;
    }, []);

    // ---- ARROW CLICK (Select/Arrow Tool) ----
    const handleArrowClick = useCallback((e: React.MouseEvent, arrowId: string) => {
        if (tool !== 'select' && tool !== 'arrow') return;
        e.stopPropagation();
        setSelectedArrowId(arrowId);
    }, [tool]);

    // Don't render at all if not needed
    if (arrows.length === 0 && tool !== 'arrow' && !isDrawing && !lassoRect) return null;

    // Transform for viewport
    const transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;

    return (
        <>
            {/* Lasso selection overlay (screen coords, outside the transformed SVG) */}
            {lassoRect && tool === 'select' && (
                <div
                    style={{
                        position: 'fixed',
                        left: lassoRect.x,
                        top: lassoRect.y,
                        width: lassoRect.w,
                        height: lassoRect.h,
                        background: 'rgba(59,130,246,0.06)',
                        border: '1.5px solid rgba(59,130,246,0.35)',
                        borderRadius: 4,
                        pointerEvents: 'none',
                        zIndex: 999,
                    }}
                />
            )}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none', // ALWAYS none — never block ReactFlow events
                    zIndex: 4,
                }}
            >
                <svg
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: canvasSize.width,
                        height: canvasSize.height,
                        overflow: 'visible',
                        pointerEvents: 'none',
                    }}
                >
                    <g style={{ transform, transformOrigin: '0 0' }}>
                        {/* Multi-select bounding box (Figma-style) */}
                        {selectedArrowIds.size > 1 && (() => {
                            // Compute combined bounding box of all selected arrows
                            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                            arrows.forEach(a => {
                                if (!selectedArrowIds.has(a.id)) return;
                                const bb = getArrowBoundingBox(a);
                                if (bb.minX < minX) minX = bb.minX;
                                if (bb.minY < minY) minY = bb.minY;
                                if (bb.maxX > maxX) maxX = bb.maxX;
                                if (bb.maxY > maxY) maxY = bb.maxY;
                            });
                            const pad = 12 / viewport.zoom; // padding in flow coords (stays 12px on screen)
                            const bx = minX - pad, by = minY - pad;
                            const bw = maxX - minX + pad * 2;
                            const bh = maxY - minY + pad * 2;
                            const hw = 6 / viewport.zoom; // corner handle half-width in flow coords
                            const corners = [
                                { cx: bx, cy: by },
                                { cx: bx + bw, cy: by },
                                { cx: bx, cy: by + bh },
                                { cx: bx + bw, cy: by + bh },
                            ];
                            return (
                                <>
                                    {/* Selection rect — clickable to start group drag */}
                                    <rect
                                        x={bx} y={by} width={bw} height={bh}
                                        fill="rgba(59,130,246,0.04)"
                                        stroke="#3b82f6"
                                        strokeWidth={1.5 / viewport.zoom}
                                        rx={4 / viewport.zoom}
                                        style={{ pointerEvents: 'all', cursor: 'move' }}
                                        onMouseDown={(e) => {
                                            if (e.button !== 0) return;
                                            e.stopPropagation();
                                            clickedOnArrowElementRef.current = true;
                                            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                                            isDraggingGroupRef.current = true;
                                            groupDragStartRef.current = flowPos;
                                        }}
                                    />
                                    {/* Corner handle squares */}
                                    {corners.map((c, i) => (
                                        <rect
                                            key={i}
                                            x={c.cx - hw} y={c.cy - hw}
                                            width={hw * 2} height={hw * 2}
                                            fill="white"
                                            stroke="#3b82f6"
                                            strokeWidth={1.5 / viewport.zoom}
                                            rx={1.5 / viewport.zoom}
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    ))}
                                </>
                            );
                        })()}
                        {/* Render existing arrows */}
                        {arrows.map(arrow => {
                            const angle = getArrowheadAngle(arrow.control, arrow.end);
                            const arrowheadD = getArrowheadPath(arrow.end, angle, arrow.size);

                            return (
                                <g key={arrow.id}>
                                    {/* Invisible wider path for easier click target */}
                                    <path
                                        d={`M ${arrow.start.x} ${arrow.start.y} Q ${arrow.control.x} ${arrow.control.y} ${arrow.end.x} ${arrow.end.y}`}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={Math.max(arrow.size * 4, 20)}
                                        style={{
                                            cursor: (tool === 'select' || tool === 'arrow') ? 'pointer' : 'default',
                                            pointerEvents: (tool === 'select' || tool === 'arrow') ? 'stroke' : 'none',
                                        }}
                                        onClick={(e) => {
                                            clickedOnArrowElementRef.current = true;
                                            handleArrowClick(e, arrow.id);
                                        }}
                                        onMouseDown={(e) => {
                                            if (e.button === 0 && (tool === 'select' || tool === 'arrow')) {
                                                clickedOnArrowElementRef.current = true;
                                                e.stopPropagation();
                                                e.preventDefault(); // Prevent native SVG dragging

                                                // Prevent text selection globally while dragging
                                                document.body.style.userSelect = 'none';

                                                // Make sure it's selected first
                                                handleArrowClick(e as unknown as React.MouseEvent, arrow.id);

                                                // Initiate drag for this arrow (reuses the group drag logic)
                                                const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                                                isDraggingGroupRef.current = true;
                                                groupDragStartRef.current = flowPos;
                                            }
                                        }}
                                    />
                                    {/* Visible arrow path - always use original color */}
                                    <path
                                        d={`M ${arrow.start.x} ${arrow.start.y} Q ${arrow.control.x} ${arrow.control.y} ${arrow.end.x} ${arrow.end.y}`}
                                        fill="none"
                                        stroke={arrow.color}
                                        strokeWidth={arrow.size}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ pointerEvents: 'none' }}
                                    />
                                    {/* Arrowhead (rounded, FigJam/tldraw style) */}
                                    <path
                                        d={arrowheadD}
                                        fill="none"
                                        stroke={arrow.color}
                                        strokeWidth={arrow.size}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ pointerEvents: 'none' }}
                                    />

                                    {/* Drag handles (visible when selected) */}
                                    {selectedArrowId === arrow.id && (tool === 'select' || tool === 'arrow') && (
                                        <>
                                            {/* Dashed lines from handles to curve for visual clarity */}
                                            <line
                                                x1={arrow.start.x} y1={arrow.start.y}
                                                x2={arrow.control.x} y2={arrow.control.y}
                                                stroke="#3b82f6"
                                                strokeWidth={1 / viewport.zoom}
                                                strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
                                                opacity={0.4}
                                                style={{ pointerEvents: 'none' }}
                                            />
                                            <line
                                                x1={arrow.control.x} y1={arrow.control.y}
                                                x2={arrow.end.x} y2={arrow.end.y}
                                                stroke="#3b82f6"
                                                strokeWidth={1 / viewport.zoom}
                                                strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
                                                opacity={0.4}
                                                style={{ pointerEvents: 'none' }}
                                            />
                                            {/* Start handle (tail) */}
                                            <circle
                                                cx={arrow.start.x}
                                                cy={arrow.start.y}
                                                r={6 / viewport.zoom}
                                                fill="white"
                                                stroke="#3b82f6"
                                                strokeWidth={2 / viewport.zoom}
                                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                                onMouseDown={(e) => handleHandleMouseDown(e, arrow.id, 'start')}
                                            />
                                            {/* Control handle (mid) */}
                                            <circle
                                                cx={arrow.control.x}
                                                cy={arrow.control.y}
                                                r={5 / viewport.zoom}
                                                fill="#3b82f6"
                                                stroke="white"
                                                strokeWidth={2 / viewport.zoom}
                                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                                onMouseDown={(e) => handleHandleMouseDown(e, arrow.id, 'control')}
                                            />
                                            {/* End handle (head) */}
                                            <circle
                                                cx={arrow.end.x}
                                                cy={arrow.end.y}
                                                r={6 / viewport.zoom}
                                                fill="white"
                                                stroke="#3b82f6"
                                                strokeWidth={2 / viewport.zoom}
                                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                                onMouseDown={(e) => handleHandleMouseDown(e, arrow.id, 'end')}
                                            />
                                        </>
                                    )}
                                </g>
                            );
                        })}

                        {/* Preview arrow while drawing */}
                        {isDrawing && drawStart && drawEnd && (() => {
                            const previewAngle = Math.atan2(drawEnd.y - drawStart.y, drawEnd.x - drawStart.x);
                            const previewHead = getArrowheadPath(drawEnd, previewAngle, 4);
                            return (
                                <>
                                    <path
                                        d={`M ${drawStart.x} ${drawStart.y} L ${drawEnd.x} ${drawEnd.y}`}
                                        fill="none"
                                        stroke="#6b7280"
                                        strokeWidth={4}
                                        strokeLinecap="round"
                                        strokeDasharray="8 4"
                                        opacity={0.6}
                                        style={{ pointerEvents: 'none' }}
                                    />
                                    <path
                                        d={previewHead}
                                        fill="none"
                                        stroke="#6b7280"
                                        strokeWidth={4}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity={0.6}
                                        style={{ pointerEvents: 'none' }}
                                    />
                                </>
                            );
                        })()}
                    </g>
                </svg>
            </div>
        </>
    );
}
