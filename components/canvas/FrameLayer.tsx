"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { Position, useStore } from 'reactflow';
import { AIInputNodeData, CanvasNodeType, DisconnectMenuItem, FrameRegion, MindNodeData } from '@/types';
import HandleMenu from './HandleMenu';

interface FrameLayerProps {
    frames: FrameRegion[];
    linkedNodes: CanvasNodeType[];
    selectedNodeIds: string[];
    selectedFrameId: string | null;
    draftFrame: Omit<FrameRegion, 'id' | 'createdAt' | 'updatedAt'> | null;
    onSelectFrame: (frameId: string) => void;
    onStartMoveFrame: (frameId: string, clientX: number, clientY: number) => void;
    onSpawnAIInput: (frameId: string, position?: { x: number; y: number }) => void;
    onAttachFrameToNode: (frameId: string, nodeId: string) => boolean;
    onDisconnectFrameLink: (frameId: string, nodeId: string) => boolean;
    screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
}

function FrameLayer({
    frames,
    linkedNodes,
    selectedNodeIds,
    selectedFrameId,
    draftFrame,
    onSelectFrame,
    onStartMoveFrame,
    onSpawnAIInput,
    onAttachFrameToNode,
    onDisconnectFrameLink,
    screenToFlowPosition,
}: FrameLayerProps) {
    const domNode = useStore((state: { domNode?: HTMLDivElement | null }) => state.domNode ?? null);
    const portalTarget = React.useMemo(
        () => (domNode?.querySelector('.react-flow__viewport') as HTMLElement | null) ?? null,
        [domNode]
    );
    const [activeHandleFrameId, setActiveHandleFrameId] = React.useState<string | null>(null);
    const [highlightedLinkId, setHighlightedLinkId] = React.useState<string | null>(null);
    const handleDragRef = React.useRef<{
        frameId: string;
        startClient: { x: number; y: number };
        currentClient: { x: number; y: number };
        moved: boolean;
    } | null>(null);
    const selectedNodeIdSet = React.useMemo(
        () => new Set(selectedNodeIds),
        [selectedNodeIds]
    );
    const [handleDrag, setHandleDrag] = React.useState<{
        frameId: string;
        startClient: { x: number; y: number };
        currentClient: { x: number; y: number };
        moved: boolean;
    } | null>(null);
    const isHandleDragging = handleDrag !== null;
    const frameMap = React.useMemo(() => new Map(frames.map((frame) => [frame.id, frame])), [frames]);
    const frameLinks = React.useMemo(() => (
        linkedNodes
            .map((node) => {
                const frameId = node.type === 'aiInput'
                    ? (node.data as AIInputNodeData).contextFrameId
                    : node.type === 'mindNode'
                        ? (node.data as MindNodeData).sourceFrameId
                        : undefined;

                if (!frameId) return null;

                const frame = frameMap.get(frameId);
                if (!frame) return null;

                const nodeWidth = typeof node.width === 'number'
                    ? node.width
                    : node.type === 'aiInput'
                        ? 380
                        : 350;

                const startX = frame.x + frame.width / 2;
                const startY = frame.y + frame.height;
                const endX = node.position.x + nodeWidth / 2;
                const endY = node.position.y;
                const midY = startY + Math.max((endY - startY) * 0.45, 26);
                const nodeLabel = node.type === 'mindNode'
                    ? (node.data as MindNodeData).question || 'AI chat'
                    : (node.data as AIInputNodeData).inputValue?.trim() || 'AI input';

                return {
                    id: `${frame.id}-${node.id}`,
                    frameId: frame.id,
                    nodeId: node.id,
                    label: `Garis ke ${nodeLabel}`,
                    path: `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`,
                };
            })
            .filter((link): link is { id: string; frameId: string; nodeId: string; label: string; path: string } => Boolean(link))
    ), [frameMap, linkedNodes]);
    const frameLinksByFrame = React.useMemo(() => {
        const grouped = new Map<string, typeof frameLinks>();

        frameLinks.forEach((link) => {
            const current = grouped.get(link.frameId);
            if (current) {
                current.push(link);
            } else {
                grouped.set(link.frameId, [link]);
            }
        });

        return grouped;
    }, [frameLinks]);

    React.useEffect(() => {
        handleDragRef.current = handleDrag;
    }, [handleDrag]);

    React.useEffect(() => {
        if (!isHandleDragging) return;

        const handleMouseMove = (event: MouseEvent) => {
            setHandleDrag((current) => {
                if (!current) return null;

                const dx = event.clientX - current.startClient.x;
                const dy = event.clientY - current.startClient.y;

                return {
                    ...current,
                    currentClient: { x: event.clientX, y: event.clientY },
                    moved: current.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5,
                };
            });
        };

        const handleMouseUp = (event: MouseEvent) => {
            const currentDrag = handleDragRef.current;
            if (!currentDrag) {
                setHandleDrag(null);
                return;
            }

            if (currentDrag.moved) {
                const dropTarget = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
                const nodeElement = dropTarget?.closest('.react-flow__node[data-id]') as HTMLElement | null;
                const targetNodeId = nodeElement?.dataset.id;

                if (targetNodeId) {
                    onAttachFrameToNode(currentDrag.frameId, targetNodeId);
                }
                setActiveHandleFrameId(null);
            } else {
                setActiveHandleFrameId((previous) => previous === currentDrag.frameId ? null : currentDrag.frameId);
            }

            setHandleDrag(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isHandleDragging, onAttachFrameToNode]);

    React.useEffect(() => {
        if (!activeHandleFrameId) return;

        const handleGlobalClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('.handle-menu') || target.closest('[data-frame-handle-dot="true"]')) return;
            setActiveHandleFrameId(null);
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [activeHandleFrameId]);

    const handleDisconnectLink = React.useCallback((itemId: string) => {
        const link = frameLinks.find((entry) => entry.id === itemId);
        if (!link) return;

        onDisconnectFrameLink(link.frameId, link.nodeId);
        setHighlightedLinkId(null);
    }, [frameLinks, onDisconnectFrameLink]);

    if (!portalTarget?.isConnected) {
        return null;
    }

    return createPortal(
        <div className="absolute left-0 top-0 z-[15] overflow-visible pointer-events-none">
                <svg className="absolute left-0 top-0 overflow-visible pointer-events-none">
                    {frameLinks.map((link) => (
                        <path
                            key={link.id}
                            d={link.path}
                            className={
                                highlightedLinkId === link.id
                                    ? 'frame-link-highlighted'
                                    : selectedFrameId === link.frameId || selectedNodeIdSet.has(link.nodeId)
                                        ? 'frame-link-animated'
                                        : 'frame-link-path'
                            }
                            fill="none"
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                        />
                    ))}
                    {handleDrag?.moved && (() => {
                        const frame = frameMap.get(handleDrag.frameId);
                        if (!frame) return null;

                        const end = screenToFlowPosition(handleDrag.currentClient);
                        const startX = frame.x + frame.width / 2;
                        const startY = frame.y + frame.height;
                        const midY = startY + Math.max((end.y - startY) * 0.45, 26);

                        return (
                            <path
                                d={`M ${startX} ${startY} C ${startX} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`}
                                fill="none"
                                stroke="#3B82F6"
                                strokeWidth="2.5"
                                strokeDasharray="6 4"
                                strokeLinecap="round"
                            />
                        );
                    })()}
                </svg>

                {frames.map((frame) => {
                    const isSelected = frame.id === selectedFrameId;
                    const strokeWidth = isSelected ? 4 : 3;
                    const inset = strokeWidth / 2;
                    const disconnectItems: DisconnectMenuItem[] = (frameLinksByFrame.get(frame.id) || [])
                        .map((link) => ({
                            id: link.id,
                            label: link.label,
                        }));

                    return (
                        <React.Fragment key={frame.id}>
                            <div
                                className="absolute rounded-2xl pointer-events-none overflow-visible"
                                style={{
                                    left: frame.x,
                                    top: frame.y,
                                    width: frame.width,
                                    height: frame.height,
                                    boxShadow: isSelected ? '0 0 0 1px rgba(147, 197, 253, 0.9)' : 'none',
                                }}
                            >
                                <div className="absolute inset-0 rounded-2xl bg-blue-400/10 pointer-events-none" />
                                <svg
                                    className="absolute inset-0 h-full w-full pointer-events-none"
                                    viewBox={`0 0 ${frame.width} ${frame.height}`}
                                    preserveAspectRatio="none"
                                >
                                    <rect
                                        className={isSelected ? 'frame-border-selected' : undefined}
                                        x={inset}
                                        y={inset}
                                        width={Math.max(frame.width - strokeWidth, 0)}
                                        height={Math.max(frame.height - strokeWidth, 0)}
                                        rx="16"
                                        fill="none"
                                        stroke={isSelected ? '#2563EB' : 'rgba(37, 99, 235, 0.82)'}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray="12 8"
                                        strokeLinecap="round"
                                    />
                                </svg>

                                <button
                                    type="button"
                                    data-frame-element="true"
                                    className="absolute left-3 right-3 -top-2 h-4 pointer-events-auto cursor-move"
                                    onMouseDown={(event) => {
                                        event.stopPropagation();
                                        onSelectFrame(frame.id);
                                        onStartMoveFrame(frame.id, event.clientX, event.clientY);
                                    }}
                                    aria-label="Move frame from top border"
                                />
                                <button
                                    type="button"
                                    data-frame-element="true"
                                    className="absolute left-3 right-3 -bottom-2 h-4 pointer-events-auto cursor-move"
                                    onMouseDown={(event) => {
                                        event.stopPropagation();
                                        onSelectFrame(frame.id);
                                        onStartMoveFrame(frame.id, event.clientX, event.clientY);
                                    }}
                                    aria-label="Move frame from bottom border"
                                />
                                <button
                                    type="button"
                                    data-frame-element="true"
                                    className="absolute -left-2 top-3 bottom-3 w-4 pointer-events-auto cursor-move"
                                    onMouseDown={(event) => {
                                        event.stopPropagation();
                                        onSelectFrame(frame.id);
                                        onStartMoveFrame(frame.id, event.clientX, event.clientY);
                                    }}
                                    aria-label="Move frame from left border"
                                />
                                <button
                                    type="button"
                                    data-frame-element="true"
                                    className="absolute -right-2 top-3 bottom-3 w-4 pointer-events-auto cursor-move"
                                    onMouseDown={(event) => {
                                        event.stopPropagation();
                                        onSelectFrame(frame.id);
                                        onStartMoveFrame(frame.id, event.clientX, event.clientY);
                                    }}
                                    aria-label="Move frame from right border"
                                />
                            </div>

                            {isSelected && (
                                <>
                                    <button
                                        type="button"
                                        data-frame-element="true"
                                        data-frame-handle-dot="true"
                                        className="absolute pointer-events-auto flex items-center justify-center rounded-full bg-blue-400 border-2 border-white shadow-md hover:scale-105 transition-transform cursor-crosshair"
                                        style={{
                                            left: frame.x + frame.width / 2 - 9,
                                            top: frame.y + frame.height - 9,
                                            width: 18,
                                            height: 18,
                                        }}
                                        onMouseDown={(event) => {
                                            event.stopPropagation();
                                            setHandleDrag({
                                                frameId: frame.id,
                                                startClient: { x: event.clientX, y: event.clientY },
                                                currentClient: { x: event.clientX, y: event.clientY },
                                                moved: false,
                                            });
                                        }}
                                        aria-label="Ask AI about this frame"
                                    />
                                    {activeHandleFrameId === frame.id && (
                                        <div
                                            className="absolute handle-menu-container"
                                            style={{
                                                left: frame.x + frame.width / 2,
                                                top: frame.y + frame.height + 18,
                                                transform: 'translateX(-50%)',
                                                zIndex: 120,
                                                pointerEvents: 'auto',
                                            }}
                                        >
                                            <HandleMenu
                                                position={Position.Bottom}
                                                onAskFollowUp={() => {
                                                    onSpawnAIInput(frame.id);
                                                    setActiveHandleFrameId(null);
                                                }}
                                                onClose={() => setActiveHandleFrameId(null)}
                                                borderColor="#2563EB"
                                                disconnectItems={disconnectItems}
                                                onDisconnect={handleDisconnectLink}
                                                onDisconnectItemHover={setHighlightedLinkId}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </React.Fragment>
                    );
                })}

                {draftFrame && (
                    <div
                        className="absolute rounded-2xl bg-blue-400/10 overflow-hidden"
                        style={{
                            left: draftFrame.x,
                            top: draftFrame.y,
                            width: draftFrame.width,
                            height: draftFrame.height,
                        }}
                    >
                        <svg
                            className="absolute inset-0 h-full w-full pointer-events-none"
                            viewBox={`0 0 ${draftFrame.width} ${draftFrame.height}`}
                            preserveAspectRatio="none"
                        >
                            <rect
                                x="1.5"
                                y="1.5"
                                width={Math.max(draftFrame.width - 3, 0)}
                                height={Math.max(draftFrame.height - 3, 0)}
                                rx="16"
                                fill="none"
                                stroke="#2563EB"
                                strokeWidth="3"
                                strokeDasharray="12 8"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                )}
        </div>,
        portalTarget
    );
}

export default React.memo(FrameLayer);
