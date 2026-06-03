"use client";

import React, { memo, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeToolbar, NodeResizer, NodeResizeControl, ResizeControlVariant, useStore, useUpdateNodeInternals } from 'reactflow';
import { MindNodeData, PastelColor } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import HandleMenu from './HandleMenu';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { googlecode } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { Check, ChevronDown, ChevronUp, Copy, KeyRound, Zap } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useShallow } from 'zustand/react/shallow';
import TextSelectionToolbar from './TextSelectionToolbar';
import { sanitizeAiResponseText } from '@/lib/sanitizeAiResponse';
import { sanitizeTextLinkUrl } from '@/lib/textLinkUrl';
import {
    applyTextHighlights,
    clearTextSelection,
    getTextSelectionSnapshot,
    selectAllTextInElement,
    upsertTextHighlight,
    type TextSelectionSnapshot,
} from '@/lib/textHighlights';

const ALLOWED_MARKDOWN_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'code', 'pre', 'a', 'blockquote', 'br'] as const;

// Static memoized markdown components to prevent re-mounting ReactMarkdown DOM tree during drag
const markdownComponents = {
    p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0" {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-semibold" {...props} />,
    em: ({ node, ...props }: any) => <em className="italic" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside mb-2" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside mb-2" {...props} />,
    li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold mb-2" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-base font-bold mb-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold mb-1" {...props} />,
    blockquote: ({ node, ...props }: any) => <blockquote className="mb-3 border-l-2 border-slate-200 pl-3 text-slate-600" {...props} />,
    a: ({ node, href, ...props }: any) => {
        const safeHref = typeof href === 'string' ? sanitizeTextLinkUrl(href) : '';

        if (!safeHref) {
            return <span className="text-slate-500 underline decoration-dotted" {...props} />;
        }

        return (
            <a
                href={safeHref}
                target={safeHref.startsWith('#') || safeHref.startsWith('/') ? undefined : '_blank'}
                rel={safeHref.startsWith('#') || safeHref.startsWith('/') ? undefined : 'noopener noreferrer nofollow'}
                className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                {...props}
            />
        );
    },
    // Code block is handled dynamically inline as it relies on state (copying logic), but standard tags stay static
};

// Available color options for the picker (matching actual card colors)
const COLOR_OPTIONS: { key: PastelColor; swatch: string; label: string }[] = [
    { key: 'pastel-blue', swatch: 'bg-blue-200', label: 'Blue' },
    { key: 'pastel-green', swatch: 'bg-emerald-200', label: 'Green' },
    { key: 'pastel-pink', swatch: 'bg-orange-200', label: 'Orange' },
    { key: 'pastel-rose', swatch: 'bg-rose-200', label: 'Pink' },
    { key: 'pastel-lavender', swatch: 'bg-violet-200', label: 'Lavender' },
];

type MindNodeStoreShape = {
    nodeInternals: Map<string, { style?: { height?: number | string | null }; resizing?: boolean }>;
};


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
const MindNode = memo(({ id, data, selected, dragging }: NodeProps<MindNodeData>) => {
    const { tool, updateNodeData, spawnAIInput, updateTag, addTag, removeTag, updateNodeColorWithChildren, getEdgesForHandle, disconnectEdge, setHighlightedEdge, toggleNodeCollapse, deleteNode, regenerateNode, duplicateNode, searchQuery, getMatchingNodeIds, toggleFavorite, isFavoritesFilterActive, getFavoriteNodeIds } = useMindStore(useShallow(state => ({
        tool: state.tool, updateNodeData: state.updateNodeData, spawnAIInput: state.spawnAIInput, updateTag: state.updateTag, addTag: state.addTag, removeTag: state.removeTag, updateNodeColorWithChildren: state.updateNodeColorWithChildren, getEdgesForHandle: state.getEdgesForHandle, disconnectEdge: state.disconnectEdge, setHighlightedEdge: state.setHighlightedEdge, toggleNodeCollapse: state.toggleNodeCollapse, deleteNode: state.deleteNode, regenerateNode: state.regenerateNode, duplicateNode: state.duplicateNode, searchQuery: state.searchQuery, getMatchingNodeIds: state.getMatchingNodeIds, toggleFavorite: state.toggleFavorite, isFavoritesFilterActive: state.isFavoritesFilterActive, getFavoriteNodeIds: state.getFavoriteNodeIds
    })));
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

    // State for copying code block
    const [copiedCodeId, setCopiedCodeId] = React.useState<string | null>(null);
    const [responseTextSelection, setResponseTextSelection] = React.useState<TextSelectionSnapshot | null>(null);
    const [isResponseTextSelectable, setIsResponseTextSelectable] = React.useState(false);
    const [isQuestionExpanded, setIsQuestionExpanded] = React.useState(false);
    const [isExperimentSelectionChromeReady, setIsExperimentSelectionChromeReady] = React.useState(false);
    const resizeStartRef = React.useRef<{ width: number; height: number } | null>(null);
    const responseContentRef = React.useRef<HTMLDivElement>(null);
    const questionContentRef = React.useRef<HTMLHeadingElement>(null);
    const sanitizedResponse = React.useMemo(() => sanitizeAiResponseText(data.response), [data.response]);
    const responseRenderKey = React.useMemo(
        () => `${id}:${sanitizedResponse}:${data.isTyping ? 'typing' : 'idle'}`,
        [data.isTyping, id, sanitizedResponse]
    );
    const updateNodeInternals = useUpdateNodeInternals();
    const isExperimentMode = true;
    const persistedHeight = useStore(useCallback((s: MindNodeStoreShape) => {
        const node = s.nodeInternals.get(id);
        return node?.style?.height ?? null;
    }, [id]));
    const isNodeResizing = useStore(useCallback((s: MindNodeStoreShape) => {
        const node = s.nodeInternals.get(id);
        return node?.resizing ?? false;
    }, [id]));

    // Focus bubble input when entering edit mode
    React.useEffect(() => {
        if (isBubbleEditing && bubbleInputRef.current) {
            bubbleInputRef.current.focus();
        }
    }, [isBubbleEditing]);

    const closeResponseSelectionToolbar = useCallback(() => {
        setResponseTextSelection(null);
    }, []);

    const getSelectionToolbarPosition = useCallback((selection: TextSelectionSnapshot) => {
        const padding = 24;
        const left = selection.rect.left + (selection.rect.width / 2);

        return {
            top: Math.max(selection.rect.top - 14, 56),
            left: Math.min(Math.max(left, 180), window.innerWidth - 180 - padding),
        };
    }, []);

    React.useEffect(() => {
        if (data.isTyping) {
            closeResponseSelectionToolbar();
            return;
        }

        if (responseContentRef.current) {
            applyTextHighlights(responseContentRef.current, data.highlights);
        }
    }, [closeResponseSelectionToolbar, copiedCodeId, data.highlights, data.isTyping, sanitizedResponse]);

    React.useEffect(() => {
        if (selected && !dragging) return;
        setIsResponseTextSelectable(false);
        closeResponseSelectionToolbar();
    }, [closeResponseSelectionToolbar, dragging, selected]);

    React.useEffect(() => {
        if (!isExperimentMode || dragging) return;

        const frameId = requestAnimationFrame(() => {
            updateNodeInternals(id);
        });
        const settleId = window.setTimeout(() => {
            updateNodeInternals(id);
        }, 460);

        return () => {
            cancelAnimationFrame(frameId);
            window.clearTimeout(settleId);
        };
    }, [dragging, id, isExperimentMode, selected, updateNodeInternals]);

    React.useEffect(() => {
        if (!responseTextSelection) return;

        const handleGlobalPointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-highlight-toolbar-ignore="true"]')) return;
            if (responseContentRef.current?.contains(target)) return;
            closeResponseSelectionToolbar();
        };

        const handleSelectionChange = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                closeResponseSelectionToolbar();
            }
        };

        const handleViewportChange = () => {
            closeResponseSelectionToolbar();
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
    }, [closeResponseSelectionToolbar, responseTextSelection]);

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

    const resetNodeHeightToContent = useCallback(() => {
        useMindStore.setState((state) => ({
            nodes: state.nodes.map((node) => {
                if (node.id !== id) return node;

                const nextStyle = { ...(node.style ?? {}) } as Record<string, unknown>;
                delete nextStyle.height;

                return {
                    ...node,
                    height: undefined,
                    style: nextStyle,
                };
            }),
        }));

        requestAnimationFrame(() => {
            updateNodeInternals(id);
        });
    }, [id, updateNodeInternals]);

    const shouldResizeHorizontally = useCallback((_: unknown, params: { direction: number[] }) => (
        params.direction[1] === 0
    ), []);

    const handleResizeStart = useCallback((_: unknown, params: { width: number; height: number }) => {
        resizeStartRef.current = { width: params.width, height: params.height };
    }, []);

    const handleResizeEnd = useCallback((_: unknown, params: { width: number; height: number }) => {
        const resizeStart = resizeStartRef.current;
        resizeStartRef.current = null;

        if (!resizeStart) return;

        const widthChanged = Math.abs(params.width - resizeStart.width) > 1;
        const heightChanged = Math.abs(params.height - resizeStart.height) > 1;

        // Horizontal resize should keep the node's hitbox tightly matched to the content height.
        if (widthChanged && !heightChanged) {
            resetNodeHeightToContent();
        }
    }, [resetNodeHeightToContent]);

    React.useEffect(() => {
        if (isNodeResizing) return;
        if (persistedHeight == null) return;

        resetNodeHeightToContent();
    }, [isNodeResizing, persistedHeight, resetNodeHeightToContent]);

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

    const handleResponseContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (tool !== 'select' || !isResponseTextSelectable || data.isTyping || !responseContentRef.current) return;

        const selection = getTextSelectionSnapshot(responseContentRef.current);
        if (!selection) return;

        event.preventDefault();
        event.stopPropagation();
        setResponseTextSelection(selection);
    }, [data.isTyping, isResponseTextSelectable, tool]);

    const handleHighlightResponseSelection = useCallback((color: PastelColor) => {
        if (!responseTextSelection) return;

        updateNodeData(id, {
            highlights: upsertTextHighlight(data.highlights, {
                start: responseTextSelection.start,
                end: responseTextSelection.end,
                color,
            }),
        });

        clearTextSelection();
        closeResponseSelectionToolbar();
    }, [closeResponseSelectionToolbar, data.highlights, id, responseTextSelection, updateNodeData]);

    const handleCopyResponseSelection = useCallback(async () => {
        if (!responseTextSelection?.text) return;

        await navigator.clipboard.writeText(responseTextSelection.text);
        closeResponseSelectionToolbar();
    }, [closeResponseSelectionToolbar, responseTextSelection]);

    const handleSelectAllResponseText = useCallback(() => {
        if (!responseContentRef.current) return;

        const selection = selectAllTextInElement(responseContentRef.current);
        if (!selection) return;

        setResponseTextSelection(selection);
    }, []);


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
            container: 'bg-orange-100 shadow-sm hover:shadow-md transition-shadow',
            headerText: 'text-orange-600',
            border: '#fdba74',
            tag: 'bg-orange-100 text-orange-700 border-orange-300',
        },
        'pastel-rose': {
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


    const experimentPanelVariants: Record<PastelColor, string> = {
        'pastel-blue': 'bg-[#E6F0FF] border-[#CFE0FF]',
        'pastel-green': 'bg-[#E8F9E2] border-[#D3F0C9]',
        'pastel-pink': 'bg-[#FFF0E8] border-[#FFE1D2]',
        'pastel-rose': 'bg-[#FFE8F1] border-[#FFD0E3]',
        'pastel-lavender': 'bg-[#F0DFFF] border-[#E2C8FF]',
    };
    const experimentPanelRgb: Record<PastelColor, string> = {
        'pastel-blue': '230, 240, 255',
        'pastel-green': '232, 249, 226',
        'pastel-pink': '255, 240, 232',
        'pastel-rose': '255, 232, 241',
        'pastel-lavender': '240, 223, 255',
    };
    const experimentPanelShadows: Record<PastelColor, string> = {
        'pastel-blue': 'shadow-[0_12px_18px_-16px_rgba(88,132,214,0.70)]',
        'pastel-green': 'shadow-[0_12px_18px_-16px_rgba(93,166,78,0.66)]',
        'pastel-pink': 'shadow-[0_12px_18px_-16px_rgba(214,132,92,0.42)]',
        'pastel-rose': 'shadow-[0_12px_18px_-16px_rgba(214,96,143,0.48)]',
        'pastel-lavender': 'shadow-[0_12px_18px_-16px_rgba(157,94,218,0.68)]',
    };
    const experimentTypingDotColors: Record<PastelColor, string> = {
        'pastel-blue': '#7BAAF7',
        'pastel-green': '#86D67A',
        'pastel-pink': '#F2B179',
        'pastel-rose': '#F59AC2',
        'pastel-lavender': '#C49AF6',
    };

    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];
    const experimentQuestionPanel = experimentPanelVariants[data.color] || experimentPanelVariants['pastel-blue'];
    const experimentPanelShadow = experimentPanelShadows[data.color] || experimentPanelShadows['pastel-blue'];
    const experimentPanelColor = experimentPanelRgb[data.color] || experimentPanelRgb['pastel-blue'];
    const experimentTypingDotColor = experimentTypingDotColors[data.color] || experimentTypingDotColors['pastel-blue'];
    const trimmedQuestion = data.question.trim();
    const questionWordCount = trimmedQuestion ? trimmedQuestion.split(/\s+/).length : 0;
    const isExperimentQuestionOnly = isExperimentMode && sanitizedResponse.trim().length === 0 && !data.isTyping;
    const isExperimentLongQuestion = isExperimentMode && (
        trimmedQuestion.length > 120 ||
        questionWordCount > 18
    );
    const collapsedQuestionHeight = isExperimentLongQuestion ? 76 : undefined;
    const experimentCardWidthClass = isExperimentQuestionOnly && isExperimentLongQuestion
        ? 'min-w-[420px] max-w-[520px]'
        : 'min-w-[320px]';
    const shouldCompactExperimentQuestion = isExperimentLongQuestion;
    const experimentQuestionClassName = isExperimentLongQuestion
        ? 'break-words text-[19px] font-semibold leading-[1.26] text-slate-900/95'
        : 'break-words text-[22px] font-semibold leading-tight text-slate-950';
    const experimentHandleClassName = '!z-40 !flex !h-[26px] !w-[26px] !items-center !justify-center !rounded-lg !border !border-zinc-200 !bg-white !shadow-[0_3px_8px_rgba(15,23,42,0.08)] experiment-node-handle hover:!shadow-[0_6px_12px_rgba(15,23,42,0.12)]';
    const isExperimentHandleVisible = (_side?: 'top' | 'bottom' | 'left' | 'right') => isExperimentSelectionChromeReady;
    const getExperimentHandleClassName = (side: 'top' | 'bottom' | 'left' | 'right') => (
        `${experimentHandleClassName} ${isExperimentHandleVisible(side) ? 'experiment-node-handle-visible' : 'experiment-node-handle-hidden'} experiment-node-handle-${side}`
    );
    const classicHandleClassName = (handleId: string) => `!rounded-full !border-2 !border-white transition-opacity duration-200 ${activeHandle === handleId ? '!w-4 !h-4' : '!w-3 !h-3'}`;
    const renderExperimentHandleIcon = () => (
        <Zap className="pointer-events-none h-3.5 w-3.5 fill-blue-500 text-blue-500" strokeWidth={2.2} />
    );

    const handleSubmit = () => {
        if (inputValue.trim()) {
            updateNodeData(id, { question: inputValue });
        }
    };

    React.useEffect(() => {
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

    React.useEffect(() => {
        setIsQuestionExpanded(false);
    }, [data.question, id]);

    React.useEffect(() => {
        if (!isExperimentMode || !shouldCompactExperimentQuestion) return;

        const frameId = requestAnimationFrame(() => {
            updateNodeInternals(id);
        });
        const settleId = window.setTimeout(() => {
            updateNodeInternals(id);
        }, 420);

        return () => {
            cancelAnimationFrame(frameId);
            window.clearTimeout(settleId);
        };
    }, [id, isExperimentMode, isQuestionExpanded, shouldCompactExperimentQuestion, updateNodeInternals]);

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
                relative w-full min-w-[320px] flex flex-col
                group
                ${isExperimentMode
                    ? `${experimentCardWidthClass} rounded-[32px] border border-slate-200/80 bg-white p-3 gap-3 shadow-[0_18px_45px_rgba(15,23,42,0.10)] transition-shadow hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)]`
                    : `rounded-[20px] gap-3 p-4 ${theme.container}`
                }
                ${isExperimentMode && data.branchAnimation === 'enter' ? 'experiment-branch-enter' : ''}
                ${isExperimentMode && data.branchAnimation === 'exit' ? 'experiment-branch-exit' : ''}
                ${selected && !isExperimentMode ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                ${isBlurred ? 'opacity-30 blur-[2px] pointer-events-none' : ''}
            `}
        >
            {/* Node Resizer - Only visible when selected */}
            <NodeResizer
                isVisible={selected && !isExperimentMode}
                minWidth={250}
                maxWidth={700}
                minHeight={100}
                handleClassName="w-6 h-6 bg-white border-2 border-blue-400 rounded-full shadow-md hover:bg-blue-50 hover:scale-110 transition-transform"
                lineClassName="border-[3px] border-blue-400 border-dashed"
                shouldResize={shouldResizeHorizontally}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
            />
            {selected && isExperimentMode && isExperimentSelectionChromeReady && (
                <div className="pointer-events-none absolute inset-0 z-30 rounded-[32px] border-2 border-blue-400 animate-[experimentSelectIn_340ms_cubic-bezier(0.16,1,0.3,1)_both]" />
            )}
            <TextSelectionToolbar
                visible={!!responseTextSelection}
                position={responseTextSelection ? getSelectionToolbarPosition(responseTextSelection) : { top: 0, left: 0 }}
                onHighlight={handleHighlightResponseSelection}
                onCopy={handleCopyResponseSelection}
                onSelectAll={handleSelectAllResponseText}
            />
            {selected && (
                <>
                    <NodeResizeControl
                        position="left"
                        variant={ResizeControlVariant.Line}
                        minWidth={250}
                        maxWidth={700}
                        minHeight={100}
                        className="cursor-ew-resize"
                        style={{
                            width: 18,
                            left: -10,
                            borderColor: 'transparent',
                            background: 'transparent',
                            zIndex: isExperimentMode ? 38 : 35,
                        }}
                        shouldResize={shouldResizeHorizontally}
                        onResizeStart={handleResizeStart}
                        onResizeEnd={handleResizeEnd}
                    />
                    <NodeResizeControl
                        position="right"
                        variant={ResizeControlVariant.Line}
                        minWidth={250}
                        maxWidth={700}
                        minHeight={100}
                        className="cursor-ew-resize"
                        style={{
                            width: 18,
                            right: -10,
                            borderColor: 'transparent',
                            background: 'transparent',
                            zIndex: isExperimentMode ? 38 : 35,
                        }}
                        shouldResize={shouldResizeHorizontally}
                        onResizeStart={handleResizeStart}
                        onResizeEnd={handleResizeEnd}
                    />
                </>
            )}

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
                                    h-6 w-6 rounded-lg transition-transform hover:scale-110
                                    ${opt.swatch}
                                    ${data.color === opt.key ? 'ring-2 ring-offset-2 ring-slate-400' : ''}
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
            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Top}
                    id="top"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('top') : classicHandleClassName('top')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : theme.border,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'top' ? `0 0 8px ${theme.border}` : 'none',
                        opacity: isExperimentHandleVisible('top') && activeHandle !== 'top' ? 1 : 0,
                        pointerEvents: isExperimentHandleVisible('top') && activeHandle !== 'top' ? 'auto' : 'none',
                        ...(isExperimentMode ? { top: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(e) => onHandleMouseDown(e, 'top')}
                    onMouseUp={(e) => onHandleMouseUp(e, 'top')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {/* BOTTOM Handle */}
            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('bottom') : classicHandleClassName('bottom')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : theme.border,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'bottom' ? `0 0 8px ${theme.border}` : 'none',
                        opacity: isExperimentHandleVisible('bottom') && activeHandle !== 'bottom' ? 1 : 0,
                        pointerEvents: isExperimentHandleVisible('bottom') && activeHandle !== 'bottom' ? 'auto' : 'none',
                        ...(isExperimentMode ? { bottom: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(e) => onHandleMouseDown(e, 'bottom')}
                    onMouseUp={(e) => onHandleMouseUp(e, 'bottom')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {/* LEFT Handle */}
            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Left}
                    id="left"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('left') : classicHandleClassName('left')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : theme.border,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'left' ? `0 0 8px ${theme.border}` : 'none',
                        opacity: isExperimentHandleVisible('left') && activeHandle !== 'left' ? 1 : 0,
                        pointerEvents: isExperimentHandleVisible('left') && activeHandle !== 'left' ? 'auto' : 'none',
                        ...(isExperimentMode ? { left: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(e) => onHandleMouseDown(e, 'left')}
                    onMouseUp={(e) => onHandleMouseUp(e, 'left')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

            {/* RIGHT Handle */}
            {(isExperimentMode || selected) && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    isConnectable={true}
                    className={isExperimentMode ? getExperimentHandleClassName('right') : classicHandleClassName('right')}
                    style={{
                        backgroundColor: isExperimentMode ? '#ffffff' : theme.border,
                        boxShadow: isExperimentMode ? undefined : activeHandle === 'right' ? `0 0 8px ${theme.border}` : 'none',
                        opacity: isExperimentHandleVisible('right') && activeHandle !== 'right' ? 1 : 0,
                        pointerEvents: isExperimentHandleVisible('right') && activeHandle !== 'right' ? 'auto' : 'none',
                        ...(isExperimentMode ? { right: 0, width: 26, height: 26 } : {}),
                    }}
                    onMouseDown={(e) => onHandleMouseDown(e, 'right')}
                    onMouseUp={(e) => onHandleMouseUp(e, 'right')}
                >
                    {isExperimentMode && renderExperimentHandleIcon()}
                </Handle>
            )}

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
                    variant={isExperimentMode ? 'experiment' : 'default'}
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
                    variant={isExperimentMode ? 'experiment' : 'default'}
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
                    variant={isExperimentMode ? 'experiment' : 'default'}
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
                    variant={isExperimentMode ? 'experiment' : 'default'}
                />
            )}

            {/* Header Section (Title + Actions) */}
            <div className={`flex items-start gap-2 px-1 ${isExperimentMode ? 'justify-between min-h-6' : 'justify-between'}`}>
                {!isExperimentMode && (
                    <h3 className={`font-semibold text-lg ${theme.headerText} break-words overflow-hidden`} style={{ wordBreak: 'break-word' }}>
                        {data.question}
                    </h3>
                )}
                {isExperimentMode && <div className="min-h-[24px]" />}
                <div className="flex items-center gap-1">
                    {isExperimentMode && hasChildren && (
                        <button
                            className={`
                                nodrag flex h-8 min-w-[44px] flex-shrink-0 items-center justify-center gap-1.5 rounded-xl
                                border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-600
                                shadow-[0_6px_16px_rgba(15,23,42,0.08)]
                                transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-800 hover:shadow-[0_10px_22px_rgba(15,23,42,0.11)]
                                ${data.collapsed ? 'border-blue-200 bg-blue-50 text-blue-600' : ''}
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleNodeCollapse(id);
                            }}
                            title={data.collapsed ? t.nodeActions.expandBranch : t.nodeActions.collapseBranch}
                        >
                            <span className="relative h-4 w-4" aria-hidden="true">
                                <span className="absolute left-1 top-0 h-3 w-3 rounded-[4px] border border-current/45 bg-current/10" />
                                <span className="absolute left-0 top-1 h-3 w-3 rounded-[4px] border border-current/70 bg-white" />
                            </span>
                            <span>{childrenCount}</span>
                        </button>
                    )}
                    {/* 3-Dots Menu Trigger - Only visible on hover/select */}
                    <button
                        className={`
                            node-menu-trigger flex-shrink-0 p-1 rounded-md transition-all duration-200
                            ${isExperimentMode
                                ? 'opacity-100 hover:bg-slate-100'
                                : 'hover:bg-white/50 opacity-0 group-hover:opacity-100'
                            }
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
                            ${isExperimentMode
                                ? 'opacity-100 hover:bg-slate-100'
                                : data.isFavorite
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

            {/* Inner Card (Tags + Body) */}
            <div className={isExperimentMode
                ? `rounded-[20px] border px-5 py-4 flex flex-col gap-4 flex-grow ${experimentQuestionPanel} ${experimentPanelShadow}`
                : 'bg-white rounded-[16px] px-5 py-4 border border-black/5 flex flex-col gap-4 flex-grow'
            }>
                {isExperimentMode && (
                    <div className="group/question relative">
                        <div
                            className={shouldCompactExperimentQuestion
                                ? 'overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
                                : undefined
                            }
                            style={shouldCompactExperimentQuestion
                                ? {
                                    maxHeight: isQuestionExpanded
                                        ? (questionContentRef.current?.scrollHeight ?? collapsedQuestionHeight)
                                        : collapsedQuestionHeight,
                                }
                                : undefined
                            }
                        >
                            <h3
                                ref={questionContentRef}
                                className={experimentQuestionClassName}
                                style={{
                                    wordBreak: 'break-word',
                                    textWrap: 'pretty',
                                }}
                                title={shouldCompactExperimentQuestion && !isQuestionExpanded ? data.question : undefined}
                            >
                                {data.question}
                            </h3>
                        </div>
                        {shouldCompactExperimentQuestion && !isQuestionExpanded && (
                            <>
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-[14px] opacity-65 transition-opacity duration-200 group-hover/question:opacity-100 group-focus-within/question:opacity-100"
                                    style={{
                                        background: `linear-gradient(to bottom, rgba(${experimentPanelColor}, 0), rgba(${experimentPanelColor}, 0.72) 54%, rgba(${experimentPanelColor}, 0.98) 100%)`,
                                    }}
                                />
                                <button
                                    className="absolute bottom-0 left-1/2 flex h-7 -translate-x-1/2 translate-y-1 items-center gap-1 rounded-full border border-white/35 px-2.5 text-[11px] font-semibold leading-none text-slate-600/90 opacity-0 shadow-[0_5px_14px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0 hover:bg-white/42 hover:text-slate-900 group-hover/question:translate-y-0 group-hover/question:opacity-100 group-focus-within/question:translate-y-0 group-focus-within/question:opacity-100"
                                    style={{
                                        backgroundColor: `rgba(${experimentPanelColor}, 0.92)`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsQuestionExpanded(true);
                                    }}
                                    aria-label="Show full question"
                                    title="Show full question"
                                >
                                    <span>Expand</span>
                                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} />
                                </button>
                            </>
                        )}
                        {shouldCompactExperimentQuestion && isQuestionExpanded && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8">
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-[14px] opacity-0 transition-opacity duration-200 group-hover/question:opacity-100 group-focus-within/question:opacity-100"
                                    style={{
                                        background: `linear-gradient(to bottom, rgba(${experimentPanelColor}, 0), rgba(${experimentPanelColor}, 0.68) 74%, rgba(${experimentPanelColor}, 0.98) 100%)`,
                                    }}
                                />
                                <button
                                    className="pointer-events-auto absolute bottom-0 left-1/2 flex h-7 -translate-x-1/2 translate-y-1 items-center gap-1 rounded-full border border-white/35 px-2.5 text-[11px] font-semibold leading-none text-slate-600/90 opacity-0 shadow-[0_5px_14px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0 hover:bg-white/42 hover:text-slate-900 group-hover/question:translate-y-0 group-hover/question:opacity-100 group-focus-within/question:translate-y-0 group-focus-within/question:opacity-100"
                                    style={{
                                        backgroundColor: `rgba(${experimentPanelColor}, 0.92)`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsQuestionExpanded(false);
                                    }}
                                    aria-label="Collapse question"
                                    title="Collapse question"
                                >
                                    <span>Show less</span>
                                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.25} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Tags Section (Moved to Top) */}
                {!isExperimentMode && (
                <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
                    {(data.tags || []).map((tag) => (
                        editingTagId === tag.id ? (
                            <input
                                key={tag.id}
                                className={`nodrag px-2.5 py-1 text-xs font-medium rounded-md outline-none border-2 w-20 ${isExperimentMode ? 'border-slate-200 bg-slate-50 text-slate-600' : theme.tag}`}
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
                                    ${isExperimentMode ? 'border border-slate-200 bg-slate-50 text-slate-500' : theme.tag}
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
                    {data.aiProviderMode === 'byok' && (
                        <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <KeyRound className="h-3 w-3" />
                            BYOK
                        </span>
                    )}
                    {data.modelName && (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {data.modelName}
                        </span>
                    )}
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
                )}

                {/* Body Content Wrapper */}
                < div className="min-h-[20px]" >
                    {/* Loading indicator when typing */}
                    {
                        data.isTyping && data.response === '●●●' ? (
                            <div className="flex items-center gap-1">
                                <span
                                    className="h-2 w-2 rounded-full animate-bounce"
                                    style={{ animationDelay: '0ms', backgroundColor: experimentTypingDotColor, opacity: 0.5 }}
                                />
                                <span
                                    className="h-2 w-2 rounded-full animate-bounce"
                                    style={{ animationDelay: '150ms', backgroundColor: experimentTypingDotColor, opacity: 0.68 }}
                                />
                                <span
                                    className="h-2 w-2 rounded-full animate-bounce"
                                    style={{ animationDelay: '300ms', backgroundColor: experimentTypingDotColor, opacity: 0.86 }}
                                />
                            </div>
                        ) : (
                            <div
                                key={responseRenderKey}
                                ref={responseContentRef}
                                onContextMenu={handleResponseContextMenu}
                                onMouseDown={(event) => {
                                    if (tool !== 'select' || !selected || isResponseTextSelectable) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                }}
                                onClick={(event) => {
                                    if (tool !== 'select' || !selected || isResponseTextSelectable) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsResponseTextSelectable(true);
                                }}
                                className={`${tool === 'select' && isResponseTextSelectable ? 'nodrag select-text cursor-text ' : selected ? 'select-none cursor-default ' : 'select-none cursor-grab '}prose prose-sm prose-slate max-w-none leading-relaxed ${isExperimentMode ? 'text-zinc-700 prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-800' : 'text-slate-700'}`}
                            >
                                <ReactMarkdown
                                    skipHtml
                                    allowedElements={[...ALLOWED_MARKDOWN_ELEMENTS]}
                                    urlTransform={(value) => sanitizeTextLinkUrl(value)}
                                    components={{
                                        ...markdownComponents,
                                        code({ node, inline, className, children, ...props }: any) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            // Handle block code
                                            if (!inline && match) {
                                                const language = match[1];
                                                const codeContent = String(children).replace(/\n$/, '');
                                                const codeId = `${id}-${language}-${codeContent.substring(0, 10)}`;
                                                const isCopied = copiedCodeId === codeId;

                                                const handleCopyCode = (e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(codeContent);
                                                    setCopiedCodeId(codeId);
                                                    setTimeout(() => setCopiedCodeId(null), 2000);
                                                };

                                                return (
                                                    <div className="relative my-4 rounded-xl overflow-hidden shadow-sm border border-slate-200 nodrag group/code">
                                                        <div
                                                            className="flex items-center justify-between px-4 py-2 bg-[#F0F4F9] text-slate-600 text-xs font-medium border-b border-transparent"
                                                            data-text-highlight-ignore="true"
                                                        >
                                                            <span className="capitalize">{language}</span>
                                                            <button 
                                                                onClick={handleCopyCode}
                                                                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-200/50 text-slate-500 transition-colors"
                                                            >
                                                                {isCopied ? (
                                                                    <>
                                                                        <Check size={14} className="text-emerald-500" />
                                                                        <span className="text-emerald-500">Copied</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy size={14} />
                                                                        <span>Copy code</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <SyntaxHighlighter
                                                            style={googlecode}
                                                            language={language}
                                                            PreTag="div"
                                                            customStyle={{
                                                                margin: 0,
                                                                padding: '1rem',
                                                                fontSize: '0.875rem',
                                                                borderRadius: '0 0 12px 12px',
                                                                backgroundColor: '#F0F4F9'
                                                            }}
                                                            {...props}
                                                        >
                                                            {codeContent}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                );
                                            }
                                            // Fallback to inline code style for backtick wrapped snippets
                                            return (
                                                <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                    }}
                                >
                                    {sanitizedResponse}
                                </ReactMarkdown>
                            </div>
                        )
                    }
                </div >

            </div >

            {/* Collapse Bubble - Floating on RIGHT side - Only visible when selected */}
            {
                !isExperimentMode && hasChildren && selected && (
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
}, (prevProps, nextProps) => {
    // Custom equality check to prevent re-renders purely from position changes during drag
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.data.question === nextProps.data.question &&
        prevProps.data.response === nextProps.data.response &&
        prevProps.data.color === nextProps.data.color &&
        prevProps.data.highlights === nextProps.data.highlights &&
        prevProps.data.isFavorite === nextProps.data.isFavorite &&
        prevProps.data.collapsed === nextProps.data.collapsed &&
        prevProps.data.branchAnimation === nextProps.data.branchAnimation &&
        prevProps.data.isTyping === nextProps.data.isTyping &&
        // Check if tags changed (shallow array compare)
        prevProps.data.tags?.length === nextProps.data.tags?.length &&
        prevProps.selected === nextProps.selected &&
        prevProps.dragging === nextProps.dragging
    );
});

MindNode.displayName = 'MindNode';

export default MindNode;
