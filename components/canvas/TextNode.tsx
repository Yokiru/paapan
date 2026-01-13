"use client";

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeToolbar } from 'reactflow';
import { TextNodeData, PastelColor } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import { useTranslation } from '@/lib/i18n';

// Color variants for background
const colorVariants: Record<PastelColor, { border: string; bg: string }> = {
    'pastel-blue': { border: '#93c5fd', bg: 'rgba(219, 234, 254, 0.9)' },
    'pastel-green': { border: '#6ee7b7', bg: 'rgba(209, 250, 229, 0.9)' },
    'pastel-pink': { border: '#fda4af', bg: 'rgba(255, 228, 230, 0.9)' },
    'pastel-lavender': { border: '#c4b5fd', bg: 'rgba(237, 233, 254, 0.9)' },
};

// Font size mapping
const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-xl',
    xlarge: 'text-3xl',
};

/**
 * Text Node - Simple text block with formatting options
 */
const TextNode = memo(({ id, data, selected }: NodeProps<TextNodeData>) => {
    const { updateNodeData, spawnAIInput, getEdgesForHandle, disconnectEdge, setHighlightedEdge } = useMindStore();
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content || '');
    const [activeHandle, setActiveHandle] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];
    const hasBackground = data.hasBackground ?? false;

    // Handle color: gray when no background, themed when has background
    const handleColor = hasBackground ? theme.border : '#9ca3af';

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    // Close handle menu when clicking outside
    useEffect(() => {
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

    const handleSave = () => {
        updateNodeData(id, { content });
        setIsEditing(false);
    };

    const handleFontSizeChange = (size: TextNodeData['fontSize']) => {
        updateNodeData(id, { fontSize: size });
    };

    const handleFontWeightToggle = () => {
        updateNodeData(id, {
            fontWeight: data.fontWeight === 'bold' ? 'normal' : 'bold'
        });
    };

    const handleAlignChange = (align: TextNodeData['textAlign']) => {
        updateNodeData(id, { textAlign: align });
    };

    const handleBackgroundToggle = () => {
        updateNodeData(id, { hasBackground: !hasBackground });
    };

    // Handle menu logic
    const onHandleMouseDown = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
    }, []);

    const onHandleMouseUp = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
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

    return (
        <div
            className={`
                relative min-w-[200px] max-w-[400px] p-4 rounded-xl
                transition-all duration-200
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                ${hasBackground ? 'border-2' : 'border border-dashed border-gray-300'}
            `}
            style={{
                backgroundColor: hasBackground ? theme.bg : 'transparent',
                borderColor: hasBackground ? theme.border : undefined,
            }}
            onDoubleClick={() => setIsEditing(true)}
        >
            {/* Format Toolbar - Only visible when selected */}
            <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
                <div className="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
                    {/* Font Size */}
                    <select
                        value={data.fontSize}
                        onChange={(e) => handleFontSizeChange(e.target.value as TextNodeData['fontSize'])}
                        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white"
                    >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="xlarge">X-Large</option>
                    </select>

                    {/* Bold Toggle */}
                    <button
                        onClick={handleFontWeightToggle}
                        className={`
                            w-7 h-7 flex items-center justify-center rounded
                            ${data.fontWeight === 'bold' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}
                        `}
                        title={t.textNode.bold}
                    >
                        <span className="font-bold text-sm">B</span>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-gray-200" />

                    {/* Alignment */}
                    <button
                        onClick={() => handleAlignChange('left')}
                        className={`w-7 h-7 flex items-center justify-center rounded ${data.textAlign === 'left' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        title={t.textNode.alignLeft}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" />
                        </svg>
                    </button>
                    <button
                        onClick={() => handleAlignChange('center')}
                        className={`w-7 h-7 flex items-center justify-center rounded ${data.textAlign === 'center' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        title={t.textNode.alignCenter}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                        </svg>
                    </button>
                    <button
                        onClick={() => handleAlignChange('right')}
                        className={`w-7 h-7 flex items-center justify-center rounded ${data.textAlign === 'right' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                        title={t.textNode.alignRight}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-gray-200" />

                    {/* Background Toggle */}
                    <button
                        onClick={handleBackgroundToggle}
                        className={`w-7 h-7 flex items-center justify-center rounded ${hasBackground ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        title={t.textNode.toggleBackground}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={hasBackground ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                    </button>

                    {/* Color Picker (only when background is enabled) */}
                    {hasBackground && (
                        <div className="flex items-center gap-0.5 ml-1">
                            {(Object.keys(colorVariants) as PastelColor[]).map((color) => (
                                <button
                                    key={color}
                                    onClick={() => updateNodeData(id, { color })}
                                    className={`w-5 h-5 rounded-full border-2 transition-transform ${data.color === color ? 'scale-110 border-gray-400' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: colorVariants[color].border }}
                                    title={color}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </NodeToolbar>

            {/* Connection Handles - Interactive with menu */}
            <Handle
                type="source"
                position={Position.Top}
                id="top"
                className={`!rounded-full !border-2 !border-white ${activeHandle === 'top' ? '!w-4 !h-4' : '!w-3 !h-3'} ${!selected && !hasBackground ? '!opacity-0' : ''}`}
                style={{ backgroundColor: handleColor, boxShadow: activeHandle === 'top' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={(e) => onHandleMouseDown(e, 'top')}
                onMouseUp={(e) => onHandleMouseUp(e, 'top')}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className={`!rounded-full !border-2 !border-white ${activeHandle === 'bottom' ? '!w-4 !h-4' : '!w-3 !h-3'} ${!selected && !hasBackground ? '!opacity-0' : ''}`}
                style={{ backgroundColor: handleColor, boxShadow: activeHandle === 'bottom' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={(e) => onHandleMouseDown(e, 'bottom')}
                onMouseUp={(e) => onHandleMouseUp(e, 'bottom')}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className={`!rounded-full !border-2 !border-white ${activeHandle === 'left' ? '!w-4 !h-4' : '!w-3 !h-3'} ${!selected && !hasBackground ? '!opacity-0' : ''}`}
                style={{ backgroundColor: handleColor, boxShadow: activeHandle === 'left' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={(e) => onHandleMouseDown(e, 'left')}
                onMouseUp={(e) => onHandleMouseUp(e, 'left')}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className={`!rounded-full !border-2 !border-white ${activeHandle === 'right' ? '!w-4 !h-4' : '!w-3 !h-3'} ${!selected && !hasBackground ? '!opacity-0' : ''}`}
                style={{ backgroundColor: handleColor, boxShadow: activeHandle === 'right' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={(e) => onHandleMouseDown(e, 'right')}
                onMouseUp={(e) => onHandleMouseUp(e, 'right')}
            />

            {/* Handle Menus */}
            {activeHandle === 'top' && (
                <HandleMenu
                    position={Position.Top}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={handleColor}
                    connectedEdges={getEdgesForHandle(id, 'top')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}
            {activeHandle === 'bottom' && (
                <HandleMenu
                    position={Position.Bottom}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={handleColor}
                    connectedEdges={getEdgesForHandle(id, 'bottom')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}
            {activeHandle === 'left' && (
                <HandleMenu
                    position={Position.Left}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={handleColor}
                    connectedEdges={getEdgesForHandle(id, 'left')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}
            {activeHandle === 'right' && (
                <HandleMenu
                    position={Position.Right}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={handleColor}
                    connectedEdges={getEdgesForHandle(id, 'right')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}

            {/* Text Content - Hidden div for sizing + textarea overlay when editing */}
            <div className="relative">
                {/* This div always renders to maintain container size */}
                <div
                    className={`
                        ${fontSizeMap[data.fontSize]}
                        ${data.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                        text-gray-700 whitespace-pre-wrap
                        ${!content && !isEditing ? 'text-gray-400 italic' : ''}
                        ${isEditing ? 'invisible' : ''}
                    `}
                    style={{ textAlign: data.textAlign, minHeight: '1.5em' }}
                >
                    {content || t.textNode.doubleClickEdit}
                </div>

                {/* Textarea positioned absolutely on top when editing */}
                {isEditing && (
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setContent(data.content);
                                setIsEditing(false);
                            }
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleSave();
                            }
                            e.stopPropagation();
                        }}
                        className={`
                            nodrag absolute inset-0 w-full h-full bg-transparent outline-none resize-none
                            ${fontSizeMap[data.fontSize]}
                            ${data.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                            text-gray-700 whitespace-pre-wrap
                        `}
                        style={{ textAlign: data.textAlign }}
                        placeholder={t.textNode.placeholder}
                    />
                )}
            </div>
        </div>
    );
});

TextNode.displayName = 'TextNode';

export default TextNode;
