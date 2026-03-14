"use client";

import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';
import { ImageNodeData } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';

const ImageNode = memo(({ id, data, selected }: NodeProps<ImageNodeData>) => {
    const { spawnAIInput, getEdgesForHandle, disconnectEdge, setHighlightedEdge } = useMindStore();
    const [activeHandle, setActiveHandle] = useState<string | null>(null);

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
                transition-all duration-300 ease-out
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
            <img
                src={data.src}
                alt={data.fileName || 'Canvas Image'}
                className="block w-full h-full object-cover pointer-events-none select-none rounded-2xl"
            />
        </div>
    );
});

ImageNode.displayName = 'ImageNode';

export default ImageNode;
