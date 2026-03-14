"use client";

import React, { memo, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeToolbar, NodeResizer } from 'reactflow';
import { MindNodeData, PastelColor } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from '@/lib/i18n';

// Available color options for the picker (matching actual card colors)
const COLOR_OPTIONS: { key: PastelColor; swatch: string; label: string }[] = [
    { key: 'pastel-blue', swatch: 'bg-blue-200', label: 'Blue' },
    { key: 'pastel-green', swatch: 'bg-emerald-200', label: 'Green' },
    { key: 'pastel-pink', swatch: 'bg-rose-200', label: 'Rose' },
    { key: 'pastel-lavender', swatch: 'bg-violet-200', label: 'Lavender' },
];


/**
 * Custom MindNode component for the React Flow canvas
 * Renders a high-end UI card with:
 * - Colored border based on assigned pastel color
 * - Header with user question and menu icon
 * - Body for AI response
 * - Footer with editable tags
 * - Input Bubble mode for empty nodes
 * - Smart handles for spawning AI Input nodes
 */
const MindNode = memo(({ id, data, selected }: NodeProps<MindNodeData>) => {
    const { tool, updateNodeData, spawnAIInput, updateTag, addTag, removeTag, updateNodeColorWithChildren, getEdgesForHandle, disconnectEdge, setHighlightedEdge, toggleNodeCollapse, deleteNode, regenerateNode, duplicateNode, searchQuery, getMatchingNodeIds, toggleFavorite, isFavoritesFilterActive, getFavoriteNodeIds } = useMindStore();
    const { t } = useTranslation();

    // Check if this node should be blurred (search active but not matching, OR favorites filter active but not favorite)
    const isSearchActive = searchQuery.trim().length > 0;
    const matchingNodeIds = getMatchingNodeIds();
    const favoriteNodeIds = getFavoriteNodeIds();
    const isBlurredBySearch = isSearchActive && !matchingNodeIds.includes(id);
    const isBlurredByFavorites = isFavoritesFilterActive && !favoriteNodeIds.includes(id);
    const isBlurred = isBlurredBySearch || isBlurredByFavorites;


    // Local state for input value
    const [inputValue, setInputValue] = React.useState(data.question);

    // Menu state
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    // Tag editing state
    const [editingTagId, setEditingTagId] = React.useState<string | null>(null);
    const [editingTagValue, setEditingTagValue] = React.useState('');
    const [isAddingTag, setIsAddingTag] = React.useState(false);
    const [newTagValue, setNewTagValue] = React.useState('');

    // Handle menu state - tracks which handle has its action menu open
    const [activeHandle, setActiveHandle] = React.useState<string | null>(null);

    // Bubble mode editing state
    const [isBubbleEditing, setIsBubbleEditing] = React.useState(false);
    const bubbleInputRef = React.useRef<HTMLInputElement>(null);

    // Focus bubble input when entering edit mode
    React.useEffect(() => {
        if (isBubbleEditing && bubbleInputRef.current) {
            bubbleInputRef.current.focus();
        }
    }, [isBubbleEditing]);

    // Handle click - show menu
    const handleHandleClick = useCallback((handleId: string) => {
        setActiveHandle(prev => prev === handleId ? null : handleId);
    }, []);

    // Ref and handlers for smart handle interaction (moved from SmartHandle component to prevent unmounting)
    const handleStartPos = useRef<{ x: number, y: number, id: string } | null>(null);

    const onHandleMouseDown = useCallback((e: React.MouseEvent, handleId: string) => {
        handleStartPos.current = { x: e.clientX, y: e.clientY, id: handleId };
    }, []);

    const onHandleMouseUp = useCallback((e: React.MouseEvent, handleId: string) => {
        if (handleStartPos.current && handleStartPos.current.id === handleId) {
            const dx = Math.abs(e.clientX - handleStartPos.current.x);
            const dy = Math.abs(e.clientY - handleStartPos.current.y);
            // If mouse moved less than 5px, treat as click -> show menu
            if (dx < 5 && dy < 5) {
                e.stopPropagation();
                handleHandleClick(handleId);
            }
        }
        handleStartPos.current = null;
    }, [handleHandleClick]);

    // Close handle menu
    const closeHandleMenu = useCallback(() => {
        setActiveHandle(null);
    }, []);

    // Check for connected children (to decide if we show collapse toggle)
    // Subscribe to edges from the store to react to changes
    const edges = useMindStore(state => state.edges);
    const hasChildren = React.useMemo(() => {
        return edges.some(edge => edge.source === id);
    }, [edges, id]);

    // Count ALL descendants recursively (children + grandchildren + etc)
    const childrenCount = React.useMemo(() => {
        const countDescendants = (nodeId: string, visited: Set<string> = new Set()): number => {
            // Prevent infinite loops in case of circular references
            if (visited.has(nodeId)) return 0;
            visited.add(nodeId);

            // Get direct children of this node
            const directChildren = edges.filter(edge => edge.source === nodeId);

            // Count direct children + recursively count their descendants
            let total = directChildren.length;
            for (const child of directChildren) {
                total += countDescendants(child.target, visited);
            }

            return total;
        };

        return countDescendants(id);
    }, [edges, id]);

    // Spawn AI Input and close menu
    const handleAskFollowUp = useCallback(() => {
        if (activeHandle) {
            spawnAIInput(id, activeHandle);
            setActiveHandle(null);
        }
    }, [id, activeHandle, spawnAIInput]);

    // Close handle menu when clicking outside (on container)
    const handleContainerClick = useCallback(() => {
        if (activeHandle) {
            setActiveHandle(null);
        }
    }, [activeHandle]);

    // Menu action handlers
    const handleDelete = useCallback(() => {
        deleteNode(id);
    }, [id, deleteNode]);

    const handleRegenerate = useCallback(() => {
        regenerateNode(id);
    }, [id, regenerateNode]);

    const handleDuplicate = useCallback(() => {
        duplicateNode(id);
    }, [id, duplicateNode]);


    // Close handle menu when clicking anywhere outside the menu (global listener)
    React.useEffect(() => {
        if (!activeHandle) return;

        const handleGlobalClick = (e: MouseEvent) => {
            // Check if click is on the menu itself - if so, don't close
            const target = e.target as HTMLElement;
            if (target.closest('.handle-menu-container')) return;

            // Close the menu
            setActiveHandle(null);
        };

        // Add listener with slight delay to prevent immediate close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [activeHandle]);

    // Close 3-dot settings menu when clicking outside
    React.useEffect(() => {
        if (!isMenuOpen) return;

        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Don't close if clicking on the menu or the 3-dot button
            if (target.closest('.node-settings-menu') || target.closest('.node-menu-trigger')) return;

            setIsMenuOpen(false);
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [isMenuOpen]);

    // Close Add Tag popup when clicking outside
    React.useEffect(() => {
        if (!isAddingTag) return;

        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.add-tag-menu') || target.closest('.add-tag-trigger')) return;

            setIsAddingTag(false);
            setNewTagValue('');
        };

        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleGlobalClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [isAddingTag]);

    // Determines if we are in "Input Bubble" mode (empty question)
    const isInputMode = !data.question;

    // Richer color variants for better visibility
    // Richer color variants (matching Design Lab)
    const colorVariants: Record<PastelColor, { container: string; headerText: string; border: string; tag: string }> = {
        'pastel-blue': {
            container: 'bg-blue-100 shadow-sm hover:shadow-md transition-shadow',
            headerText: 'text-blue-600',
            border: '#93c5fd', // for handles
            tag: 'bg-blue-100 text-blue-700 border-blue-300',
        },
        'pastel-green': {
            container: 'bg-green-100 shadow-sm hover:shadow-md transition-shadow',
            headerText: 'text-green-600',
            border: '#86efac',
            tag: 'bg-green-100 text-green-700 border-green-300',
        },
        'pastel-pink': {
            container: 'bg-pink-100 shadow-sm hover:shadow-md transition-shadow',
            headerText: 'text-pink-600',
            border: '#f9a8d4',
            tag: 'bg-pink-100 text-pink-700 border-pink-300',
        },
        'pastel-lavender': {
            container: 'bg-purple-100 shadow-sm hover:shadow-md transition-shadow',
            headerText: 'text-purple-600',
            border: '#d8b4fe',
            tag: 'bg-purple-100 text-purple-700 border-purple-300',
        },
    };

    // Handle color change - propagates to all connected children
    const handleColorChange = (color: PastelColor) => {
        updateNodeColorWithChildren(id, color);
        setIsMenuOpen(false);
    };


    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];

    const handleSubmit = () => {
        if (inputValue.trim()) {
            updateNodeData(id, { question: inputValue });
        }
    };

    // If in Input Bubble mode
    if (isInputMode) {
        return (
            <div
                className={`
                    relative flex justify-center items-center
                    w-[350px] h-[56px] bg-white rounded-2xl shadow-lg border-2
                    transition-all duration-300 ease-out
                    ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                    ${!isBubbleEditing ? 'cursor-grab' : ''}
                `}
                style={{ borderColor: theme.border }}
                onDoubleClick={() => setIsBubbleEditing(true)}
            >
                {/* ===== HANDLES - Single Source Per Position - Bubble Mode ===== */}

                {/* TOP Handle (visible) */}
                <Handle type="source" position={Position.Top} id="top" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !border-2 !border-white"
                    style={{ backgroundColor: theme.border, boxShadow: 'none' }}
                />

                {/* BOTTOM Handle (hidden) */}
                <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0"
                    style={{ backgroundColor: theme.border }}
                />

                {/* LEFT Handle (hidden) */}
                <Handle type="source" position={Position.Left} id="left" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0"
                    style={{ backgroundColor: theme.border }}
                />

                {/* RIGHT Handle (hidden) */}
                <Handle type="source" position={Position.Right} id="right" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0"
                    style={{ backgroundColor: theme.border }}
                />

                {/* Input Field or Placeholder */}
                {isBubbleEditing ? (
                    <input
                        ref={bubbleInputRef}
                        className="nodrag w-full px-6 bg-transparent outline-none text-center text-gray-700 font-medium placeholder:text-gray-400"
                        placeholder={t.nodeActions.bubblePlaceholder}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                                handleSubmit();
                            }
                            if (e.key === 'Escape') {
                                setIsBubbleEditing(false);
                            }
                        }}
                        onBlur={() => setIsBubbleEditing(false)}
                    />
                ) : (
                    <div className="w-full px-6 text-center text-gray-400 font-medium">
                        {inputValue || t.nodeActions.doubleClickPlaceholder}
                    </div>
                )}
            </div>
        );
    }

    // Default: Result Card Mode with richer colors
    return (
        <div
            className={`
                relative min-w-[320px] max-w-[600px] rounded-[20px] flex flex-col gap-3 p-4
                transition-all duration-300 ease-out group
                ${theme.container}
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                ${isBlurred ? 'opacity-30 blur-[2px] pointer-events-none' : ''}
            `}
        >
            {/* Node Resizer - Only visible when selected */}
            <NodeResizer
                isVisible={selected}
                minWidth={250}
                maxWidth={700}
                minHeight={100}
                handleClassName="w-5 h-5 bg-white border-2 border-blue-400 rounded-full shadow-md hover:bg-blue-50 hover:scale-110 transition-transform"
                lineClassName="border-2 border-blue-400 border-dashed"
            />

            {/* Context Menu - appears at top-right of card, next to 3-dots */}
            <NodeToolbar isVisible={isMenuOpen} position={Position.Right} align="start" offset={10}>
                <div
                    className="node-settings-menu bg-white rounded-xl shadow-2xl border border-slate-100 p-3 min-w-[160px]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Color Swatches */}
                    <div className="flex gap-2 justify-center mb-2">
                        {COLOR_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                title={opt.label}
                                onClick={() => handleColorChange(opt.key)}
                                className={`
                                    w-5 h-5 rounded-full transition-transform hover:scale-110
                                    ${opt.swatch}
                                    ${data.color === opt.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}
                                `}
                            />
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-slate-100 my-2" />

                    {/* Actions */}
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(data.response || '');
                            setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-sm transition-colors text-slate-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        {t.nodeActions.copy}
                    </button>

                    <button
                        onClick={handleRegenerate}
                        className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-sm transition-colors text-slate-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {t.nodeActions.regenerate}
                    </button>

                    <button
                        onClick={handleDuplicate}
                        className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg text-sm transition-colors text-slate-700"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {t.nodeActions.duplicate}
                    </button>

                    <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 p-2 hover:bg-red-50 rounded-lg text-sm transition-colors text-red-600"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t.nodeActions.delete}
                    </button>
                </div>
            </NodeToolbar>

            {/* ===== HANDLES - Single Source Per Position (ConnectionMode.Loose) ===== */}

            {/* TOP Handle */}
            <Handle
                type="source"
                position={Position.Top}
                id="top"
                isConnectable={true}
                className={`!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === 'top' ? '!w-4 !h-4' : '!w-3 !h-3'}`}
                style={{
                    backgroundColor: theme.border,
                    boxShadow: activeHandle === 'top' ? `0 0 8px ${theme.border}` : 'none',
                    opacity: selected ? 1 : 0,
                    pointerEvents: selected ? 'auto' : 'none'
                }}
                onMouseDown={(e) => onHandleMouseDown(e, 'top')}
                onMouseUp={(e) => onHandleMouseUp(e, 'top')}
            />

            {/* BOTTOM Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                isConnectable={true}
                className={`!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === 'bottom' ? '!w-4 !h-4' : '!w-3 !h-3'}`}
                style={{
                    backgroundColor: theme.border,
                    boxShadow: activeHandle === 'bottom' ? `0 0 8px ${theme.border}` : 'none',
                    opacity: selected ? 1 : 0,
                    pointerEvents: selected ? 'auto' : 'none'
                }}
                onMouseDown={(e) => onHandleMouseDown(e, 'bottom')}
                onMouseUp={(e) => onHandleMouseUp(e, 'bottom')}
            />

            {/* LEFT Handle */}
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                isConnectable={true}
                className={`!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === 'left' ? '!w-4 !h-4' : '!w-3 !h-3'}`}
                style={{
                    backgroundColor: theme.border,
                    boxShadow: activeHandle === 'left' ? `0 0 8px ${theme.border}` : 'none',
                    opacity: selected ? 1 : 0,
                    pointerEvents: selected ? 'auto' : 'none'
                }}
                onMouseDown={(e) => onHandleMouseDown(e, 'left')}
                onMouseUp={(e) => onHandleMouseUp(e, 'left')}
            />

            {/* RIGHT Handle */}
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                isConnectable={true}
                className={`!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === 'right' ? '!w-4 !h-4' : '!w-3 !h-3'}`}
                style={{
                    backgroundColor: theme.border,
                    boxShadow: activeHandle === 'right' ? `0 0 8px ${theme.border}` : 'none',
                    opacity: selected ? 1 : 0,
                    pointerEvents: selected ? 'auto' : 'none'
                }}
                onMouseDown={(e) => onHandleMouseDown(e, 'right')}
                onMouseUp={(e) => onHandleMouseUp(e, 'right')}
            />

            {/* Handle Menus - appear when handle is clicked */}
            {activeHandle === 'top' && (
                <HandleMenu
                    position={Position.Top}
                    onAskFollowUp={handleAskFollowUp}
                    onClose={closeHandleMenu}
                    borderColor={theme.border}
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
                    borderColor={theme.border}
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
                    borderColor={theme.border}
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
                    borderColor={theme.border}
                    connectedEdges={getEdgesForHandle(id, 'right')}
                    onDisconnect={disconnectEdge}
                    onEdgeHover={setHighlightedEdge}
                />
            )}

            {/* Header Section (Title + Actions) */}
            <div className="flex justify-between items-start gap-2 px-1">
                <h3 className={`font-semibold text-lg ${theme.headerText} break-words overflow-hidden`} style={{ wordBreak: 'break-word' }}>
                    {data.question}
                </h3>
                <div className="flex items-center gap-1">
                    {/* 3-Dots Menu Trigger - Only visible on hover/select */}
                    <button
                        className={`
                            node-menu-trigger flex-shrink-0 p-1 rounded-md transition-all duration-200
                            hover:bg-white/50 opacity-0 group-hover:opacity-100
                            ${selected || isMenuOpen ? 'opacity-100' : ''}
                        `}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMenuOpen(!isMenuOpen);
                        }}
                    >
                        <svg
                            className="w-5 h-5 text-gray-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                    {/* Heart Favorite Button - Always visible if favorited */}
                    <button
                        className={`
                            flex-shrink-0 p-1 rounded-md transition-all duration-200
                            ${data.isFavorite
                                ? 'opacity-100'
                                : 'opacity-0 group-hover:opacity-100 hover:bg-white/50'
                            }
                            ${selected ? 'opacity-100' : ''}
                        `}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(id);
                        }}
                        title={data.isFavorite ? t.nodeActions.removeFavorite : t.nodeActions.addToFavorite}
                    >
                        <svg
                            className={`w-5 h-5 transition-colors ${data.isFavorite ? 'text-rose-500' : 'text-gray-400 hover:text-rose-400'}`}
                            fill={data.isFavorite ? "currentColor" : "none"}
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={data.isFavorite ? 0 : 2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Inner White Card (Tags + Body) */}
            <div className="bg-white rounded-[16px] px-5 py-4 border border-black/5 flex flex-col gap-4 flex-grow">
                {/* Tags Section (Moved to Top) */}
                <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
                    {(data.tags || []).map((tag) => (
                        editingTagId === tag.id ? (
                            <input
                                key={tag.id}
                                className={`nodrag px-2.5 py-1 text-xs font-medium rounded-md outline-none border-2 w-20 ${theme.tag}`}
                                autoFocus
                                value={editingTagValue}
                                onChange={(e) => setEditingTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                        if (editingTagValue.trim()) {
                                            updateTag(id, tag.id, editingTagValue.trim());
                                        } else {
                                            removeTag(id, tag.id);
                                        }
                                        setEditingTagId(null);
                                    }
                                    if (e.key === 'Escape') {
                                        setEditingTagId(null);
                                    }
                                }}
                                onBlur={() => {
                                    if (editingTagValue.trim()) {
                                        updateTag(id, tag.id, editingTagValue.trim());
                                    }
                                    setEditingTagId(null);
                                }}
                            />
                        ) : (
                            <span
                                key={tag.id}
                                className={`
                                    group flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all
                                    ${theme.tag}
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTagId(tag.id);
                                    setEditingTagValue(tag.label);
                                }}
                            >
                                {tag.label}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeTag(id, tag.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                                >
                                    ×
                                </button>
                            </span>
                        )
                    ))}
                    {/* Add Tag Button */}
                    {
                        isAddingTag ? (
                            <input
                                className="nodrag px-2.5 py-1 text-xs font-medium rounded-md outline-none border border-slate-300 bg-slate-50 w-20"
                                autoFocus
                                placeholder={t.nodeActions.newTagPlaceholder}
                                value={newTagValue}
                                onChange={(e) => setNewTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                        if (newTagValue.trim()) {
                                            addTag(id, newTagValue.trim());
                                        }
                                        setIsAddingTag(false);
                                        setNewTagValue('');
                                    }
                                    if (e.key === 'Escape') {
                                        setIsAddingTag(false);
                                        setNewTagValue('');
                                    }
                                }}
                                onBlur={() => {
                                    if (newTagValue.trim()) {
                                        addTag(id, newTagValue.trim());
                                    }
                                    setIsAddingTag(false);
                                    setNewTagValue('');
                                }}
                            />
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAddingTag(true);
                                }}
                                className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                            >
                                {t.nodeActions.addTag}
                            </button>
                        )
                    }
                </div >

                {/* Body Content Wrapper */}
                < div className="min-h-[20px]" >
                    {/* Loading indicator when typing */}
                    {
                        data.isTyping && data.response === '●●●' ? (
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        ) : (
                            <div className={`${tool === 'select' ? 'nodrag select-text cursor-text ' : ''}prose prose-sm prose-slate max-w-none text-slate-700 leading-relaxed`}>
                                <ReactMarkdown
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                        strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                        em: ({ node, ...props }) => <em className="italic" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                                        li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-base font-bold mb-2" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                        code: ({ node, ...props }) => <code className="bg-slate-100 px-1 rounded text-xs" {...props} />,
                                    }}
                                >
                                    {data.response}
                                </ReactMarkdown>
                            </div>
                        )
                    }
                </div >

            </div >

            {/* Collapse Bubble - Floating on RIGHT side - Only visible when selected */}
            {
                hasChildren && selected && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleNodeCollapse(id);
                        }}
                        className={`
                        absolute -right-12 top-1/2 -translate-y-1/2 
                        flex items-center gap-1 px-2.5 py-1.5 rounded-full 
                        text-xs font-medium transition-all hover:scale-110 shadow-sm
                        border ${theme.tag}
                        z-50
                    `}
                        title={data.collapsed ? t.nodeActions.expandBranch : t.nodeActions.collapseBranch}
                    >
                        {data.collapsed ? (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        ) : (
                            <svg className="w-3 h-3 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                        <span>{childrenCount}</span>
                    </button>
                )
            }
        </div >
    );
});

MindNode.displayName = 'MindNode';

export default MindNode;
