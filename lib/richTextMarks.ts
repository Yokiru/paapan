"use client";

import { PastelColor, TextHighlight, TextMark, TextNodeData } from '@/types';
import { sanitizeTextLinkUrl } from './textLinkUrl';

export type TextMarkStyle = Omit<TextMark, 'id' | 'start' | 'end'>;
export type RichTextFontSize = TextNodeData['fontSize'];

export type RichTextSegment = {
    start: number;
    end: number;
    text: string;
    style: TextMarkStyle;
};

type TextRange = {
    start: number;
    end: number;
};

type ReplaceTextResult = {
    content: string;
    marks: TextMark[];
    selectionStart: number;
    selectionEnd: number;
};

const createMarkId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `mark-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeRange = ({ start, end }: TextRange): TextRange => (
    start <= end ? { start, end } : { start: end, end: start }
);

const isMarkStyleEmpty = (style: TextMarkStyle) => (
    !style.bold
    && !style.italic
    && !style.underline
    && !style.fontSize
    && !style.highlightColor
    && !style.linkHref
);

const cloneStyle = (style: TextMarkStyle): TextMarkStyle => ({ ...style });

const areStylesEqual = (left: TextMarkStyle, right: TextMarkStyle) => (
    left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.fontSize === right.fontSize
    && left.highlightColor === right.highlightColor
    && left.linkHref === right.linkHref
);

const buildBoundaries = (contentLength: number, marks: TextMark[], extraBoundaries: number[] = []) => {
    const boundarySet = new Set<number>([0, contentLength]);

    marks.forEach((mark) => {
        boundarySet.add(Math.max(0, Math.min(contentLength, mark.start)));
        boundarySet.add(Math.max(0, Math.min(contentLength, mark.end)));
    });

    extraBoundaries.forEach((boundary) => {
        boundarySet.add(Math.max(0, Math.min(contentLength, boundary)));
    });

    return [...boundarySet].sort((a, b) => a - b);
};

const getStyleAtOffset = (marks: TextMark[], offset: number): TextMarkStyle => {
    const match = marks.find((mark) => mark.start <= offset && mark.end > offset);
    if (!match) return {};

    return {
        bold: match.bold,
        italic: match.italic,
        underline: match.underline,
        fontSize: match.fontSize,
        highlightColor: match.highlightColor,
        linkHref: match.linkHref,
    };
};

const marksFromSegments = (segments: Array<{ start: number; end: number; style: TextMarkStyle }>) => {
    const merged: TextMark[] = [];

    segments.forEach((segment) => {
        if (segment.end <= segment.start || isMarkStyleEmpty(segment.style)) return;

        const previous = merged[merged.length - 1];
        if (previous && previous.end === segment.start && areStylesEqual(previous, segment.style)) {
            previous.end = segment.end;
            return;
        }

        merged.push({
            id: createMarkId(),
            start: segment.start,
            end: segment.end,
            ...segment.style,
        });
    });

    return merged;
};

const getSegmentsForRange = (content: string, marks: TextMark[], extraBoundaries: number[] = []): RichTextSegment[] => {
    const normalizedMarks = normalizeTextMarks(marks);
    const boundaries = buildBoundaries(content.length, normalizedMarks, extraBoundaries);
    const segments: RichTextSegment[] = [];

    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const start = boundaries[index];
        const end = boundaries[index + 1];

        if (end <= start) continue;

        segments.push({
            start,
            end,
            text: content.slice(start, end),
            style: getStyleAtOffset(normalizedMarks, start),
        });
    }

    return segments;
};

const withUpdatedStylesInRange = (
    contentLength: number,
    marks: TextMark[] | undefined,
    range: TextRange,
    updater: (style: TextMarkStyle) => TextMarkStyle,
) => {
    const normalizedRange = normalizeRange(range);
    if (normalizedRange.start === normalizedRange.end) {
        return normalizeTextMarks(marks);
    }

    const segments = getSegmentsForRange(
        ' '.repeat(contentLength),
        normalizeTextMarks(marks),
        [normalizedRange.start, normalizedRange.end],
    );

    return marksFromSegments(segments.map((segment) => {
        const intersects = segment.start < normalizedRange.end && segment.end > normalizedRange.start;
        if (!intersects) {
            return { start: segment.start, end: segment.end, style: segment.style };
        }

        return {
            start: segment.start,
            end: segment.end,
            style: updater(cloneStyle(segment.style)),
        };
    }));
};

export const normalizeTextMarks = (
    marks?: TextMark[] | null,
    highlights?: TextHighlight[] | null,
) => {
    if (marks && marks.length > 0) {
        const normalized = [...marks]
            .filter((mark) => mark.end > mark.start)
            .sort((a, b) => a.start - b.start)
            .map((mark) => ({
                id: mark.id || createMarkId(),
                start: mark.start,
                end: mark.end,
                bold: mark.bold,
                italic: mark.italic,
                underline: mark.underline,
                fontSize: mark.fontSize,
                highlightColor: mark.highlightColor,
                linkHref: mark.linkHref,
            }));

        return marksFromSegments(normalized.map((mark) => ({
            start: mark.start,
            end: mark.end,
                style: {
                    bold: mark.bold,
                    italic: mark.italic,
                    underline: mark.underline,
                    fontSize: mark.fontSize,
                    highlightColor: mark.highlightColor,
                    linkHref: mark.linkHref,
                },
            })));
    }

    if (highlights && highlights.length > 0) {
        return marksFromSegments(highlights
            .filter((highlight) => highlight.end > highlight.start)
            .sort((a, b) => a.start - b.start)
            .map((highlight) => ({
                start: highlight.start,
                end: highlight.end,
                style: { highlightColor: highlight.color },
            })));
    }

    return [];
};

export const buildRichTextSegments = (content: string, marks?: TextMark[] | null, highlights?: TextHighlight[] | null) => {
    const normalizedMarks = normalizeTextMarks(marks, highlights);
    return getSegmentsForRange(content, normalizedMarks);
};

export const getTextMarkSelectionState = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    defaultFontSize: RichTextFontSize,
) => {
    const normalizedRange = normalizeRange(range);
    const segments = getSegmentsForRange(content, normalizeTextMarks(marks), [normalizedRange.start, normalizedRange.end])
        .filter((segment) => segment.start < normalizedRange.end && segment.end > normalizedRange.start);

    if (segments.length === 0) {
        return {
            bold: false,
            italic: false,
            underline: false,
            fontSize: defaultFontSize,
        };
    }

    const fontSizes = new Set(segments.map((segment) => segment.style.fontSize || defaultFontSize));
    const linkHrefs = new Set(
        segments
            .map((segment) => segment.style.linkHref?.trim() || '')
            .filter(Boolean),
    );
    const hasFullLinkCoverage = segments.every((segment) => !!segment.style.linkHref);

    return {
        bold: segments.every((segment) => !!segment.style.bold),
        italic: segments.every((segment) => !!segment.style.italic),
        underline: segments.every((segment) => !!segment.style.underline),
        fontSize: fontSizes.size === 1 ? [...fontSizes][0] : defaultFontSize,
        linkHref: hasFullLinkCoverage && linkHrefs.size === 1 ? [...linkHrefs][0] : '',
    };
};

type ParsedRichTextContent = {
    content: string;
    marks: TextMark[];
};

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);

export const parseHtmlToRichText = (html: string): ParsedRichTextContent => {
    if (typeof DOMParser === 'undefined') {
        return { content: '', marks: [] };
    }

    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(html, 'text/html');
    let content = '';
    const segments: Array<{ start: number; end: number; style: TextMarkStyle }> = [];

    const appendText = (value: string, style: TextMarkStyle) => {
        const normalizedText = value.replace(/\u00a0/g, ' ');
        if (!normalizedText) return;

        const start = content.length;
        content += normalizedText;
        const end = content.length;

        if (!isMarkStyleEmpty(style)) {
            segments.push({
                start,
                end,
                style: cloneStyle(style),
            });
        }
    };

    const appendNewlineIfNeeded = () => {
        if (!content.endsWith('\n')) {
            content += '\n';
        }
    };

    const visitNode = (node: Node, inheritedStyle: TextMarkStyle = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
            appendText(node.textContent ?? '', inheritedStyle);
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = node as HTMLElement;
        const tagName = element.tagName.toUpperCase();

        if (tagName === 'BR') {
            appendNewlineIfNeeded();
            return;
        }

        const nextStyle = cloneStyle(inheritedStyle);

        if (tagName === 'STRONG' || tagName === 'B') {
            nextStyle.bold = true;
        } else if (tagName === 'EM' || tagName === 'I') {
            nextStyle.italic = true;
        } else if (tagName === 'U') {
            nextStyle.underline = true;
        } else if (tagName === 'A') {
            const safeHref = sanitizeTextLinkUrl(element.getAttribute('href') ?? '');
            if (safeHref) {
                nextStyle.linkHref = safeHref;
            }
        }

        const isBlock = BLOCK_TAGS.has(tagName);
        const beforeLength = content.length;

        if (isBlock && beforeLength > 0 && !content.endsWith('\n')) {
            appendNewlineIfNeeded();
        }

        Array.from(element.childNodes).forEach((childNode) => {
            visitNode(childNode, nextStyle);
        });

        if (isBlock && content.length > beforeLength && !content.endsWith('\n')) {
            appendNewlineIfNeeded();
        }
    };

    Array.from(documentFragment.body.childNodes).forEach((childNode) => {
        visitNode(childNode);
    });

    const trimmedContent = content.replace(/\n+$/g, '');
    const trimmedLength = trimmedContent.length;
    const trimmedSegments = segments
        .map((segment) => ({
            ...segment,
            end: Math.min(segment.end, trimmedLength),
        }))
        .filter((segment) => segment.end > segment.start);

    return {
        content: trimmedContent,
        marks: marksFromSegments(trimmedSegments),
    };
};

export const toggleTextMarkStyle = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    key: 'bold' | 'italic' | 'underline',
) => {
    const normalizedMarks = normalizeTextMarks(marks);
    const normalizedRange = normalizeRange(range);
    const segments = getSegmentsForRange(content, normalizedMarks, [normalizedRange.start, normalizedRange.end])
        .filter((segment) => segment.start < normalizedRange.end && segment.end > normalizedRange.start);
    const shouldEnable = !segments.every((segment) => !!segment.style[key]);

    return withUpdatedStylesInRange(content.length, normalizedMarks, normalizedRange, (style) => {
        if (shouldEnable) {
            style[key] = true;
        } else {
            delete style[key];
        }
        return style;
    });
};

export const applyTextMarkFontSize = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    fontSize: RichTextFontSize,
) => withUpdatedStylesInRange(content.length, marks, range, (style) => ({
    ...style,
    fontSize,
}));

export const applyTextMarkHighlight = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    color: PastelColor,
) => withUpdatedStylesInRange(content.length, marks, range, (style) => ({
    ...style,
    highlightColor: color,
}));

export const applyTextMarkLink = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    href: string | null,
) => withUpdatedStylesInRange(content.length, marks, range, (style) => {
    const safeHref = href ? sanitizeTextLinkUrl(href) : '';
    if (safeHref) {
        return {
            ...style,
            linkHref: safeHref,
        };
    }

    const nextStyle = { ...style };
    delete nextStyle.linkHref;
    return nextStyle;
});

export const replaceTextInContentAndMarks = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    insertedText: string,
) : ReplaceTextResult => {
    const normalizedRange = normalizeRange(range);
    const normalizedMarks = normalizeTextMarks(marks);
    const nextContent = `${content.slice(0, normalizedRange.start)}${insertedText}${content.slice(normalizedRange.end)}`;
    const inheritedStyle = cloneStyle(getStyleAtOffset(normalizedMarks, normalizedRange.start));
    const delta = insertedText.length - (normalizedRange.end - normalizedRange.start);
    const nextSegments: Array<{ start: number; end: number; style: TextMarkStyle }> = [];

    normalizedMarks.forEach((mark) => {
        const style = {
            bold: mark.bold,
            italic: mark.italic,
            underline: mark.underline,
            fontSize: mark.fontSize,
            highlightColor: mark.highlightColor,
            linkHref: mark.linkHref,
        };

        if (mark.end <= normalizedRange.start) {
            nextSegments.push({ start: mark.start, end: mark.end, style });
            return;
        }

        if (mark.start >= normalizedRange.end) {
            nextSegments.push({
                start: mark.start + delta,
                end: mark.end + delta,
                style,
            });
            return;
        }

        if (mark.start < normalizedRange.start) {
            nextSegments.push({
                start: mark.start,
                end: normalizedRange.start,
                style,
            });
        }

        if (mark.end > normalizedRange.end) {
            nextSegments.push({
                start: normalizedRange.start + insertedText.length,
                end: normalizedRange.start + insertedText.length + (mark.end - normalizedRange.end),
                style,
            });
        }
    });

    if (insertedText.length > 0 && !isMarkStyleEmpty(inheritedStyle)) {
        nextSegments.push({
            start: normalizedRange.start,
            end: normalizedRange.start + insertedText.length,
            style: inheritedStyle,
        });
    }

    const nextMarks = marksFromSegments(nextSegments.sort((left, right) => left.start - right.start));
    const caretPosition = normalizedRange.start + insertedText.length;

    return {
        content: nextContent,
        marks: nextMarks,
        selectionStart: caretPosition,
        selectionEnd: caretPosition,
    };
};

export const replaceStructuredTextInContentAndMarks = (
    content: string,
    marks: TextMark[] | undefined,
    range: TextRange,
    insertedContent: string,
    insertedMarks?: TextMark[] | undefined,
): ReplaceTextResult => {
    const normalizedRange = normalizeRange(range);
    const normalizedMarks = normalizeTextMarks(marks);
    const normalizedInsertedMarks = normalizeTextMarks(insertedMarks);
    const nextContent = `${content.slice(0, normalizedRange.start)}${insertedContent}${content.slice(normalizedRange.end)}`;
    const inheritedStyle = cloneStyle(getStyleAtOffset(normalizedMarks, normalizedRange.start));
    const delta = insertedContent.length - (normalizedRange.end - normalizedRange.start);
    const nextSegments: Array<{ start: number; end: number; style: TextMarkStyle }> = [];

    normalizedMarks.forEach((mark) => {
        const style = {
            bold: mark.bold,
            italic: mark.italic,
            underline: mark.underline,
            fontSize: mark.fontSize,
            highlightColor: mark.highlightColor,
            linkHref: mark.linkHref,
        };

        if (mark.end <= normalizedRange.start) {
            nextSegments.push({ start: mark.start, end: mark.end, style });
            return;
        }

        if (mark.start >= normalizedRange.end) {
            nextSegments.push({
                start: mark.start + delta,
                end: mark.end + delta,
                style,
            });
            return;
        }

        if (mark.start < normalizedRange.start) {
            nextSegments.push({
                start: mark.start,
                end: normalizedRange.start,
                style,
            });
        }

        if (mark.end > normalizedRange.end) {
            nextSegments.push({
                start: normalizedRange.start + insertedContent.length,
                end: normalizedRange.start + insertedContent.length + (mark.end - normalizedRange.end),
                style,
            });
        }
    });

    if (insertedContent.length > 0) {
        if (normalizedInsertedMarks.length > 0) {
            normalizedInsertedMarks.forEach((mark) => {
                nextSegments.push({
                    start: normalizedRange.start + mark.start,
                    end: normalizedRange.start + mark.end,
                    style: {
                        bold: mark.bold,
                        italic: mark.italic,
                        underline: mark.underline,
                        fontSize: mark.fontSize,
                        highlightColor: mark.highlightColor,
                        linkHref: mark.linkHref,
                    },
                });
            });
        } else if (!isMarkStyleEmpty(inheritedStyle)) {
            nextSegments.push({
                start: normalizedRange.start,
                end: normalizedRange.start + insertedContent.length,
                style: inheritedStyle,
            });
        }
    }

    const nextMarks = marksFromSegments(nextSegments.sort((left, right) => left.start - right.start));
    const caretPosition = normalizedRange.start + insertedContent.length;

    return {
        content: nextContent,
        marks: nextMarks,
        selectionStart: caretPosition,
        selectionEnd: caretPosition,
    };
};

export const setSelectionByOffsets = (root: HTMLElement, start: number, end: number) => {
    const selection = window.getSelection();
    if (!selection) return;

    const textNodes = getTextNodesWithOffsets(root);

    if (textNodes.length === 0) {
        selection.removeAllRanges();
        return;
    }

    const totalLength = textNodes[textNodes.length - 1].end;
    const normalized = normalizeRange({
        start: Math.max(0, Math.min(totalLength, start)),
        end: Math.max(0, Math.min(totalLength, end)),
    });

    const resolveTextPosition = (offset: number) => {
        const exactNextNode = textNodes.find(({ start: nodeStart }) => offset === nodeStart);
        const match = exactNextNode
            ?? textNodes.find(({ start: nodeStart, end: nodeEnd }) => offset >= nodeStart && offset <= nodeEnd)
            ?? textNodes[textNodes.length - 1];
        const nodeLength = match.node.textContent?.length ?? 0;

        return {
            node: match.node,
            offset: Math.max(0, Math.min(nodeLength, offset - match.start)),
        };
    };

    const range = document.createRange();
    const startPosition = resolveTextPosition(normalized.start);
    const endPosition = resolveTextPosition(normalized.end);

    try {
        if (!startPosition.node.isConnected || !endPosition.node.isConnected) {
            selection.removeAllRanges();
            return;
        }

        range.setStart(startPosition.node, getClampedDomOffset(startPosition.node, startPosition.offset));
        range.setEnd(endPosition.node, getClampedDomOffset(endPosition.node, endPosition.offset));

        selection.removeAllRanges();
        selection.addRange(range);
    } catch {
        const fallbackNode = textNodes[textNodes.length - 1];
        const fallbackLength = fallbackNode.node.textContent?.length ?? 0;
        const fallbackRange = document.createRange();
        try {
            fallbackRange.setStart(fallbackNode.node, getClampedDomOffset(fallbackNode.node, fallbackLength));
            fallbackRange.setEnd(fallbackNode.node, getClampedDomOffset(fallbackNode.node, fallbackLength));
            selection.removeAllRanges();
            selection.addRange(fallbackRange);
        } catch {
            selection.removeAllRanges();
        }
    }
};

export const getPlainTextFromEditable = (root: HTMLElement) => root.textContent?.replace(/\u00a0/g, ' ') ?? '';

export const getCollapsedCaretOffset = (root: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    try {
        const range = selection.getRangeAt(0);
        if (!selection.isCollapsed || !root.contains(range.startContainer)) return null;

        return getTextSelectionOffset(root, range.startContainer, range.startOffset);
    } catch {
        return null;
    }
};

export const getEditableSelectionRange = (root: HTMLElement): TextRange | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    try {
        const range = selection.getRangeAt(0);
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

        return normalizeRange({
            start: getTextSelectionOffset(root, range.startContainer, range.startOffset),
            end: getTextSelectionOffset(root, range.endContainer, range.endOffset),
        });
    } catch {
        return null;
    }
};

const getTextSelectionOffset = (root: HTMLElement, container: Node, offset: number) => {
    if (!container.isConnected || !root.contains(container)) {
        return getSelectableText(root).length;
    }

    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(container, getClampedDomOffset(container, offset));
    return getSelectableText(range.cloneContents()).length;
};

const getClampedDomOffset = (node: Node, offset: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
        const length = node.textContent?.length ?? 0;
        return Math.max(0, Math.min(length, offset));
    }

    return Math.max(0, Math.min(node.childNodes.length, offset));
};

const getSelectableText = (root: ParentNode) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = '';
    let currentNode = walker.nextNode();

    while (currentNode) {
        text += currentNode.textContent ?? '';
        currentNode = walker.nextNode();
    }

    return text;
};

const getTextNodesWithOffsets = (root: HTMLElement) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
