'use client';

import { MouseEvent, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { fetchAdminJson } from '@/lib/adminClient';

type DailyMetricPoint = {
    date: string;
    label: string;
    value: number;
};

type GrowthResponse = {
    stats: {
        totalUsers: number;
        newUsers7d: number;
        activatedUsers: number;
        activationRate: number;
        paidUsers: number;
        paidConversionRate: number;
        dau: number;
        wau: number;
        mau: number;
        stickiness: number;
    };
    charts: {
        signups30d: DailyMetricPoint[];
        activations30d: DailyMetricPoint[];
        activeUsers30d: DailyMetricPoint[];
    };
    retention: {
        d1: {
            eligible: number;
            retained: number;
            rate: number;
        };
        d7: {
            eligible: number;
            retained: number;
            rate: number;
        };
        d30: {
            eligible: number;
            retained: number;
            rate: number;
        };
        cohorts: Array<{
            cohort: string;
            total: number;
            d1Rate: number;
            d7Rate: number;
            d30Rate: number;
        }>;
    };
};

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function GrowthCard({
    title,
    value,
    hint,
}: {
    title: string;
    value: string;
    hint: string;
}) {
    return (
        <div className="rounded-3xl bg-zinc-50/90 p-6">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-900">{value}</p>
            <p className="mt-2 text-xs font-medium text-zinc-400">{hint}</p>
        </div>
    );
}

function GrowthChart({
    title,
    points,
    rangeLabel = '30 hari',
}: {
    title: string;
    points: DailyMetricPoint[];
    rangeLabel?: string;
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
        return { x, y, value: point.value, label: point.label };
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
                    {rangeLabel}
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

                    {areaPath && (
                        <path d={areaPath} fill="url(#growth-chart-fill)" opacity="0.95" />
                    )}

                    {linePath && (
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="2.5"
                            strokeDasharray="7 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}

                    {hoveredPoint && (
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
                    )}

                    <defs>
                        <linearGradient id="growth-chart-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
                        </linearGradient>
                    </defs>
                </svg>

                {hoveredPoint && (
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
                )}

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

export default function AdminGrowthPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [growth, setGrowth] = useState<GrowthResponse | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadGrowth = async () => {
            try {
                const payload = await fetchAdminJson<GrowthResponse>('/api/admin/growth');
                if (!mounted) return;
                setGrowth(payload);
                setState('ready');
            } catch (error) {
                if (!mounted) return;
                if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                    setState('unauthorized');
                    return;
                }
                console.error('[Admin] Failed to load growth:', error);
                setState('error');
            }
        };

        loadGrowth();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AdminShell>
            {state === 'loading' && (
                <div className="rounded-3xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                    Memuat growth...
                </div>
            )}

            {state === 'unauthorized' && (
                <div className="rounded-3xl bg-red-50 p-8 text-center">
                    <h2 className="text-lg font-bold text-red-900">Akses admin ditolak</h2>
                    <p className="mt-2 text-sm leading-6 text-red-700">
                        Halaman ini hanya tersedia untuk akun admin yang diizinkan.
                    </p>
                </div>
            )}

            {state === 'error' && (
                <div className="rounded-3xl bg-amber-50 p-8 text-center">
                    <h2 className="text-lg font-bold text-amber-900">Growth belum bisa dimuat</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                        Coba refresh halaman atau cek koneksi Supabase.
                    </p>
                </div>
            )}

            {state === 'ready' && growth && (
                <div className="space-y-8">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <GrowthCard
                            title="Pengguna Baru 7 Hari"
                            value={growth.stats.newUsers7d.toLocaleString('id-ID')}
                            hint="akun baru"
                        />
                        <GrowthCard
                            title="Sudah Aktif"
                            value={growth.stats.activatedUsers.toLocaleString('id-ID')}
                            hint={formatPercent(growth.stats.activationRate)}
                        />
                        <GrowthCard
                            title="Konversi Berbayar"
                            value={formatPercent(growth.stats.paidConversionRate)}
                            hint={`${growth.stats.paidUsers.toLocaleString('id-ID')} pengguna`}
                        />
                        <GrowthCard
                            title="Keterikatan"
                            value={formatPercent(growth.stats.stickiness)}
                            hint={`Harian ${growth.stats.dau.toLocaleString('id-ID')} / 30 hari ${growth.stats.mau.toLocaleString('id-ID')}`}
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                        <GrowthChart title="Akuisisi 30 Hari" points={growth.charts.signups30d} />
                        <GrowthChart title="Aktivasi 30 Hari" points={growth.charts.activations30d} />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                        <GrowthChart title="Pengguna Aktif 30 Hari" points={growth.charts.activeUsers30d} />

                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Perjalanan Pengguna</h2>

                            <div className="mt-6 space-y-4">
                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Akun</p>
                                    <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                                        {growth.stats.totalUsers.toLocaleString('id-ID')}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Aktif</p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <p className="text-2xl font-black tracking-tight text-zinc-900">
                                            {growth.stats.activatedUsers.toLocaleString('id-ID')}
                                        </p>
                                        <p className="text-sm font-semibold text-blue-600">
                                            {formatPercent(growth.stats.activationRate)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Berbayar</p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <p className="text-2xl font-black tracking-tight text-zinc-900">
                                            {growth.stats.paidUsers.toLocaleString('id-ID')}
                                        </p>
                                        <p className="text-sm font-semibold text-blue-600">
                                            {formatPercent(growth.stats.paidConversionRate)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-white px-4 py-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">WAU</p>
                                        <p className="mt-2 text-xl font-black tracking-tight text-zinc-900">
                                            {growth.stats.wau.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-white px-4 py-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">MAU</p>
                                        <p className="mt-2 text-xl font-black tracking-tight text-zinc-900">
                                            {growth.stats.mau.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Pengguna Kembali</h2>

                            <div className="mt-5 grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">D1</p>
                                    <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                                        {formatPercent(growth.retention.d1.rate)}
                                    </p>
                                    <p className="mt-2 text-xs text-zinc-400">
                                        {growth.retention.d1.retained.toLocaleString('id-ID')} / {growth.retention.d1.eligible.toLocaleString('id-ID')}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">D7</p>
                                    <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                                        {formatPercent(growth.retention.d7.rate)}
                                    </p>
                                    <p className="mt-2 text-xs text-zinc-400">
                                        {growth.retention.d7.retained.toLocaleString('id-ID')} / {growth.retention.d7.eligible.toLocaleString('id-ID')}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-white px-4 py-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">D30</p>
                                    <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                                        {formatPercent(growth.retention.d30.rate)}
                                    </p>
                                    <p className="mt-2 text-xs text-zinc-400">
                                        {growth.retention.d30.retained.toLocaleString('id-ID')} / {growth.retention.d30.eligible.toLocaleString('id-ID')}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Kelompok Mingguan</h2>

                            <div className="mt-5 overflow-hidden rounded-3xl bg-white">
                                <div className="grid grid-cols-[minmax(0,1.2fr)_90px_90px_90px_90px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                    <span>Minggu</span>
                                    <span>Total</span>
                                    <span>D1</span>
                                    <span>D7</span>
                                    <span>D30</span>
                                </div>

                                {growth.retention.cohorts.length === 0 ? (
                                    <div className="px-4 py-6 text-sm text-zinc-500">Belum ada cohort retention.</div>
                                ) : (
                                    growth.retention.cohorts.map((cohort) => (
                                        <div
                                            key={cohort.cohort}
                                            className="grid grid-cols-[minmax(0,1.2fr)_90px_90px_90px_90px] gap-4 px-4 py-4 text-sm even:bg-zinc-50/60"
                                        >
                                            <p className="truncate font-semibold text-zinc-900">{cohort.cohort}</p>
                                            <p className="text-zinc-600">{cohort.total.toLocaleString('id-ID')}</p>
                                            <p className="text-zinc-600">{formatPercent(cohort.d1Rate)}</p>
                                            <p className="text-zinc-600">{formatPercent(cohort.d7Rate)}</p>
                                            <p className="text-zinc-600">{formatPercent(cohort.d30Rate)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </section>
                </div>
            )}
        </AdminShell>
    );
}
