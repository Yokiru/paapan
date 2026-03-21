"use client";

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeToolbar, NodeResizer, useStore } from 'reactflow';
import { TextNodeData, PastelColor } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import { useTranslation } from '@/lib/i18n';
import TextSelectionToolbar from './TextSelectionToolbar';
import {
    applyTextHighlights,
    clearTextSelection,
    getTextSelectionSnapshot,
    selectAllTextInElement,
    upsertTextHighlight,
    type TextSelectionSnapshot,
} from '@/lib/textHighlights';

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

type TextNodeProps = NodeProps<TextNodeData> & { width?: number; height?: number };
type TextNodeStoreShape = {
    nodeInternals: Map<string, { style?: { width?: number | string; height?: number | string } }>;
};

/**
 * Text Node - Simple text block with formatting options
 */
const TextNode = memo(({ id, data, selected }: TextNodeProps) => {
    const { updateNodeData, spawnAIInput, getEdgesForHandle, disconnectEdge, setHighlightedEdge } = useMindStore();
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content || '');
    const [activeHandle, setActiveHandle] = useState<string | null>(null);
    const [textSelection, setTextSelection] = useState<TextSelectionSnapshot | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const displayContentRef = useRef<HTMLDivElement>(null);

    const hasExplicitWidth = useStore(useCallback((s: TextNodeStoreShape) => {
        const node = s.nodeInternals.get(id);
        return !!(node?.style?.width || node?.style?.height);
    }, [id]));

    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];
    const hasBackground = data.hasBackground ?? false;
    const visibleActiveHandle = selected ? activeHandle : null;

    // Handle color: gray when no background, themed when has background
    const handleColor = hasBackground ? theme.border : '#9ca3af';

    const closeTextSelectionToolbar = useCallback(() => {
        setTextSelection(null);
    }, []);
    const isTextSelectionToolbarVisible = !!textSelection && selected;

    const getToolbarPosition = useCallback((selection: TextSelectionSnapshot) => {
        const padding = 24;
        const left = selection.rect.left + (selection.rect.width / 2);

        return {
            top: Math.max(selection.rect.top - 14, 56),
            left: Math.min(Math.max(left, 180), window.innerWidth - 180 - padding),
        };
    }, []);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isEditing) return;

        if (displayContentRef.current) {
            applyTextHighlights(displayContentRef.current, data.highlights);
        }
    }, [data.content, data.highlights, isEditing]);

    useEffect(() => {
        if (!isTextSelectionToolbarVisible) return;

        const handleGlobalPointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-highlight-toolbar-ignore="true"]')) return;
            if (displayContentRef.current?.contains(target)) return;
            if (textareaRef.current?.contains(target)) return;
            closeTextSelectionToolbar();
        };

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                closeTextSelectionToolbar();
            }
        };

        const handleViewportChange = () => {
            closeTextSelectionToolbar();
        };

        document.addEventListener('mousedown', handleGlobalPointerDown);
        document.addEventListener('selectionchange', handleSelectionChange);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            document.removeEventListener('mousedown', handleGlobalPointerDown);
            document.removeEventListener('selectionchange', handleSelectionChange);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [closeTextSelectionToolbar, isTextSelectionToolbarVisible]);

    // Close handle menu when clicking outside
    useEffect(() => {
        if (!visibleActiveHandle) return;

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
    }, [visibleActiveHandle]);

    const handleSave = () => {
        updateNodeData(id, {
            content,
            highlights: content === data.content ? data.highlights : [],
        });
        setIsEditing(false);
        closeTextSelectionToolbar();
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
    const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    const onHandleMouseUp = useCallback((e: React.MouseEvent, handleId: string) => {
        e.stopPropagation();
        if (visibleActiveHandle === handleId) {
            setActiveHandle(null);
        } else {
            setActiveHandle(handleId);
        }
    }, [visibleActiveHandle]);

    const handleAskFollowUp = useCallback(() => {
        if (visibleActiveHandle) {
            spawnAIInput(id, visibleActiveHandle);
            setActiveHandle(null);
        }
    }, [id, visibleActiveHandle, spawnAIInput]);

    const closeHandleMenu = useCallback(() => {
        setActiveHandle(null);
    }, []);

    const getHandleClassName = useCallback((handleId: string) => (
        `!rounded-full !border-2 !border-white ${visibleActiveHandle === handleId ? '!w-4 !h-4' : '!w-3 !h-3'} ${selected ? '' : '!opacity-0 !pointer-events-none'}`
    ), [visibleActiveHandle, selected]);

    const handleContentContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (isEditing || !displayContentRef.current) return;

        const selection = getTextSelectionSnapshot(displayContentRef.current);
        if (!selection) return;

        event.preventDefault();
        event.stopPropagation();
        setTextSelection(selection);
    }, [isEditing]);

    const handleHighlightSelection = useCallback((color: PastelColor) => {
        if (!textSelection) return;

        const nextHighlights = upsertTextHighlight(data.highlights, {
            start: textSelection.start,
            end: textSelection.end,
            color,
        });

        updateNodeData(id, {
            ...(isEditing ? { content } : {}),
            highlights: nextHighlights,
        });

        if (isEditing) {
            setIsEditing(false);
        }

        clearTextSelection();
        closeTextSelectionToolbar();
    }, [closeTextSelectionToolbar, content, data.highlights, id, isEditing, textSelection, updateNodeData]);

    const handleCopySelection = useCallback(async () => {
        if (!textSelection?.text) return;

        await navigator.clipboard.writeText(textSelection.text);
        closeTextSelectionToolbar();
    }, [closeTextSelectionToolbar, textSelection]);

    const handleSelectAllText = useCallback(() => {
        if (isEditing && textareaRef.current) {
            const textarea = textareaRef.current;
            textarea.focus();
            textarea.setSelectionRange(0, textarea.value.length);
            const rect = textarea.getBoundingClientRect();

            setTextSelection({
                start: 0,
                end: textarea.value.length,
                text: textarea.value,
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                },
            });
            return;
        }

        if (!displayContentRef.current) return;

        const selection = selectAllTextInElement(displayContentRef.current);
        if (!selection) return;

        setTextSelection(selection);
    }, [isEditing]);

    const handleNodeClick = useCallback(() => {
        if (isEditing) return;
        closeTextSelectionToolbar();
    }, [closeTextSelectionToolbar, isEditing]);

    const handleNodeDoubleClick = useCallback(() => {
        closeTextSelectionToolbar();
        setContent(data.content || '');
        setIsEditing(true);
    }, [closeTextSelectionToolbar, data.content]);

    const handleTextareaContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const selectedText = textarea.value.slice(start, end);

        if (!selectedText.trim() || start === end) return;

        const rect = textarea.getBoundingClientRect();

        event.preventDefault();
        event.stopPropagation();
        setTextSelection({
            start,
            end,
            text: selectedText,
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            },
        });
    }, []);

    return (
        <>
            <NodeResizer 
                color={handleColor} 
                isVisible={selected} 
                minWidth={200}
                minHeight={100}
                handleStyle={{ zIndex: 30, width: 14, height: 14, borderRadius: 7, border: '2px solid white', backgroundColor: handleColor }}
                lineStyle={{ borderWidth: 2, borderColor: handleColor }}
            />
            <div
                className={`
                    relative flex w-full h-full flex-col rounded-xl p-4
                    ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                    ${hasBackground ? 'border-2' : 'border border-dashed border-gray-300'}
                    ${hasExplicitWidth ? '' : 'max-w-[400px]'}
                `}
                style={{
                    backgroundColor: hasBackground ? theme.bg : 'transparent',
                    borderColor: hasBackground ? theme.border : undefined,
                    minWidth: '200px',
                }}
                onClick={handleNodeClick}
                onDoubleClick={handleNodeDoubleClick}
            >
            <TextSelectionToolbar
                visible={isTextSelectionToolbarVisible}
                position={textSelection ? getToolbarPosition(textSelection) : { top: 0, left: 0 }}
                onHighlight={handleHighlightSelection}
                onCopy={handleCopySelection}
                onSelectAll={handleSelectAllText}
            />
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
                className={getHandleClassName('top')}
                style={{ backgroundColor: handleColor, boxShadow: visibleActiveHandle === 'top' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={onHandleMouseDown}
                onMouseUp={(e) => onHandleMouseUp(e, 'top')}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className={getHandleClassName('bottom')}
                style={{ backgroundColor: handleColor, boxShadow: visibleActiveHandle === 'bottom' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={onHandleMouseDown}
                onMouseUp={(e) => onHandleMouseUp(e, 'bottom')}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className={getHandleClassName('left')}
                style={{ backgroundColor: handleColor, boxShadow: visibleActiveHandle === 'left' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={onHandleMouseDown}
                onMouseUp={(e) => onHandleMouseUp(e, 'left')}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                className={getHandleClassName('right')}
                style={{ backgroundColor: handleColor, boxShadow: visibleActiveHandle === 'right' ? `0 0 8px ${handleColor}` : 'none' }}
                onMouseDown={onHandleMouseDown}
                onMouseUp={(e) => onHandleMouseUp(e, 'right')}
            />

            {/* Handle Menus */}
            {visibleActiveHandle === 'top' && (
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
            {visibleActiveHandle === 'bottom' && (
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
            {visibleActiveHandle === 'left' && (
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
            {visibleActiveHandle === 'right' && (
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
            <div
                className={`relative scrollbar-transparent ${hasExplicitWidth ? 'min-h-0 flex-1' : ''}`}
                style={{
                    maxHeight: hasExplicitWidth ? undefined : '300px',
                    overflowY: isEditing ? 'hidden' : 'auto',
                    overflowX: 'hidden',
                }}
            >
                {/* This div always renders to maintain container size */}
                <div
                    className={`
                        ${fontSizeMap[data.fontSize]}
                        ${data.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                        ${selected ? 'nodrag select-text cursor-text' : 'select-none cursor-default'}
                        text-gray-700 whitespace-pre-wrap
                        ${!data.content && !isEditing ? 'text-gray-400 italic' : ''}
                        ${isEditing ? 'invisible' : ''}
                    `}
                    style={{ textAlign: data.textAlign, minHeight: '1.5em', wordBreak: 'break-word' }}
                    ref={displayContentRef}
                    onContextMenu={handleContentContextMenu}
                >
                    {data.content || t.textNode.doubleClickEdit}
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
                                closeTextSelectionToolbar();
                            }
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleSave();
                            }
                            e.stopPropagation();
                        }}
                        onContextMenu={handleTextareaContextMenu}
                        className={`
                            nodrag absolute inset-0 w-full h-full bg-transparent outline-none resize-none
                            ${fontSizeMap[data.fontSize]}
                            ${data.fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                            text-gray-700 whitespace-pre-wrap scrollbar-transparent
                        `}
                        style={{ textAlign: data.textAlign, overflowY: 'auto', overflowX: 'hidden', wordBreak: 'break-word' }}
                        placeholder={t.textNode.placeholder}
                    />
                )}
            </div>
        </div>
        </>
    );
}, (prevProps, nextProps) => {
    // Custom equality check to prevent re-renders purely from position changes during drag
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.data.content === nextProps.data.content &&
        prevProps.data.fontSize === nextProps.data.fontSize &&
        prevProps.data.fontWeight === nextProps.data.fontWeight &&
        prevProps.data.textAlign === nextProps.data.textAlign &&
        prevProps.data.color === nextProps.data.color &&
        prevProps.data.hasBackground === nextProps.data.hasBackground &&
        prevProps.data.highlights === nextProps.data.highlights &&
        prevProps.dragging === nextProps.dragging
    );
});

TextNode.displayName = 'TextNode';

export default TextNode;
