"use client";

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Handle, NodeProps, NodeResizeControl, Position, ResizeControlVariant } from 'reactflow';
import { Zap } from 'lucide-react';
import { ImageNodeData } from '@/types';
import { sanitizeCanvasImageSrc } from '@/lib/imageSecurity';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import { useShallow } from 'zustand/react/shallow';

const clampTextStyle = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
};

const imageCaptionTone = {
    inputBackground: 'bg-transparent',
    inputFocus: 'focus:border-blue-200 focus:bg-white/90',
    title: 'text-slate-950',
    body: 'text-slate-600',
};

const IMAGE_RESIZE_LINES = [
    { position: 'top', className: 'cursor-ns-resize', style: { top: -10, height: 20 } },
    { position: 'bottom', className: 'cursor-ns-resize', style: { bottom: -10, height: 20 } },
    { position: 'left', className: 'cursor-ew-resize', style: { left: -10, width: 20 } },
    { position: 'right', className: 'cursor-ew-resize', style: { right: -10, width: 20 } },
] as const;

const IMAGE_RESIZE_CORNERS = [
    { position: 'top-left', className: 'cursor-nwse-resize' },
    { position: 'top-right', className: 'cursor-nesw-resize' },
    { position: 'bottom-left', className: 'cursor-nesw-resize' },
    { position: 'bottom-right', className: 'cursor-nwse-resize' },
] as const;

const ImageNode = memo(({ id, data, selected, dragging }: NodeProps<ImageNodeData>) => {
    const {
        spawnAIInput,
        getEdgesForHandle,
        disconnectEdge,
        setHighlightedEdge,
        updateNodeData,
    } = useMindStore(useShallow((state) => ({
        spawnAIInput: state.spawnAIInput,
        getEdgesForHandle: state.getEdgesForHandle,
        disconnectEdge: state.disconnectEdge,
        setHighlightedEdge: state.setHighlightedEdge,
        updateNodeData: state.updateNodeData,
    })));

    const [activeHandle, setActiveHandle] = useState<string | null>(null);
    const [isExperimentSelectionChromeReady, setIsExperimentSelectionChromeReady] = useState(false);
    const [titleDraft, setTitleDraft] = useState(data.title || data.fileName || '');
    const safeImageSrc = sanitizeCanvasImageSrc(data.src);
    const borderColor = '#cbd5e1';
    const isExperimentMode = true;
    const experimentHandleClassName = '!z-40 !flex !h-[26px] !w-[26px] !items-center !justify-center !rounded-lg !border !border-zinc-200 !bg-white !shadow-[0_3px_8px_rgba(15,23,42,0.08)] experiment-node-handle hover:!shadow-[0_6px_12px_rgba(15,23,42,0.12)]';
    const classicHandleClassName = (handleId: string) => `!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === handleId ? '!w-4 !h-4' : '!w-3 !h-3'}`;
    const isExperimentHandleVisible = (_side?: 'top' | 'bottom' | 'left' | 'right') => isExperimentSelectionChromeReady;
    const getExperimentHandleClassName = (side: 'top' | 'bottom' | 'left' | 'right') => (
        `${experimentHandleClassName} ${isExperimentHandleVisible(side) ? 'experiment-node-handle-visible' : 'experiment-node-handle-hidden'} experiment-node-handle-${side}`
    );
    const renderExperimentHandleIcon = () => (
        <Zap className="pointer-events-none h-3.5 w-3.5 fill-blue-500 text-blue-500" strokeWidth={2.2} />
    );

    useEffect(() => {
        setTitleDraft(data.title || data.fileName || '');
    }, [data.fileName, data.title]);

    useEffect(() => {
        if (!isExperimentMode || !selected || dragging) {
            setIsExperimentSelectionChromeReady(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setIsExperimentSelectionChromeReady(true);
        }, 110);

        return () => {
            window.clearTimeout(timer);
        };
    }, [dragging, isExperimentMode, selected]);

    const stopCanvasDrag = useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
    }, []);

    const commitMetadata = useCallback(() => {
        const trimmedTitle = titleDraft.trim();
        const nextTitle = trimmedTitle || data.fileName || 'Untitled image';
        const titleChanged = nextTitle !== (data.title || '');

        if (!titleChanged) return;

        updateNodeData(id, {
            title: nextTitle,
        });
    }, [data.fileName, data.title, id, titleDraft, updateNodeData]);

    const onHandleMouseDown = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
    }, []);

    const onHandleMouseUp = useCallback((event: React.MouseEvent, handleId: string) => {
        event.stopPropagation();
        setActiveHandle((current) => (current === handleId ? null : handleId));
    }, []);

    const handleAskFollowUp = useCallback(() => {
        if (!activeHandle) return;
        spawnAIInput(id, activeHandle);
        setActiveHandle(null);
    }, [activeHandle, id, spawnAIInput]);

    const closeHandleMenu = useCallback(() => {
        setActiveHandle(null);
    }, []);

    useEffect(() => {
        if (!activeHandle) return;

        const handleGlobalClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('.handle-menu')) return;
            setActiveHandle(null);
        };

        const timer = window.setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [activeHandle]);

    return (
        <div
            className={`
                group relative h-full w-full rounded-[30px]
                transition-all duration-300 ease-out
                ${selected && !isExperimentMode ? 'ring-4 ring-blue-400/45' : ''}
                ${!selected ? 'hover:ring-2 hover:ring-blue-200/80' : ''}
            `}
            >
            {selected && (
                <>
                    {IMAGE_RESIZE_LINES.map((control) => (
                        <NodeResizeControl
                            key={control.position}
                            position={control.position}
                            variant={ResizeControlVariant.Line}
                            minWidth={240}
                            minHeight={260}
                            keepAspectRatio={false}
                            className={control.className}
                            style={{
                                borderColor: 'transparent',
                                background: 'transparent',
                                zIndex: 36,
                                ...control.style,
                            }}
                        />
                    ))}
                    {IMAGE_RESIZE_CORNERS.map((control) => (
                        <NodeResizeControl
                            key={control.position}
                            position={control.position}
                            variant={ResizeControlVariant.Handle}
                            minWidth={240}
                            minHeight={260}
                            keepAspectRatio={false}
                            className={`${control.className} nodrag`}
                            style={{
                                width: 22,
                                height: 22,
                                border: 'none',
                                background: 'transparent',
                                zIndex: 52,
                            }}
                        />
                    ))}
                </>
            )}
            {selected && isExperimentMode && isExperimentSelectionChromeReady && (
                <div className="pointer-events-none absolute inset-0 z-30 rounded-[30px] border-2 border-blue-400 animate-[experimentSelectIn_340ms_cubic-bezier(0.16,1,0.3,1)_both]" />
            )}

            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Top}
                    id="top"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('top') : classicHandleClassName('top')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : borderColor,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'top' ? `0 0 8px ${borderColor}` : 'none',
                        opacity: isExperimentMode ? (isExperimentHandleVisible('top') && activeHandle !== 'top' ? 1 : 0) : 1,
                        pointerEvents: isExperimentMode ? (isExperimentHandleVisible('top') && activeHandle !== 'top' ? 'auto' : 'none') : 'auto',
                        ...(isExperimentMode ? { top: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(event) => onHandleMouseDown(event)}
                    onMouseUp={(event) => onHandleMouseUp(event, 'top')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('bottom') : classicHandleClassName('bottom')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : borderColor,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'bottom' ? `0 0 8px ${borderColor}` : 'none',
                        opacity: isExperimentMode ? (isExperimentHandleVisible('bottom') && activeHandle !== 'bottom' ? 1 : 0) : 1,
                        pointerEvents: isExperimentMode ? (isExperimentHandleVisible('bottom') && activeHandle !== 'bottom' ? 'auto' : 'none') : 'auto',
                        ...(isExperimentMode ? { bottom: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(event) => onHandleMouseDown(event)}
                    onMouseUp={(event) => onHandleMouseUp(event, 'bottom')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Left}
                    id="left"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('left') : classicHandleClassName('left')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : borderColor,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'left' ? `0 0 8px ${borderColor}` : 'none',
                        opacity: isExperimentMode ? (isExperimentHandleVisible('left') && activeHandle !== 'left' ? 1 : 0) : 1,
                        pointerEvents: isExperimentMode ? (isExperimentHandleVisible('left') && activeHandle !== 'left' ? 'auto' : 'none') : 'auto',
                        ...(isExperimentMode ? { left: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(event) => onHandleMouseDown(event)}
                    onMouseUp={(event) => onHandleMouseUp(event, 'left')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('right') : classicHandleClassName('right')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : borderColor,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'right' ? `0 0 8px ${borderColor}` : 'none',
                        opacity: isExperimentMode ? (isExperimentHandleVisible('right') && activeHandle !== 'right' ? 1 : 0) : 1,
                        pointerEvents: isExperimentMode ? (isExperimentHandleVisible('right') && activeHandle !== 'right' ? 'auto' : 'none') : 'auto',
                        ...(isExperimentMode ? { right: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(event) => onHandleMouseDown(event)}
                    onMouseUp={(event) => onHandleMouseUp(event, 'right')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {activeHandle === 'top' && (
                <HandleMenu
                    position={Position.Top}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={borderColor}
                    connectedEdges={getEdgesForHandle(id, 'top')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                    variant={isExperimentMode ? 'experiment' : 'default'}
                />
            )}
            {activeHandle === 'bottom' && (
                <HandleMenu
                    position={Position.Bottom}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={borderColor}
                    connectedEdges={getEdgesForHandle(id, 'bottom')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                    variant={isExperimentMode ? 'experiment' : 'default'}
                />
            )}
            {activeHandle === 'left' && (
                <HandleMenu
                    position={Position.Left}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={borderColor}
                    connectedEdges={getEdgesForHandle(id, 'left')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                    variant={isExperimentMode ? 'experiment' : 'default'}
                />
            )}
            {activeHandle === 'right' && (
                <HandleMenu
                    position={Position.Right}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={borderColor}
                    connectedEdges={getEdgesForHandle(id, 'right')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                    variant={isExperimentMode ? 'experiment' : 'default'}
                />
            )}

            <div
                className={`
                    flex h-full w-full flex-col rounded-[30px] border border-white/90 bg-white p-3
                    shadow-[0_18px_48px_rgba(148,163,184,0.18),0_2px_10px_rgba(15,23,42,0.05)]
                    transition-shadow duration-300
                    ${selected ? 'shadow-[0_24px_52px_rgba(148,163,184,0.22),0_6px_18px_rgba(15,23,42,0.08)]' : ''}
                `}
            >
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] border border-slate-100 bg-white">
                    {data.isUploading ? (
                        <div className="flex h-full w-full select-none items-center justify-center text-slate-500">
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                                <div className="h-10 w-10 rounded-full bg-slate-300" />
                                <span className="text-sm font-medium">Uploading image...</span>
                            </div>
                        </div>
                    ) : !safeImageSrc ? (
                        <div className="flex h-full w-full select-none items-center justify-center px-6 text-center text-sm font-medium text-slate-500">
                            Gambar tidak aman atau tidak didukung.
                        </div>
                    ) : (
                        <img
                            src={safeImageSrc}
                            alt={data.title || data.fileName || 'Canvas image'}
                            className="block h-full w-full select-none object-cover"
                            draggable={false}
                        />
                    )}
                </div>

                <div
                    className="nodrag mt-2 px-2 pb-1 pt-0.5"
                    onMouseDown={stopCanvasDrag}
                    onClick={stopCanvasDrag}
                >
                    <div className="min-h-[28px] pt-0.5">
                        <input
                            value={titleDraft}
                            readOnly={!selected}
                            tabIndex={selected ? 0 : -1}
                            onChange={(event) => {
                                if (!selected) return;
                                setTitleDraft(event.target.value);
                            }}
                            onBlur={commitMetadata}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    commitMetadata();
                                    (event.currentTarget as HTMLInputElement).blur();
                                }
                            }}
                            placeholder="Nama gambar"
                            className={`nodrag w-full rounded-md border border-transparent px-0 py-0 text-sm font-semibold leading-5 ${imageCaptionTone.title} outline-none transition-colors ${imageCaptionTone.inputBackground} ${selected ? imageCaptionTone.inputFocus : ''} ${selected ? 'cursor-text' : 'cursor-default pointer-events-none'}`}
                            style={{ ...clampTextStyle, WebkitLineClamp: 1 }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => (
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data.src === nextProps.data.src &&
    prevProps.data.title === nextProps.data.title &&
    prevProps.data.description === nextProps.data.description &&
    prevProps.data.fileName === nextProps.data.fileName &&
    prevProps.data.isUploading === nextProps.data.isUploading &&
    prevProps.data.width === nextProps.data.width &&
    prevProps.data.height === nextProps.data.height
));

ImageNode.displayName = 'ImageNode';

export default ImageNode;
