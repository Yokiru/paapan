'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import ReactFlow, { Background, Edge, Node, Position, ReactFlowInstance } from 'reactflow';

import { sanitizeCanvasImageSrc } from '@/lib/imageSecurity';
import { sanitizeTextLinkUrl } from '@/lib/textLinkUrl';
import {
    EXPORT_BACKGROUND_COLOR,
    EXPORT_DOT_COLOR,
    getWorkspaceExportRect,
} from '@/lib/workspaceExport';
import type {
    ArrowShape,
    CanvasNodeType,
    DrawingStroke,
    FrameRegion,
    ImageNodeData,
    MindNodeData,
    TextNodeData,
} from '@/types';

type SharedBoardPayload = {
    name: string;
    nodes: CanvasNodeType[];
    edges: Edge[];
    frames: FrameRegion[];
    strokes: DrawingStroke[];
    arrows: ArrowShape[];
    updatedAt: string;
    allowDuplicate: boolean;
};

interface SharedBoardClientProps {
    token: string;
}

type ViewportState = { x: number; y: number; zoom: number };

const handwritingFontFamily = '"Comic Sans MS", "Marker Felt", "Bradley Hand", cursive';

const strokeToPath = (stroke: DrawingStroke) => {
    if (!stroke.points.length) return '';

    return stroke.points.reduce((path, point, index) => {
        const [x, y] = point;
        return `${path}${index === 0 ? 'M' : 'L'}${x} ${y} `;
    }, '').trim();
};

function fitViewportToRect(
    rect: ReturnType<typeof getWorkspaceExportRect>,
    width: number,
    height: number
): ViewportState {
    if (!rect || width <= 0 || height <= 0) {
        return { x: 0, y: 0, zoom: 1 };
    }

    const padding = 80;
    const scaleX = (width - padding * 2) / Math.max(rect.width, 1);
    const scaleY = (height - padding * 2) / Math.max(rect.height, 1);
    const zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.12), 1.6);
    const x = width / 2 - (rect.x + rect.width / 2) * zoom;
    const y = height / 2 - (rect.y + rect.height / 2) * zoom;

    return { x, y, zoom };
}

function SharedMindNode({ data }: { data: MindNodeData }) {
    return (
        <div className="h-full w-full rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            {data.question ? (
                <h3 className="text-[15px] font-bold leading-6 text-slate-900">{data.question}</h3>
            ) : null}
            {data.response ? (
                <div className={`prose prose-sm max-w-none text-slate-700 ${data.question ? 'mt-3' : ''}`}>
                    <ReactMarkdown skipHtml urlTransform={(value) => sanitizeTextLinkUrl(value)}>
                        {data.response}
                    </ReactMarkdown>
                </div>
            ) : null}
        </div>
    );
}

function SharedTextNode({ data }: { data: TextNodeData }) {
    const sizeMap: Record<TextNodeData['fontSize'], string> = {
        small: 'text-2xl leading-tight',
        medium: 'text-[32px] leading-tight',
        large: 'text-[42px] leading-tight',
        xlarge: 'text-[52px] leading-none',
    };

    const hasBackground = data.variant !== 'plain' && data.hasBackground !== false;

    return (
        <div
            className={`h-full w-full ${
                data.variant === 'plain'
                    ? 'bg-transparent px-1 py-0'
                    : 'rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
            }`}
            style={{
                textAlign: data.textAlign,
                fontFamily: data.variant === 'plain' ? handwritingFontFamily : undefined,
            }}
        >
            <div
                className={`${sizeMap[data.fontSize] || sizeMap.medium} whitespace-pre-wrap break-words text-slate-900`}
                style={{
                    fontWeight: data.variant === 'plain' ? 700 : data.fontWeight === 'bold' ? 700 : 400,
                    minHeight: data.variant === 'plain' ? 28 : 96,
                    background: hasBackground ? '#F3F6FB' : 'transparent',
                    borderRadius: hasBackground ? 24 : 0,
                    padding: hasBackground ? '16px 18px' : 0,
                }}
            >
                {data.content}
            </div>
        </div>
    );
}

function SharedImageNode({ data }: { data: ImageNodeData }) {
    const safeImageSrc = sanitizeCanvasImageSrc(data.src);
    return (
        <div className="h-full w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            {safeImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={safeImageSrc} alt={data.title || data.fileName || 'Shared image'} className="h-[calc(100%-56px)] w-full object-cover" />
            ) : (
                <div className="flex h-[calc(100%-56px)] items-center justify-center bg-slate-100 text-sm text-slate-400">
                    Image unavailable
                </div>
            )}
            <div className="px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">
                    {data.title || data.fileName || 'Image'}
                </p>
            </div>
        </div>
    );
}

function SharedAIInputNode({ data }: { data: { inputValue?: string } }) {
    return (
        <div className="h-full w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <p className="text-[16px] leading-7 text-slate-700">{data.inputValue || 'AI prompt'}</p>
        </div>
    );
}

const nodeTypes = {
    mindNode: ({ data }: { data: MindNodeData }) => <SharedMindNode data={data} />,
    textNode: ({ data }: { data: TextNodeData }) => <SharedTextNode data={data} />,
    imageNode: ({ data }: { data: ImageNodeData }) => <SharedImageNode data={data} />,
    aiInput: ({ data }: { data: { inputValue?: string } }) => <SharedAIInputNode data={data} />,
};

export default function SharedBoardClient({ token }: SharedBoardClientProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
    const [board, setBoard] = useState<SharedBoardPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [viewport, setViewport] = useState<ViewportState>({ x: 0, y: 0, zoom: 1 });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setErrorMessage(null);

            try {
                const response = await fetch(`/api/public/board/${token}`);
                const payload = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(typeof payload?.error === 'string' ? payload.error : 'Board not found');
                }

                if (!cancelled) {
                    setBoard(payload.board as SharedBoardPayload);
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(error instanceof Error ? error.message : 'Failed to load board');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [token]);

    const preparedNodes = useMemo<Node[]>(() => {
        if (!board) return [];

        return board.nodes.map((node) => ({
            ...node,
            selected: false,
            draggable: false,
            connectable: false,
            deletable: false,
            sourcePosition: node.sourcePosition || Position.Bottom,
            targetPosition: node.targetPosition || Position.Top,
        })) as Node[];
    }, [board]);

    const preparedEdges = useMemo<Edge[]>(() => {
        if (!board) return [];

        return board.edges.map((edge) => ({
            ...edge,
            animated: false,
            updatable: false,
            selectable: false,
        }));
    }, [board]);

    useEffect(() => {
        if (!board || !containerRef.current) return;

        const recompute = () => {
            const rect = getWorkspaceExportRect({
                nodes: board.nodes,
                frames: board.frames,
                strokes: board.strokes,
                arrows: board.arrows,
            });

            const width = containerRef.current?.clientWidth || 0;
            const height = containerRef.current?.clientHeight || 0;
            const nextViewport = fitViewportToRect(rect, width, height);
            setViewport(nextViewport);
            void reactFlowInstanceRef.current?.setViewport(nextViewport);
        };

        recompute();

        const observer = new ResizeObserver(() => {
            recompute();
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [board]);

    return (
        <main className="min-h-screen bg-white" style={{ backgroundColor: EXPORT_BACKGROUND_COLOR }}>
            <div className="border-b border-slate-200 bg-white/92 backdrop-blur-xl">
                <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">Shared board</p>
                        <h1 className="mt-1 text-xl font-black text-slate-950">
                            {board?.name || 'Loading board'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            View only
                        </span>
                        <Link
                            href="/"
                            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            Open Paapan
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-5">
                {loading ? (
                    <div className="flex min-h-[70vh] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                            <div className="h-9 w-9 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
                            <p className="text-sm font-medium">Loading shared board...</p>
                        </div>
                    </div>
                ) : errorMessage || !board ? (
                    <div className="flex min-h-[70vh] items-center justify-center rounded-[32px] border border-rose-200 bg-rose-50">
                        <div className="max-w-md px-6 text-center">
                            <h2 className="text-xl font-bold text-rose-900">Board tidak tersedia</h2>
                            <p className="mt-2 text-sm leading-6 text-rose-800/80">
                                {errorMessage || 'Link share ini tidak aktif, tidak valid, atau sudah diganti.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                            <div className="text-sm text-slate-500">
                                Drag untuk geser, scroll untuk zoom
                            </div>
                            <div className="text-xs font-semibold text-slate-400">
                                Updated {new Date(board.updatedAt).toLocaleString('id-ID')}
                            </div>
                        </div>

                        <div
                            ref={containerRef}
                            className="relative h-[calc(100vh-170px)] min-h-[640px]"
                            style={{
                                backgroundColor: EXPORT_BACKGROUND_COLOR,
                                backgroundImage: `radial-gradient(circle, ${EXPORT_DOT_COLOR} 1.4px, transparent 1.6px)`,
                                backgroundSize: '25px 25px',
                            }}
                        >
                            <ReactFlow
                                nodes={preparedNodes}
                                edges={preparedEdges}
                                nodeTypes={nodeTypes}
                                nodesDraggable={false}
                                nodesConnectable={false}
                                elementsSelectable={false}
                                zoomOnScroll
                                zoomOnPinch
                                zoomOnDoubleClick={false}
                                panOnDrag
                                panOnScroll={false}
                                minZoom={0.08}
                                maxZoom={2.2}
                                proOptions={{ hideAttribution: true }}
                                fitView={false}
                                defaultViewport={viewport}
                                onInit={(instance) => {
                                    reactFlowInstanceRef.current = instance;
                                    void instance.setViewport(viewport);
                                }}
                                onMove={(_, nextViewport) => setViewport(nextViewport)}
                            >
                                <Background gap={25} size={2} color={EXPORT_DOT_COLOR} />
                            </ReactFlow>

                            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                <div
                                    className="absolute left-0 top-0 h-full w-full"
                                    style={{
                                        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                                        transformOrigin: '0 0',
                                    }}
                                >
                                    {board.frames.map((frame) => (
                                        <div
                                            key={frame.id}
                                            className="absolute rounded-[28px] border-2 border-dashed border-blue-300/90 bg-blue-50/18"
                                            style={{
                                                left: frame.x,
                                                top: frame.y,
                                                width: frame.width,
                                                height: frame.height,
                                            }}
                                        />
                                    ))}

                                    <svg
                                        className="absolute left-0 top-0 overflow-visible"
                                        width="1"
                                        height="1"
                                        viewBox="0 0 1 1"
                                        aria-hidden="true"
                                    >
                                        {board.strokes.map((stroke) => (
                                            <path
                                                key={stroke.id}
                                                d={strokeToPath(stroke)}
                                                fill="none"
                                                stroke={stroke.color}
                                                strokeWidth={stroke.size}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        ))}
                                        {board.arrows.map((arrow) => (
                                            <path
                                                key={arrow.id}
                                                d={`M ${arrow.start.x} ${arrow.start.y} Q ${arrow.control.x} ${arrow.control.y} ${arrow.end.x} ${arrow.end.y}`}
                                                fill="none"
                                                stroke={arrow.color}
                                                strokeWidth={arrow.size}
                                                strokeLinecap="round"
                                            />
                                        ))}
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
