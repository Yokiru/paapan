"use client";

import React, { memo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeToolbar, NodeResizer, NodeResizeControl, ResizeControlVariant, useStore, useUpdateNodeInternals } from 'reactflow';
import { Zap } from 'lucide-react';
import { TextNodeData, PastelColor, TextMark } from '@/types';
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
import {
    applyTextMarkFontSize,
    applyTextMarkHighlight,
    applyTextMarkLink,
    buildRichTextSegments,
    getCollapsedCaretOffset,
    getEditableSelectionRange,
    getPlainTextFromEditable,
    parseHtmlToRichText,
    getTextMarkSelectionState,
    normalizeTextMarks,
    replaceTextInContentAndMarks,
    replaceStructuredTextInContentAndMarks,
    setSelectionByOffsets,
    toggleTextMarkStyle,
} from '@/lib/richTextMarks';
import { sanitizeTextLinkUrl } from '@/lib/textLinkUrl';

// Color variants for background
const colorVariants: Record<PastelColor, { border: string; bg: string }> = {
    'pastel-blue': { border: '#93c5fd', bg: 'rgba(219, 234, 254, 0.9)' },
    'pastel-green': { border: '#6ee7b7', bg: 'rgba(209, 250, 229, 0.9)' },
    'pastel-pink': { border: '#fdba74', bg: 'rgba(255, 237, 213, 0.9)' },
    'pastel-rose': { border: '#fda4af', bg: 'rgba(255, 228, 230, 0.9)' },
    'pastel-lavender': { border: '#c4b5fd', bg: 'rgba(237, 233, 254, 0.9)' },
};

// Font size mapping
const fontSizeMap = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-xl',
    xlarge: 'text-3xl',
};

const cardExperimentFontSizeStyles: Record<TextNodeData['fontSize'], React.CSSProperties> = {
    small: { fontSize: '14px', lineHeight: '1.7' },
    medium: { fontSize: '18px', lineHeight: '1.7' },
    large: { fontSize: '24px', lineHeight: '1.55' },
    xlarge: { fontSize: '32px', lineHeight: '1.4' },
};

const plainTextExperimentFontSizeStyles: Record<TextNodeData['fontSize'], React.CSSProperties> = {
    small: { fontSize: '24px', lineHeight: '1.35' },
    medium: { fontSize: '32px', lineHeight: '1.3' },
    large: { fontSize: '40px', lineHeight: '1.2' },
    xlarge: { fontSize: '48px', lineHeight: '1.15' },
};

const plainTextToolbarFontSizeOptions: Array<{ value: TextNodeData['fontSize']; label: string }> = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
];

const handwritingFontFamily = 'var(--font-shantell-sans), "Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive';

const escapeHtml = (value: string) => (
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
);

const getExperimentRichTextHtml = (
    segments: ReturnType<typeof buildRichTextSegments>,
    defaultFontSize: TextNodeData['fontSize'],
    fontSizeStyles: Record<TextNodeData['fontSize'], React.CSSProperties>,
    defaultFontWeight: 400 | 700 = 400,
) => {
    if (segments.length === 0) return '<br />';

    return segments.map((segment) => {
        const fontSizeStyle = fontSizeStyles[segment.style.fontSize ?? defaultFontSize];
        const safeHref = segment.style.linkHref ? sanitizeTextLinkUrl(segment.style.linkHref) : '';
        const styles = [
            `font-size: ${fontSizeStyle.fontSize}`,
            `line-height: ${fontSizeStyle.lineHeight}`,
            `font-weight: ${segment.style.bold ? 700 : defaultFontWeight}`,
            `font-style: ${segment.style.italic ? 'italic' : 'normal'}`,
            `text-decoration: ${segment.style.underline ? 'underline' : 'none'}`,
        ];

        if (segment.style.underline) {
            styles.push('text-decoration-thickness: 0.08em');
            styles.push('text-underline-offset: 0.16em');
        }

        if (segment.style.highlightColor) {
            styles.push(`background-color: ${colorVariants[segment.style.highlightColor].bg}`);
            styles.push('border-radius: 0.45rem');
            styles.push('box-decoration-break: clone');
            styles.push('-webkit-box-decoration-break: clone');
        }

        if (safeHref) {
            styles.push('color: #2563eb');
            styles.push('text-decoration: underline');
            styles.push('text-underline-offset: 0.16em');

            const isExternal = !safeHref.startsWith('/') && !safeHref.startsWith('#');
            return `<a href="${escapeHtml(safeHref)}" ${isExternal ? 'target="_blank" rel="noopener noreferrer nofollow"' : ''} style="${styles.join('; ')}">${escapeHtml(segment.text)}</a>`;
        }

        return `<span style="${styles.join('; ')}">${escapeHtml(segment.text)}</span>`;
    }).join('');
};

const isToolbarInteractionElement = (element: Element | null) => (
    !!element?.closest('[data-highlight-toolbar-ignore="true"]')
);

type TextNodeProps = NodeProps<TextNodeData> & { width?: number; height?: number };
type TextNodeStoreShape = {
    nodeInternals: Map<string, {
        style?: { width?: number | string; height?: number | string };
        resizing?: boolean;
    }>;
};

/**
 * Text Node - Simple text block with formatting options
 */
const TextNode = memo(({ id, data, selected }: TextNodeProps) => {
    const { updateNodeData, updateNodeStyle, spawnAIInput, getEdgesForHandle, disconnectEdge, setHighlightedEdge, deleteNode } = useMindStore();
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(data.content || '');
    const [activeHandle, setActiveHandle] = useState<string | null>(null);
    const [textSelection, setTextSelection] = useState<TextSelectionSnapshot | null>(null);
    const [isExperimentToolbarOpen, setIsExperimentToolbarOpen] = useState(false);
    const [isPlainTextTyping, setIsPlainTextTyping] = useState(() => (data.variant ?? 'card') === 'plain' && !!data.isDraft);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const displayContentRef = useRef<HTMLDivElement>(null);
    const experimentEditorRef = useRef<HTMLDivElement>(null);
    const experimentContentRef = useRef(content);
    const experimentMarksRef = useRef<TextMark[]>([]);
    const experimentHtmlRef = useRef<string>('');
    const lastExperimentHeightRef = useRef<number | null>(null);
    const resizeStartRef = useRef<{ width: number; height: number } | null>(null);
    const isExperimentResizingRef = useRef(false);
    const isExperimentSelectingRef = useRef(false);
    const pendingExperimentSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const preservedExperimentSelectionRef = useRef<TextSelectionSnapshot | null>(null);
    const updateNodeInternals = useUpdateNodeInternals();
    const isExperimentMode = true;

    const hasExplicitWidth = useStore(useCallback((s: TextNodeStoreShape) => {
        const node = s.nodeInternals.get(id);
        return !!(node?.style?.width || node?.style?.height);
    }, [id]));
    const isNodeResizing = useStore(useCallback((s: TextNodeStoreShape) => {
        const node = s.nodeInternals.get(id);
        return node?.resizing ?? false;
    }, [id]));

    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];
    const textVariant = data.variant ?? 'card';
    const isPlainTextVariant = textVariant === 'plain';
    const hasBackground = isPlainTextVariant ? false : (data.hasBackground ?? false);
    const experimentFontSizeStyles = isPlainTextVariant ? plainTextExperimentFontSizeStyles : cardExperimentFontSizeStyles;
    const effectiveFontWeight = isPlainTextVariant ? 'bold' : data.fontWeight;
    const isSelectionChromeVisible = selected && (!isPlainTextVariant || !isPlainTextTyping);
    const isExperimentTextEditable = !isPlainTextVariant || isPlainTextTyping;
    const visibleActiveHandle = isSelectionChromeVisible ? activeHandle : null;
    const experimentMarks = normalizeTextMarks(data.marks, data.highlights);
    const experimentSegments = buildRichTextSegments(content, data.marks, data.highlights);
    const experimentRichTextHtml = getExperimentRichTextHtml(
        experimentSegments,
        data.fontSize,
        experimentFontSizeStyles,
        isPlainTextVariant ? 700 : 400,
    );

    // Handle color: gray when no background, themed when has background
    const handleColor = isPlainTextVariant ? '#93c5fd' : (hasBackground ? theme.border : '#9ca3af');
    const experimentHandleClassName = '!z-40 !flex !h-[26px] !w-[26px] !items-center !justify-center !rounded-lg !border !border-zinc-200 !bg-white !shadow-[0_3px_8px_rgba(15,23,42,0.08)] experiment-node-handle hover:!shadow-[0_6px_12px_rgba(15,23,42,0.12)]';
    const getExperimentHandleClassName = useCallback((side: 'top' | 'bottom' | 'left' | 'right') => (
        `${experimentHandleClassName} ${isSelectionChromeVisible && visibleActiveHandle !== side ? 'experiment-node-handle-visible' : 'experiment-node-handle-hidden'} experiment-node-handle-${side}`
    ), [isSelectionChromeVisible, visibleActiveHandle]);
    const renderExperimentHandleIcon = () => (
        <Zap className="pointer-events-none h-3.5 w-3.5 fill-blue-500 text-blue-500" strokeWidth={2.2} />
    );

    const syncExperimentTextSize = useCallback((element: HTMLElement | null = experimentEditorRef.current ?? textareaRef.current) => {
        if (!element) return;
        if (isExperimentResizingRef.current || isNodeResizing) return;

        const nextContentHeight = Math.max(element.scrollHeight, isPlainTextVariant ? 44 : 110);
        const nextNodeHeight = nextContentHeight + (isPlainTextVariant ? 10 : 56);
        if (lastExperimentHeightRef.current !== nextNodeHeight) {
            lastExperimentHeightRef.current = nextNodeHeight;
            updateNodeStyle(id, { height: nextNodeHeight });
            requestAnimationFrame(() => updateNodeInternals(id));
        }
    }, [id, isNodeResizing, isPlainTextVariant, updateNodeInternals, updateNodeStyle]);

    const resetExperimentNodeHeightToContent = useCallback(() => {
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

        lastExperimentHeightRef.current = null;
        requestAnimationFrame(() => {
            updateNodeInternals(id);
            requestAnimationFrame(() => {
                syncExperimentTextSize(experimentEditorRef.current);
            });
        });
    }, [id, syncExperimentTextSize, updateNodeInternals]);

    const shouldResizeHorizontally = useCallback((_: unknown, params: { direction: number[] }) => (
        params.direction[1] === 0
    ), []);

    const handleResizeStart = useCallback((_: unknown, params: { width: number; height: number }) => {
        resizeStartRef.current = { width: params.width, height: params.height };
        isExperimentResizingRef.current = true;
        pendingExperimentSelectionRef.current = null;
        setTextSelection(null);
        clearTextSelection();
        experimentEditorRef.current?.blur();
    }, []);

    const handleResizeEnd = useCallback((_: unknown, params: { width: number; height: number }) => {
        const resizeStart = resizeStartRef.current;
        resizeStartRef.current = null;
        isExperimentResizingRef.current = false;

        if (!resizeStart) return;

        const widthChanged = Math.abs(params.width - resizeStart.width) > 1;
        if (!widthChanged) return;

        resetExperimentNodeHeightToContent();
    }, [resetExperimentNodeHeightToContent]);

    const activeExperimentSelection = textSelection ?? (isExperimentToolbarOpen ? preservedExperimentSelectionRef.current : null);

    const closeTextSelectionToolbar = useCallback(() => {
        setIsExperimentToolbarOpen(false);
        setTextSelection(null);
    }, []);
    const isTextSelectionToolbarVisible = !!activeExperimentSelection && (selected || isExperimentToolbarOpen);
    const experimentSelectionStyles = activeExperimentSelection
        ? (() => {
            const selectionState = getTextMarkSelectionState(content, experimentMarks, activeExperimentSelection, data.fontSize);

            return {
                ...selectionState,
                textAlign: data.textAlign,
                linkHref: selectionState.linkHref ?? '',
            };
        })()
        : {
            bold: false,
            italic: false,
            underline: false,
            fontSize: data.fontSize,
            textAlign: data.textAlign,
            linkHref: '',
        };

    useEffect(() => {
        if (textSelection) {
            preservedExperimentSelectionRef.current = textSelection;
            return;
        }

        if (!isExperimentToolbarOpen) {
            preservedExperimentSelectionRef.current = null;
        }
    }, [isExperimentToolbarOpen, textSelection]);

    const getToolbarPosition = useCallback((selection: TextSelectionSnapshot) => {
        const padding = 24;
        const left = selection.rect.left + (selection.rect.width / 2);

        return {
            top: Math.max(selection.rect.top - 14, 56),
            left: Math.min(Math.max(left, 180), window.innerWidth - 180 - padding),
        };
    }, []);

    const restoreExperimentSelection = useCallback((start: number, end: number) => {
        pendingExperimentSelectionRef.current = { start, end };
    }, []);

    const applyExperimentState = useCallback((
        nextContent: string,
        nextMarks: TextMark[],
        selection?: { start: number; end: number } | null,
    ) => {
        experimentContentRef.current = nextContent;
        experimentMarksRef.current = nextMarks;
        setContent(nextContent);
        updateNodeData(id, {
            content: nextContent,
            marks: nextMarks,
            highlights: undefined,
        });

        if (selection) {
            restoreExperimentSelection(selection.start, selection.end);
        }
    }, [id, restoreExperimentSelection, updateNodeData]);

    const mutateExperimentContent = useCallback((nextPlainText: string, preferredSelection?: { start: number; end: number } | null) => {
        const previousContent = experimentContentRef.current;
        const previousMarks = experimentMarksRef.current;

        if (nextPlainText === previousContent) {
            if (preferredSelection) {
                restoreExperimentSelection(preferredSelection.start, preferredSelection.end);
            }
            return;
        }

        let prefixLength = 0;
        const maxPrefix = Math.min(previousContent.length, nextPlainText.length);
        while (
            prefixLength < maxPrefix
            && previousContent[prefixLength] === nextPlainText[prefixLength]
        ) {
            prefixLength += 1;
        }

        let suffixLength = 0;
        const maxSuffix = Math.min(previousContent.length - prefixLength, nextPlainText.length - prefixLength);
        while (
            suffixLength < maxSuffix
            && previousContent[previousContent.length - 1 - suffixLength] === nextPlainText[nextPlainText.length - 1 - suffixLength]
        ) {
            suffixLength += 1;
        }

        const replacementRange = {
            start: prefixLength,
            end: previousContent.length - suffixLength,
        };
        const insertedText = nextPlainText.slice(prefixLength, nextPlainText.length - suffixLength);
        const result = replaceTextInContentAndMarks(previousContent, previousMarks, replacementRange, insertedText);

        applyExperimentState(
            result.content,
            result.marks,
            preferredSelection ?? { start: result.selectionStart, end: result.selectionEnd },
        );
    }, [applyExperimentState, restoreExperimentSelection]);

    // Focus textarea when entering edit mode
    useEffect(() => {
        if ((isEditing || (isExperimentMode && (!isPlainTextVariant || isPlainTextTyping))) && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing, isExperimentMode, isPlainTextTyping, isPlainTextVariant]);

    useEffect(() => {
        setContent(data.content || '');
    }, [data.content]);

    useEffect(() => {
        experimentContentRef.current = content;
    }, [content]);

    useEffect(() => {
        experimentMarksRef.current = experimentMarks;
    }, [experimentMarks]);

    useEffect(() => {
        if (!data.isDraft || content.length === 0) return;
        updateNodeData(id, { isDraft: false });
    }, [content, data.isDraft, id, updateNodeData]);

    useEffect(() => {
        if (!data.isDraft || selected || content.length > 0) return;
        deleteNode(id);
    }, [content, data.isDraft, deleteNode, id, selected]);

    useEffect(() => {
        if (isExperimentMode && isExperimentTextEditable && experimentEditorRef.current) {
            experimentEditorRef.current.focus({ preventScroll: true });
        }
    }, [isExperimentMode, isExperimentTextEditable]);

    useEffect(() => {
        if (selected || !isPlainTextVariant) return;
        setIsPlainTextTyping(false);
        setTextSelection(null);
    }, [isPlainTextVariant, selected]);

    useEffect(() => {
        if (!isExperimentMode) return;
        syncExperimentTextSize();
    }, [content, isExperimentMode, syncExperimentTextSize]);

    useLayoutEffect(() => {
        if (!isExperimentMode) return;

        const editor = experimentEditorRef.current;
        if (!editor || experimentHtmlRef.current === experimentRichTextHtml) return;
        editor.innerHTML = experimentRichTextHtml;
        experimentHtmlRef.current = experimentRichTextHtml;

        syncExperimentTextSize(editor);
    }, [experimentRichTextHtml, isExperimentMode, syncExperimentTextSize]);

    useEffect(() => {
        if (!isExperimentMode) return;

        const pendingSelection = pendingExperimentSelectionRef.current;
        const editor = experimentEditorRef.current;
        if (!pendingSelection || !editor || isExperimentResizingRef.current) return;

        requestAnimationFrame(() => {
            const activeEditor = experimentEditorRef.current;
            if (!activeEditor || isExperimentResizingRef.current) return;

            pendingExperimentSelectionRef.current = null;
            const activeElement = document.activeElement;
            if (
                activeElement !== activeEditor
                && !activeElement?.closest('[data-highlight-toolbar-ignore="true"]')
            ) {
                syncExperimentTextSize(activeEditor);
                return;
            }

            activeEditor.focus({ preventScroll: true });
            setSelectionByOffsets(activeEditor, pendingSelection.start, pendingSelection.end);

            const nextSelection = getTextSelectionSnapshot(activeEditor);
            setTextSelection(nextSelection);
            syncExperimentTextSize(activeEditor);
        });
    }, [content, data.marks, data.highlights, isExperimentMode, syncExperimentTextSize]);

    useEffect(() => {
        if (isEditing) return;
        if (isExperimentMode) return;

        if (displayContentRef.current) {
            applyTextHighlights(displayContentRef.current, data.highlights);
        }
    }, [data.content, data.highlights, isEditing, isExperimentMode]);

    useEffect(() => {
        if (!isExperimentMode) return;

        const handlePointerRelease = () => {
            isExperimentSelectingRef.current = false;
        };
        const handleEditorPointerDown = (event: MouseEvent) => {
            const editor = experimentEditorRef.current;
            const target = event.target as Node | null;
            if (!editor || !target || !editor.contains(target)) return;

            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement && isToolbarInteractionElement(activeElement)) {
                activeElement.blur();
            }
        };

        document.addEventListener('mousedown', handleEditorPointerDown, true);
        document.addEventListener('mouseup', handlePointerRelease);
        document.addEventListener('pointerup', handlePointerRelease);
        document.addEventListener('pointercancel', handlePointerRelease);

        return () => {
            document.removeEventListener('mousedown', handleEditorPointerDown, true);
            document.removeEventListener('mouseup', handlePointerRelease);
            document.removeEventListener('pointerup', handlePointerRelease);
            document.removeEventListener('pointercancel', handlePointerRelease);
        };
    }, [isExperimentMode]);

    useEffect(() => {
        if (!isExperimentMode) return;

        const handleSelectionChange = () => {
            if (isExperimentResizingRef.current) {
                setTextSelection(null);
                return;
            }

            const editor = experimentEditorRef.current;
            const selection = window.getSelection();
            const activeElement = document.activeElement;
            const isToolbarFocused = activeElement instanceof Element && isToolbarInteractionElement(activeElement);
            const shouldPreserveSelection = isToolbarFocused || isExperimentToolbarOpen;

            if (!editor || !selected) {
                if (!shouldPreserveSelection) {
                    setTextSelection(null);
                }
                return;
            }

            if (shouldPreserveSelection && !isExperimentSelectingRef.current) {
                return;
            }

            if (!selection || selection.rangeCount === 0) {
                if (!isExperimentSelectingRef.current && !shouldPreserveSelection) {
                    setTextSelection(null);
                }
                return;
            }

            if (selection.isCollapsed) {
                if (!isExperimentSelectingRef.current && !shouldPreserveSelection) {
                    setTextSelection(null);
                }
                return;
            }

            if (!selected) {
                setTextSelection(null);
                return;
            }

            const range = selection.getRangeAt(0);
            const isInsideEditor = editor.contains(range.startContainer) && editor.contains(range.endContainer);
            if (!isInsideEditor) {
                if (!isExperimentSelectingRef.current && !shouldPreserveSelection) {
                    setTextSelection(null);
                }
                return;
            }

            const nextSelection = getTextSelectionSnapshot(editor);
            if (nextSelection) {
                setTextSelection(nextSelection);
            } else if (!isExperimentSelectingRef.current && !shouldPreserveSelection) {
                setTextSelection(null);
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [isExperimentMode, isExperimentToolbarOpen, selected]);

    useEffect(() => {
        if (!isExperimentMode || selected || isExperimentToolbarOpen) return;
        setTextSelection(null);
    }, [isExperimentMode, isExperimentToolbarOpen, selected]);

    useEffect(() => {
        if (!isTextSelectionToolbarVisible) return;

        const handleGlobalPointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-highlight-toolbar-ignore="true"]')) return;
            if (displayContentRef.current?.contains(target)) return;
            if (textareaRef.current?.contains(target)) return;
            if (experimentEditorRef.current?.contains(target)) return;
            closeTextSelectionToolbar();
        };

        const handleViewportChange = () => {
            closeTextSelectionToolbar();
        };

        document.addEventListener('mousedown', handleGlobalPointerDown);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            document.removeEventListener('mousedown', handleGlobalPointerDown);
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
        if (isPlainTextVariant) return;
        updateNodeData(id, {
            fontWeight: data.fontWeight === 'bold' ? 'normal' : 'bold'
        });
    };

    const handleAlignChange = (align: TextNodeData['textAlign']) => {
        updateNodeData(id, { textAlign: align });
    };

    const handleBackgroundToggle = () => {
        updateNodeData(id, isPlainTextVariant
            ? { variant: 'card', hasBackground: true, isDraft: false }
            : { variant: 'plain', hasBackground: false });
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

    const handleExperimentInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
        const editor = event.currentTarget;
        const nextPlainText = getPlainTextFromEditable(editor);
        const caretOffset = getCollapsedCaretOffset(editor);

        mutateExperimentContent(
            nextPlainText,
            caretOffset === null ? null : { start: caretOffset, end: caretOffset },
        );
    }, [mutateExperimentContent]);

    const handleExperimentPaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();

        const editor = experimentEditorRef.current;
        if (!editor) return;

        const pastedHtml = event.clipboardData.getData('text/html');
        const pastedText = event.clipboardData.getData('text/plain');
        const selection = getTextSelectionSnapshot(editor);
        const collapsedCaret = getCollapsedCaretOffset(editor);

        const range = selection
            ? { start: selection.start, end: selection.end }
            : (collapsedCaret !== null ? { start: collapsedCaret, end: collapsedCaret } : null);

        if (!range) return;

        const richTextPaste = pastedHtml ? parseHtmlToRichText(pastedHtml) : null;
        const result = richTextPaste && richTextPaste.content
            ? replaceStructuredTextInContentAndMarks(
                experimentContentRef.current,
                experimentMarksRef.current,
                range,
                richTextPaste.content,
                richTextPaste.marks,
            )
            : replaceTextInContentAndMarks(
                experimentContentRef.current,
                experimentMarksRef.current,
                range,
                pastedText,
            );

        applyExperimentState(result.content, result.marks, {
            start: result.selectionStart,
            end: result.selectionEnd,
        });
    }, [applyExperimentState]);

    const applyExperimentInputEdit = useCallback((inputType: string, data: string | null = null) => {
        const editor = experimentEditorRef.current;
        if (!editor) return false;

        const contentLength = experimentContentRef.current.length;
        const selectionRange = getEditableSelectionRange(editor);
        const collapsedCaret = getCollapsedCaretOffset(editor);
        const selectedRange = selectionRange && selectionRange.start !== selectionRange.end
            ? selectionRange
            : null;
        const caretRange = collapsedCaret !== null
            ? { start: collapsedCaret, end: collapsedCaret }
            : null;

        let range = selectedRange ?? caretRange;
        let insertedText: string | null = null;

        if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
            insertedText = '\n';
        } else if (inputType === 'insertText' || inputType === 'insertCompositionText') {
            insertedText = data ?? '';
        } else if (inputType.startsWith('delete')) {
            insertedText = '';

            if (!selectedRange && caretRange) {
                if (
                    inputType === 'deleteContentBackward'
                    || inputType === 'deleteWordBackward'
                    || inputType === 'deleteSoftLineBackward'
                    || inputType === 'deleteHardLineBackward'
                ) {
                    range = {
                        start: Math.max(0, caretRange.start - 1),
                        end: caretRange.end,
                    };
                } else if (
                    inputType === 'deleteContentForward'
                    || inputType === 'deleteWordForward'
                    || inputType === 'deleteSoftLineForward'
                    || inputType === 'deleteHardLineForward'
                ) {
                    range = {
                        start: caretRange.start,
                        end: Math.min(contentLength, caretRange.end + 1),
                    };
                }
            }
        } else {
            return false;
        }

        if (!range || insertedText === null) return true;
        if (range.start === range.end && insertedText === '') return true;

        const result = replaceTextInContentAndMarks(
            experimentContentRef.current,
            experimentMarksRef.current,
            range,
            insertedText,
        );

        applyExperimentState(result.content, result.marks, {
            start: result.selectionStart,
            end: result.selectionEnd,
        });
        return true;
    }, [applyExperimentState]);

    const handleExperimentBeforeInput = useCallback((event: React.FormEvent<HTMLDivElement>) => {
        const nativeEvent = event.nativeEvent as InputEvent;
        const inputType = typeof nativeEvent.inputType === 'string'
            ? nativeEvent.inputType
            : null;
        if (!inputType) return;

        const handled = applyExperimentInputEdit(inputType, nativeEvent.data ?? null);
        if (!handled) return;

        event.preventDefault();
    }, [applyExperimentInputEdit]);

    const handleExperimentFormat = useCallback((updater: (marks: TextMark[], selection: TextSelectionSnapshot) => TextMark[]) => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;

        const nextMarks = updater(experimentMarksRef.current, selection);
        applyExperimentState(experimentContentRef.current, nextMarks, {
            start: selection.start,
            end: selection.end,
        });
    }, [applyExperimentState, textSelection]);

    const handleExperimentToggleBold = useCallback(() => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => toggleTextMarkStyle(
            experimentContentRef.current,
            marks,
            activeSelection,
            'bold',
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentToggleItalic = useCallback(() => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => toggleTextMarkStyle(
            experimentContentRef.current,
            marks,
            activeSelection,
            'italic',
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentToggleUnderline = useCallback(() => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => toggleTextMarkStyle(
            experimentContentRef.current,
            marks,
            activeSelection,
            'underline',
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentFontSizeChange = useCallback((fontSize: TextNodeData['fontSize']) => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => applyTextMarkFontSize(
            experimentContentRef.current,
            marks,
            activeSelection,
            fontSize,
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentTextAlignChange = useCallback((textAlign: TextNodeData['textAlign']) => {
        updateNodeData(id, { textAlign });
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (selection) {
            restoreExperimentSelection(selection.start, selection.end);
        }
    }, [id, restoreExperimentSelection, textSelection, updateNodeData]);

    const handleExperimentHighlight = useCallback((color: PastelColor) => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => applyTextMarkHighlight(
            experimentContentRef.current,
            marks,
            activeSelection,
            color,
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentSetLink = useCallback((href: string) => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => applyTextMarkLink(
            experimentContentRef.current,
            marks,
            activeSelection,
            href,
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentRemoveLink = useCallback(() => {
        const selection = textSelection ?? preservedExperimentSelectionRef.current;
        if (!selection) return;
        handleExperimentFormat((marks, activeSelection) => applyTextMarkLink(
            experimentContentRef.current,
            marks,
            activeSelection,
            null,
        ));
    }, [handleExperimentFormat, textSelection]);

    const handleExperimentSelectAll = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        const editor = experimentEditorRef.current;
        if (!editor) return;

        event.preventDefault();
        event.stopPropagation();

        requestAnimationFrame(() => {
            setSelectionByOffsets(editor, 0, experimentContentRef.current.length);
            const nextSelection = getTextSelectionSnapshot(editor);
            setTextSelection(nextSelection);
        });
    }, []);

    if (isExperimentMode) {
        return (
            <div
                className={`
                    relative box-border w-full flex flex-col transition-shadow
                    ${isPlainTextVariant
                        ? `min-w-[180px] rounded-[22px] bg-transparent p-1.5 ${isSelectionChromeVisible ? 'ring-1 ring-blue-300/80 ring-offset-2 ring-offset-transparent' : ''}`
                        : `min-w-[320px] rounded-[32px] border bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.10)] ${isSelectionChromeVisible ? 'border-blue-400 shadow-[0_18px_45px_rgba(37,99,235,0.13)]' : 'border-slate-200/80'}`
                    }
                `}
            >
                {isSelectionChromeVisible && (
                    <>
                        <NodeResizeControl
                            position="left"
                            variant={ResizeControlVariant.Line}
                            minWidth={isPlainTextVariant ? 140 : 320}
                            maxWidth={880}
                            minHeight={isPlainTextVariant ? 52 : 166}
                            className="cursor-ew-resize"
                            style={{
                                width: 18,
                                left: -10,
                                borderColor: 'transparent',
                                background: 'transparent',
                                zIndex: 38,
                            }}
                            shouldResize={shouldResizeHorizontally}
                            onResizeStart={handleResizeStart}
                            onResizeEnd={handleResizeEnd}
                        />
                        <NodeResizeControl
                            position="right"
                            variant={ResizeControlVariant.Line}
                            minWidth={isPlainTextVariant ? 140 : 320}
                            maxWidth={880}
                            minHeight={isPlainTextVariant ? 52 : 166}
                            className="cursor-ew-resize"
                            style={{
                                width: 18,
                                right: -10,
                                borderColor: 'transparent',
                                background: 'transparent',
                                zIndex: 38,
                            }}
                            shouldResize={shouldResizeHorizontally}
                            onResizeStart={handleResizeStart}
                            onResizeEnd={handleResizeEnd}
                        />
                    </>
                )}
                <TextSelectionToolbar
                    variant="rich"
                    visible={isTextSelectionToolbarVisible}
                    position={activeExperimentSelection ? getToolbarPosition(activeExperimentSelection) : { top: 0, left: 0 }}
                    activeStyles={experimentSelectionStyles}
                    onToggleBold={handleExperimentToggleBold}
                    onToggleItalic={handleExperimentToggleItalic}
                    onToggleUnderline={handleExperimentToggleUnderline}
                    onFontSizeChange={handleExperimentFontSizeChange}
                    onTextAlignChange={handleExperimentTextAlignChange}
                    onHighlight={handleExperimentHighlight}
                    onSetLink={handleExperimentSetLink}
                    onRemoveLink={handleExperimentRemoveLink}
                    onPopoverOpenChange={setIsExperimentToolbarOpen}
                    fontSizeOptions={isPlainTextVariant ? plainTextToolbarFontSizeOptions : undefined}
                    hideBold={isPlainTextVariant}
                />
                <Handle
                    type="source"
                    position={Position.Top}
                    id="top"
                    isConnectable
                    className={getExperimentHandleClassName('top')}
                    style={{
                        backgroundColor: '#ffffff',
                        opacity: isSelectionChromeVisible && visibleActiveHandle !== 'top' ? 1 : 0,
                        pointerEvents: isSelectionChromeVisible && visibleActiveHandle !== 'top' ? 'auto' : 'none',
                        top: 0,
                        width: 26,
                        height: 26,
                    }}
                    onMouseDown={onHandleMouseDown}
                    onMouseUp={(event) => onHandleMouseUp(event, 'top')}
                >
                    {renderExperimentHandleIcon()}
                </Handle>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    isConnectable
                    className={getExperimentHandleClassName('bottom')}
                    style={{
                        backgroundColor: '#ffffff',
                        opacity: isSelectionChromeVisible && visibleActiveHandle !== 'bottom' ? 1 : 0,
                        pointerEvents: isSelectionChromeVisible && visibleActiveHandle !== 'bottom' ? 'auto' : 'none',
                        bottom: 0,
                        width: 26,
                        height: 26,
                    }}
                    onMouseDown={onHandleMouseDown}
                    onMouseUp={(event) => onHandleMouseUp(event, 'bottom')}
                >
                    {renderExperimentHandleIcon()}
                </Handle>
                <Handle
                    type="source"
                    position={Position.Left}
                    id="left"
                    isConnectable
                    className={getExperimentHandleClassName('left')}
                    style={{
                        backgroundColor: '#ffffff',
                        opacity: isSelectionChromeVisible && visibleActiveHandle !== 'left' ? 1 : 0,
                        pointerEvents: isSelectionChromeVisible && visibleActiveHandle !== 'left' ? 'auto' : 'none',
                        left: 0,
                        width: 26,
                        height: 26,
                    }}
                    onMouseDown={onHandleMouseDown}
                    onMouseUp={(event) => onHandleMouseUp(event, 'left')}
                >
                    {renderExperimentHandleIcon()}
                </Handle>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="right"
                    isConnectable
                    className={getExperimentHandleClassName('right')}
                    style={{
                        backgroundColor: '#ffffff',
                        opacity: isSelectionChromeVisible && visibleActiveHandle !== 'right' ? 1 : 0,
                        pointerEvents: isSelectionChromeVisible && visibleActiveHandle !== 'right' ? 'auto' : 'none',
                        right: 0,
                        width: 26,
                        height: 26,
                    }}
                    onMouseDown={onHandleMouseDown}
                    onMouseUp={(event) => onHandleMouseUp(event, 'right')}
                >
                    {renderExperimentHandleIcon()}
                </Handle>
                {visibleActiveHandle === 'top' && (
                    <HandleMenu
                        position={Position.Top}
                        onAskFollowUp={handleAskFollowUp}
                        onClose={closeHandleMenu}
                        borderColor="#cbd5e1"
                        connectedEdges={getEdgesForHandle(id, 'top')}
                        onDisconnect={disconnectEdge}
                        onEdgeHover={setHighlightedEdge}
                        variant="experiment"
                    />
                )}
                {visibleActiveHandle === 'bottom' && (
                    <HandleMenu
                        position={Position.Bottom}
                        onAskFollowUp={handleAskFollowUp}
                        onClose={closeHandleMenu}
                        borderColor="#cbd5e1"
                        connectedEdges={getEdgesForHandle(id, 'bottom')}
                        onDisconnect={disconnectEdge}
                        onEdgeHover={setHighlightedEdge}
                        variant="experiment"
                    />
                )}
                {visibleActiveHandle === 'left' && (
                    <HandleMenu
                        position={Position.Left}
                        onAskFollowUp={handleAskFollowUp}
                        onClose={closeHandleMenu}
                        borderColor="#cbd5e1"
                        connectedEdges={getEdgesForHandle(id, 'left')}
                        onDisconnect={disconnectEdge}
                        onEdgeHover={setHighlightedEdge}
                        variant="experiment"
                    />
                )}
                {visibleActiveHandle === 'right' && (
                    <HandleMenu
                        position={Position.Right}
                        onAskFollowUp={handleAskFollowUp}
                        onClose={closeHandleMenu}
                        borderColor="#cbd5e1"
                        connectedEdges={getEdgesForHandle(id, 'right')}
                        onDisconnect={disconnectEdge}
                        onEdgeHover={setHighlightedEdge}
                        variant="experiment"
                    />
                )}
                <div
                    className={isPlainTextVariant ? 'relative px-1 py-0.5' : 'relative rounded-[24px] border border-slate-200/70 bg-[#F3F6FB] px-5 py-4'}
                    onClick={(event) => {
                        if (!isPlainTextVariant || !selected || isPlainTextTyping) return;
                        event.preventDefault();
                        event.stopPropagation();
                        setIsPlainTextTyping(true);
                    }}
                >
                    {!content && !isPlainTextVariant && (
                        <div className="pointer-events-none absolute translate-y-[2px] text-[18px] font-semibold leading-7 text-slate-400">
                            {t.textNode.placeholder}
                        </div>
                    )}
                    <div
                        ref={experimentEditorRef}
                        contentEditable={isExperimentTextEditable}
                        suppressContentEditableWarning
                        spellCheck={false}
                        role="textbox"
                        aria-multiline="true"
                        className={`${isExperimentTextEditable || !isPlainTextVariant ? 'nodrag ' : ''}block w-full whitespace-pre-wrap break-words text-slate-900 outline-none ${isPlainTextVariant ? 'min-h-[44px]' : 'min-h-[110px]'}`}
                        style={{
                            textAlign: data.textAlign,
                            fontFamily: isPlainTextVariant ? handwritingFontFamily : undefined,
                            cursor: isExperimentTextEditable ? 'text' : (isPlainTextVariant ? (selected ? 'default' : 'grab') : 'default'),
                            fontWeight: effectiveFontWeight === 'bold' ? 700 : 400,
                        }}
                        onBeforeInput={handleExperimentBeforeInput}
                        onInput={handleExperimentInput}
                        onPaste={handleExperimentPaste}
                        onKeyDown={(event) => {
                            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                                handleExperimentSelectAll(event);
                                return;
                            }
                            if (event.key === 'Enter') {
                                if (applyExperimentInputEdit('insertParagraph', '\n')) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    return;
                                }
                            }
                            if (event.key === 'Backspace') {
                                if (applyExperimentInputEdit('deleteContentBackward')) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    return;
                                }
                            }
                            if (event.key === 'Delete') {
                                if (applyExperimentInputEdit('deleteContentForward')) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    return;
                                }
                            }
                            if (event.key === 'Escape') {
                                clearTextSelection();
                                setTextSelection(null);
                                (event.currentTarget as HTMLDivElement).blur();
                            }
                            event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                            if (isPlainTextVariant && selected && !isPlainTextTyping) {
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }

                            if (isExperimentTextEditable) {
                                const activeElement = document.activeElement;
                                if (activeElement instanceof HTMLElement && isToolbarInteractionElement(activeElement)) {
                                    activeElement.blur();
                                }
                                isExperimentSelectingRef.current = true;
                                event.stopPropagation();
                            }
                        }}
                        onFocus={() => {
                            if (isPlainTextVariant) {
                                setIsPlainTextTyping(true);
                            }
                        }}
                        onClick={(event) => {
                            if (isPlainTextVariant && selected && !isPlainTextTyping) {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsPlainTextTyping(true);
                                return;
                            }

                            const anchor = (event.target as HTMLElement).closest('a');
                            if (!anchor) return;

                            if (isExperimentTextEditable) {
                                event.preventDefault();
                                event.stopPropagation();
                                return;
                            }

                            event.stopPropagation();
                        }}
                        onBlur={() => {
                            requestAnimationFrame(() => {
                                const activeElement = document.activeElement;
                                const shouldKeepTyping = !!(
                                    activeElement
                                    && (
                                        experimentEditorRef.current?.contains(activeElement)
                                        || isToolbarInteractionElement(activeElement)
                                    )
                                );
                                if (
                                    !isExperimentToolbarOpen
                                    && (
                                        !activeElement
                                        || (
                                            !experimentEditorRef.current?.contains(activeElement)
                                            && !isToolbarInteractionElement(activeElement)
                                        )
                                    )
                                ) {
                                    setTextSelection(null);
                                }

                                if (isPlainTextVariant && !shouldKeepTyping) {
                                    setIsPlainTextTyping(false);
                                }
                            });
                        }}
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            <NodeResizer 
                color={handleColor} 
                isVisible={selected} 
                minWidth={isPlainTextVariant ? 140 : 200}
                minHeight={isPlainTextVariant ? 52 : 100}
                handleStyle={{ zIndex: 30, width: 14, height: 14, borderRadius: 7, border: '2px solid white', backgroundColor: handleColor }}
                lineStyle={{ borderWidth: 2, borderColor: handleColor }}
            />
            <div
                className={`
                    relative flex w-full h-full flex-col p-4
                    ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                    ${isPlainTextVariant ? 'rounded-2xl border border-transparent bg-transparent' : `${hasBackground ? 'rounded-xl border-2' : 'rounded-xl border border-dashed border-gray-300'}`}
                    ${hasExplicitWidth ? '' : isPlainTextVariant ? 'max-w-[320px]' : 'max-w-[400px]'}
                `}
                style={{
                    backgroundColor: isPlainTextVariant ? 'transparent' : (hasBackground ? theme.bg : 'transparent'),
                    borderColor: isPlainTextVariant ? 'transparent' : (hasBackground ? theme.border : undefined),
                    minWidth: isPlainTextVariant ? '140px' : '200px',
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
                        {isPlainTextVariant ? (
                            <>
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                            </>
                        ) : (
                            <>
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                                <option value="xlarge">X-Large</option>
                            </>
                        )}
                    </select>

                    {!isPlainTextVariant && (
                        <>
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
                        </>
                    )}

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
                        className={`w-7 h-7 flex items-center justify-center rounded ${!isPlainTextVariant ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100'}`}
                        title={t.textNode.toggleBackground}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={hasBackground ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                    </button>

                    {/* Color Picker (only when background is enabled) */}
                    {!isPlainTextVariant && hasBackground && (
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
                        ${effectiveFontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                        ${selected ? 'nodrag select-text cursor-text' : 'select-none cursor-default'}
                        text-gray-700 whitespace-pre-wrap
                        ${!data.content && !isEditing && !isPlainTextVariant ? 'text-gray-400 italic' : ''}
                        ${isEditing ? 'invisible' : ''}
                    `}
                    style={{
                        textAlign: data.textAlign,
                        minHeight: '1.5em',
                        wordBreak: 'break-word',
                        fontFamily: isPlainTextVariant ? handwritingFontFamily : undefined,
                    }}
                    ref={displayContentRef}
                    onContextMenu={handleContentContextMenu}
                >
                    {data.content || (isPlainTextVariant ? '' : t.textNode.doubleClickEdit)}
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
                            ${effectiveFontWeight === 'bold' ? 'font-bold' : 'font-normal'}
                            text-gray-700 whitespace-pre-wrap scrollbar-transparent
                        `}
                        style={{
                            textAlign: data.textAlign,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            wordBreak: 'break-word',
                            fontFamily: isPlainTextVariant ? handwritingFontFamily : undefined,
                        }}
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
        prevProps.data.variant === nextProps.data.variant &&
        prevProps.data.isDraft === nextProps.data.isDraft &&
        prevProps.data.hasBackground === nextProps.data.hasBackground &&
        prevProps.data.highlights === nextProps.data.highlights &&
        prevProps.data.marks === nextProps.data.marks &&
        prevProps.dragging === nextProps.dragging
    );
});

TextNode.displayName = 'TextNode';

export default TextNode;
