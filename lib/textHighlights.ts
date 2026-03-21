"use client";

import { PastelColor, TextHighlight } from '@/types';

type SelectionRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export interface TextSelectionSnapshot {
    start: number;
    end: number;
    text: string;
    rect: SelectionRect;
}

export const TEXT_HIGHLIGHT_COLORS: Record<PastelColor, { fill: string; ring: string; label: string }> = {
    'pastel-blue': { fill: 'rgba(147, 197, 253, 0.45)', ring: '#60a5fa', label: 'Blue highlight' },
    'pastel-green': { fill: 'rgba(110, 231, 183, 0.45)', ring: '#34d399', label: 'Green highlight' },
    'pastel-pink': { fill: 'rgba(253, 164, 175, 0.45)', ring: '#fb7185', label: 'Pink highlight' },
    'pastel-lavender': { fill: 'rgba(196, 181, 253, 0.5)', ring: '#a78bfa', label: 'Lavender highlight' },
};

export const TEXT_HIGHLIGHT_ORDER = Object.keys(TEXT_HIGHLIGHT_COLORS) as PastelColor[];

const createHighlightId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const shouldIgnoreTextNode = (node: Node) => {
    const parentElement = node.parentElement;
    return !!parentElement?.closest('[data-text-highlight-ignore="true"]');
};

const getSelectableText = (root: ParentNode) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return node.textContent && node.textContent.length > 0 && !shouldIgnoreTextNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });

    let text = '';
    let currentNode = walker.nextNode();

    while (currentNode) {
        text += currentNode.textContent ?? '';
        currentNode = walker.nextNode();
    }

    return text;
};

const getRangeTextLength = (range: Range) => {
    return getSelectableText(range.cloneContents()).length;
};

const getOffsetFromPoint = (root: HTMLElement, container: Node, offset: number) => {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(container, offset);
    return getRangeTextLength(range);
};

const getSelectionRect = (range: Range, fallbackRect: DOMRect): SelectionRect => {
    const rect = range.getBoundingClientRect();
    const finalRect = rect.width === 0 && rect.height === 0 ? fallbackRect : rect;

    return {
        top: finalRect.top,
        left: finalRect.left,
        width: finalRect.width,
        height: finalRect.height,
    };
};

const normalizeRange = (start: number, end: number) => {
    if (start <= end) return { start, end };
    return { start: end, end: start };
};

const getTextNodesWithOffsets = (root: HTMLElement) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            return node.textContent && node.textContent.length > 0
                && !shouldIgnoreTextNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        },
    });

    const nodes: Array<{ node: Node; start: number; end: number }> = [];
    let traversed = 0;
    let currentNode = walker.nextNode();

    while (currentNode) {
        const length = currentNode.textContent?.length ?? 0;
        nodes.push({
            node: currentNode,
            start: traversed,
            end: traversed + length,
        });
        traversed += length;
        currentNode = walker.nextNode();
    }

    return nodes;
};

const unwrapExistingHighlights = (root: HTMLElement) => {
    const wrappers = root.querySelectorAll('[data-text-highlight="true"]');

    wrappers.forEach((wrapper) => {
        const parent = wrapper.parentNode;
        if (!parent) return;

        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, wrapper);
        }

        parent.removeChild(wrapper);
        parent.normalize();
    });
};

export const clearTextSelection = () => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
};

export const getTextSelectionSnapshot = (root: HTMLElement): TextSelectionSnapshot | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

    const start = getOffsetFromPoint(root, range.startContainer, range.startOffset);
    const end = getOffsetFromPoint(root, range.endContainer, range.endOffset);
    const normalized = normalizeRange(start, end);
    const text = getSelectableText(range.cloneContents()) || selection.toString();

    if (!text.trim() || normalized.start === normalized.end) return null;

    return {
        ...normalized,
        text,
        rect: getSelectionRect(range, root.getBoundingClientRect()),
    };
};

export const selectAllTextInElement = (root: HTMLElement): TextSelectionSnapshot | null => {
    const range = document.createRange();
    range.selectNodeContents(root);

    const selection = window.getSelection();
    if (!selection) return null;

    selection.removeAllRanges();
    selection.addRange(range);

    const text = getSelectableText(root);
    if (!text.trim()) return null;

    return {
        start: 0,
        end: text.length,
        text,
        rect: getSelectionRect(range, root.getBoundingClientRect()),
    };
};

export const upsertTextHighlight = (
    highlights: TextHighlight[] | undefined,
    nextRange: Pick<TextHighlight, 'start' | 'end' | 'color'>,
) => {
    const normalizedRange = normalizeRange(nextRange.start, nextRange.end);
    if (normalizedRange.start === normalizedRange.end) {
        return highlights ?? [];
    }

    const remainingHighlights = (highlights ?? []).filter((highlight) => (
        highlight.end <= normalizedRange.start || highlight.start >= normalizedRange.end
    ));

    return [...remainingHighlights, {
        id: createHighlightId(),
        start: normalizedRange.start,
        end: normalizedRange.end,
        color: nextRange.color,
    }].sort((a, b) => a.start - b.start);
};

export const applyTextHighlights = (root: HTMLElement, highlights: TextHighlight[] | undefined) => {
    unwrapExistingHighlights(root);

    if (!highlights || highlights.length === 0) return;

    const sortedHighlights = [...highlights]
        .filter((highlight) => highlight.end > highlight.start)
        .sort((a, b) => b.start - a.start);

    sortedHighlights.forEach((highlight) => {
        getTextNodesWithOffsets(root)
            .filter(({ start, end }) => end > highlight.start && start < highlight.end)
            .reverse()
            .forEach(({ node, start }) => {
                const localStart = Math.max(highlight.start, start) - start;
                const localEnd = Math.min(highlight.end, start + (node.textContent?.length ?? 0)) - start;

                if (localEnd <= localStart) return;

                const range = document.createRange();
                range.setStart(node, localStart);
                range.setEnd(node, localEnd);

                if (range.collapsed) return;

                const wrapper = document.createElement('mark');
                wrapper.dataset.textHighlight = 'true';
                wrapper.style.backgroundColor = TEXT_HIGHLIGHT_COLORS[highlight.color].fill;
                wrapper.style.color = 'inherit';
                wrapper.style.borderRadius = '0.35rem';
                wrapper.style.padding = '0 0.08em';
                wrapper.style.boxDecorationBreak = 'clone';
                (wrapper.style as CSSStyleDeclaration & { webkitBoxDecorationBreak?: string }).webkitBoxDecorationBreak = 'clone';

                const fragment = range.extractContents();
                wrapper.appendChild(fragment);
                range.insertNode(wrapper);
            });
    });
};
