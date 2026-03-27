"use client";

import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { ImageNodeData } from '@/types';
import { sanitizeCanvasImageSrc } from '@/lib/imageSecurity';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import { useShallow } from 'zustand/react/shallow';

const ImageNode = memo(({ id, data, selected }: NodeProps<ImageNodeData>) => {
    const { spawnAIInput, getEdgesForHandle, disconnectEdge, setHighlightedEdge } = useMindStore(useShallow(state => ({ spawnAIInput: state.spawnAIInput, getEdgesForHandle: state.getEdgesForHandle, disconnectEdge: state.disconnectEdge, setHighlightedEdge: state.setHighlightedEdge })));
    const [activeHandle, setActiveHandle] = useState<string | null>(null);
    const safeImageSrc = sanitizeCanvasImageSrc(data.src);

    // Handle click - show bubble menu
    const onHandleMouseDown = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
    }, []);

    const onHandleMouseUp = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
        // Toggle menu on click
        if (activeHandle === handleId) {
            setActiveHandle(null);
        } else {
            setActiveHandle(handleId);
        }
    }, [activeHandle]);

    const handleAskFollowUp = useCallback(() => {
        if (activeHandle) {
            spawnAIInput(id, activeHandle);
            setActiveHandle(null);
        }
    }, [id, activeHandle, spawnAIInput]);

    const closeHandleMenu = useCallback(() => {
        setActiveHandle(null);
    }, []);

    // Close menu when clicking outside
    React.useEffect(() => {
        if (!activeHandle) return;

        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.handle-menu')) return;
            setActiveHandle(null);
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [activeHandle]);

    const borderColor = '#cbd5e1'; // Slate-300

    return (
        <div
            className={`
                relative group rounded-2xl w-full h-full
                ${selected ? 'ring-4 ring-blue-400/50' : 'hover:ring-2 hover:ring-blue-200'}
            `}
        >
            <NodeResizer
                isVisible={selected}
                minWidth={100}
                minHeight={100}
                keepAspectRatio={true}
                lineClassName="border-blue-400"
                handleClassName="h-3 w-3 bg-white border-2 border-blue-400 rounded-full"
            />

            {/* BOTTOM Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                isConnectable={true}
                className={`!rounded-full !border-2 !border-white ${activeHandle === 'bottom' ? '!w-4 !h-4' : '!w-3 !h-3'}`}
                style={{
                    backgroundColor: borderColor,
                    boxShadow: activeHandle === 'bottom' ? `0 0 8px ${borderColor}` : 'none',
                    bottom: '-6px',
                    zIndex: 10
                }}
                onMouseDown={(e) => onHandleMouseDown(e, 'bottom')}
                onMouseUp={(e) => onHandleMouseUp(e, 'bottom')}
            />

            {/* Handle Menu - same as MindNode */}
            {activeHandle === 'bottom' && (
                <HandleMenu
                    position={Position.Bottom}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={borderColor}
                    connectedEdges={getEdgesForHandle(id, 'bottom')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}

            {/* Image Content */}
            {data.isUploading ? (
                <div className="flex h-full w-full select-none items-center justify-center rounded-2xl bg-slate-200/90 text-slate-500 pointer-events-none">
                    <div className="flex flex-col items-center gap-2 animate-pulse">
                        <div className="h-9 w-9 rounded-full bg-slate-300" />
                        <span className="text-sm font-medium">Uploading image...</span>
                    </div>
                </div>
            ) : !safeImageSrc ? (
                <div className="flex h-full w-full select-none items-center justify-center rounded-2xl bg-slate-100 text-slate-500 pointer-events-none">
                    <div className="px-4 text-center text-sm font-medium">Gambar tidak aman atau tidak didukung.</div>
                </div>
            ) : (
                <img
                    src={safeImageSrc}
                    alt={data.fileName || 'Canvas Image'}
                    className="block w-full h-full object-cover pointer-events-none select-none rounded-2xl"
                />
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Prevent re-rendering big image purely from drag position changes
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.data.src === nextProps.data.src &&
        prevProps.data.isUploading === nextProps.data.isUploading &&
        prevProps.data.width === nextProps.data.width &&
        prevProps.data.height === nextProps.data.height &&
        prevProps.dragging === nextProps.dragging
    );
});

ImageNode.displayName = 'ImageNode';

export default ImageNode;
