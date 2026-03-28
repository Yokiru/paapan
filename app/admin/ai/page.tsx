'use client';

import { MouseEvent, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { fetchAdminJson } from '@/lib/adminClient';

type DailyMetricPoint = {
    date: string;
    label: string;
    value: number;
};

type AdminAIResponse = {
    trackingEnabled: boolean;
    stats: {
        requests30d: number;
        successRate: number;
        aiUsers30d: number;
        byokRequests30d: number;
        byokUsers30d: number;
        validationSuccesses30d: number;
        validationFailures30d: number;
        byokAdoptionRate: number;
        uploadFailures30d: number;
    };
    charts: {
        requests30d: DailyMetricPoint[];
        byok30d: DailyMetricPoint[];
        failures30d: DailyMetricPoint[];
    };
    topModels: Array<{
        modelId: string;
        count: number;
    }>;
    topActions: Array<{
        actionType: string;
        count: number;
    }>;
    topErrors: Array<{
        code: string;
        count: number;
    }>;
};

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

function MetricCard({
    title,
    value,
    hint,
}: {
    title: string;
    value: string;
    hint?: string;
}) {
    return (
        <div className="rounded-3xl bg-zinc-50/90 p-6">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-900">{value}</p>
            {hint ? <p className="mt-2 text-xs font-medium text-zinc-400">{hint}</p> : null}
        </div>
    );
}

function CompactStat({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl bg-white px-4 py-4">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-zinc-900">{value}</p>
        </div>
    );
}

function AIChart({
    title,
    points,
}: {
    title: string;
    points: DailyMetricPoint[];
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const chartWidth = 640;
    const chartHeight = 260;
    const paddingTop = 20;
    const paddingRight = 16;
    const paddingBottom = 34;
    const paddingLeft = 36;
    const innerWidth = chartWidth - paddingLeft - paddingRight;
    const innerHeight = chartHeight - paddingTop - paddingBottom;
    const maxValue = Math.max(...points.map((point) => point.value), 1);
    const stepX = points.length > 1 ? innerWidth / (points.length - 1) : innerWidth;

    const coordinates = points.map((point, index) => {
        const x = paddingLeft + stepX * index;
        const y = paddingTop + innerHeight - (point.value / maxValue) * innerHeight;
        return { x, y, value: point.value, label: point.label, date: point.date };
    });

    const linePath = coordinates
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    const areaPath = coordinates.length
        ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${paddingTop + innerHeight} L ${coordinates[0].x} ${paddingTop + innerHeight} Z`
        : '';
    const hoveredPoint = hoveredIndex !== null ? coordinates[hoveredIndex] : null;
    const tooltipLeft = hoveredPoint ? Math.min(hoveredPoint.x + 20, chartWidth - 160) : 0;
    const tooltipTop = hoveredPoint ? Math.max(hoveredPoint.y - 50, 18) : 0;

    const yTicks = Array.from({ length: 3 }, (_, index) => {
        const value = Math.round((maxValue / 2) * (2 - index));
        const y = paddingTop + (innerHeight / 2) * index;
        return { value, y };
    });

    const handlePointerMove = (event: MouseEvent<SVGSVGElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const relativeX = ((event.clientX - rect.left) / rect.width) * chartWidth;
        const nearestIndex = coordinates.reduce(
            (bestIndex, point, index) => {
                const currentDistance = Math.abs(point.x - relativeX);
                const bestDistance = Math.abs(coordinates[bestIndex].x - relativeX);
                return currentDistance < bestDistance ? index : bestIndex;
            },
            0
        );

        setHoveredIndex(nearestIndex);
    };

    return (
        <section className="rounded-3xl bg-zinc-50/80 p-6">
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
                <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-500 shadow-sm">
                    30 hari
                </div>
            </div>

            <div className="relative mt-6 overflow-hidden">
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="h-[300px] w-full"
                    onMouseMove={handlePointerMove}
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    {yTicks.map((tick) => (
                        <g key={`${tick.value}-${tick.y}`}>
                            <line
                                x1={paddingLeft}
                                y1={tick.y}
                                x2={chartWidth - paddingRight}
                                y2={tick.y}
                                stroke="#e4e4e7"
                                strokeWidth="1"
                            />
                            <text
                                x={paddingLeft - 10}
                                y={tick.y + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill="#a1a1aa"
                            >
                                {tick.value}
                            </text>
                        </g>
                    ))}

                    {areaPath ? <path d={areaPath} fill="url(#admin-ai-fill)" opacity="0.95" /> : null}

                    {linePath ? (
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2.5"
                            strokeDasharray="7 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}

                    {hoveredPoint ? (
                        <>
                            <line
                                x1={hoveredPoint.x}
                                y1={paddingTop}
                                x2={hoveredPoint.x}
                                y2={paddingTop + innerHeight}
                                stroke="#d4d4d8"
                                strokeWidth="1.5"
                            />
                            <circle
                                cx={hoveredPoint.x}
                                cy={hoveredPoint.y}
                                r="4.5"
                                fill="#2563eb"
                                stroke="#ffffff"
                                strokeWidth="2"
                            />
                        </>
                    ) : null}

                    <defs>
                        <linearGradient id="admin-ai-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                </svg>

                {hoveredPoint ? (
                    <div
                        className="pointer-events-none absolute z-10 rounded-2xl bg-white px-4 py-3 shadow-md"
                        style={{
                            left: `${(tooltipLeft / chartWidth) * 100}%`,
                            top: `${(tooltipTop / chartHeight) * 300}px`,
                            transform: 'translateX(-10%)',
                        }}
                    >
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                            <span>{title}</span>
                            <span>{hoveredPoint.value}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-zinc-500">{hoveredPoint.label}</p>
                    </div>
                ) : null}

                <div className="grid grid-cols-6 gap-2 px-2 py-3 text-[11px] font-medium text-zinc-400 sm:grid-cols-10 lg:grid-cols-15">
                    {points.map((point) => (
                        <span key={point.date} className="truncate text-center">
                            {point.label}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function AdminAIPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [payload, setPayload] = useState<AdminAIResponse | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            try {
                const data = await fetchAdminJson<AdminAIResponse>('/api/admin/ai');
                if (!mounted) return;
                setPayload(data);
                setState('ready');
            } catch (error) {
                if (!mounted) return;
                if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                    setState('unauthorized');
                    return;
                }
                console.error('[Admin] Failed to load AI data:', error);
                setState('error');
            }
        };

        loadData();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AdminShell>
            {state === 'loading' ? (
                <div className="rounded-3xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                    Memuat AI...
                </div>
            ) : null}

            {state === 'unauthorized' ? (
                <div className="rounded-3xl bg-red-50 p-8 text-center">
                    <h2 className="text-lg font-bold text-red-900">Akses admin ditolak</h2>
                    <p className="mt-2 text-sm leading-6 text-red-700">
                        Halaman ini hanya tersedia untuk akun admin yang diizinkan.
                    </p>
                </div>
            ) : null}

            {state === 'error' ? (
                <div className="rounded-3xl bg-amber-50 p-8 text-center">
                    <h2 className="text-lg font-bold text-amber-900">Data AI belum bisa dimuat</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                        Coba refresh halaman atau cek koneksi Supabase.
                    </p>
                </div>
            ) : null}

            {state === 'ready' && payload ? (
                <div className="space-y-8">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Permintaan AI" value={payload.stats.requests30d.toLocaleString('id-ID')} hint="30 hari" />
                        <MetricCard title="Pengguna AI" value={payload.stats.aiUsers30d.toLocaleString('id-ID')} hint="pengguna unik" />
                        <MetricCard title="Permintaan BYOK" value={payload.stats.byokRequests30d.toLocaleString('id-ID')} hint={`${payload.stats.byokUsers30d.toLocaleString('id-ID')} pengguna`} />
                        <MetricCard title="Tingkat Berhasil" value={formatPercent(payload.stats.successRate)} hint={`${payload.stats.uploadFailures30d.toLocaleString('id-ID')} upload gagal`} />
                    </section>

                    {!payload.trackingEnabled ? (
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Tracking belum aktif</h2>
                            <p className="mt-2 text-sm text-zinc-500">
                                Jalankan SQL `ai_events` dulu agar request AI dan validasi BYOK mulai tercatat ke admin.
                            </p>
                        </section>
                    ) : (
                        <>
                            <section className="grid gap-6 xl:grid-cols-2">
                                <AIChart title="Permintaan AI" points={payload.charts.requests30d} />
                                <AIChart title="Permintaan BYOK" points={payload.charts.byok30d} />
                            </section>

                            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                                <AIChart title="Gangguan AI" points={payload.charts.failures30d} />

                                <section className="rounded-3xl bg-zinc-50/80 p-6">
                                    <h2 className="text-lg font-bold text-zinc-900">Model Teratas</h2>

                                    <div className="mt-5 space-y-3">
                                        {payload.topModels.length === 0 ? (
                                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-zinc-500">
                                                Belum ada model usage.
                                            </div>
                                        ) : (
                                            payload.topModels.map((item) => (
                                                <div
                                                    key={item.modelId}
                                                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                                >
                                                    <p className="truncate pr-4 text-sm font-semibold text-zinc-900">
                                                        {item.modelId}
                                                    </p>
                                                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                                                        {item.count.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="mt-6 grid gap-4">
                                        <CompactStat
                                            label="Validasi Berhasil"
                                            value={payload.stats.validationSuccesses30d.toLocaleString('id-ID')}
                                        />
                                        <CompactStat
                                            label="Validasi Gagal"
                                            value={payload.stats.validationFailures30d.toLocaleString('id-ID')}
                                        />
                                        <CompactStat
                                            label="Adopsi BYOK"
                                            value={formatPercent(payload.stats.byokAdoptionRate)}
                                        />
                                    </div>
                                </section>
                            </section>

                            <section className="grid gap-6 xl:grid-cols-2">
                                <section className="rounded-3xl bg-zinc-50/80 p-6">
                                    <h2 className="text-lg font-bold text-zinc-900">Permintaan Teratas</h2>

                                    <div className="mt-5 space-y-3">
                                        {payload.topActions.length === 0 ? (
                                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-zinc-500">
                                                Belum ada action usage.
                                            </div>
                                        ) : (
                                            payload.topActions.map((item) => (
                                                <div
                                                    key={item.actionType}
                                                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                                >
                                                    <p className="truncate pr-4 text-sm font-semibold text-zinc-900">
                                                        {item.actionType}
                                                    </p>
                                                    <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                                                        {item.count.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>

                                <section className="rounded-3xl bg-zinc-50/80 p-6">
                                    <h2 className="text-lg font-bold text-zinc-900">Kendala Teratas</h2>

                                    <div className="mt-5 space-y-3">
                                        {payload.topErrors.length === 0 ? (
                                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-zinc-500">
                                                Belum ada error yang tercatat.
                                            </div>
                                        ) : (
                                            payload.topErrors.map((item) => (
                                                <div
                                                    key={item.code}
                                                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                                >
                                                    <p className="truncate pr-4 text-sm font-semibold text-zinc-900">
                                                        {item.code}
                                                    </p>
                                                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-700">
                                                        {item.count.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            </section>
                        </>
                    )}
                </div>
            ) : null}
        </AdminShell>
    );
}
