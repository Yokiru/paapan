'use client';

import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { fetchAdminJson } from '@/lib/adminClient';

type DailyChartPoint = {
    date: string;
    label: string;
    value: number;
};

type AdminOverviewResponse = {
    admin: {
        email: string | null;
    };
    stats: {
        totalUsers: number;
        totalWorkspaces: number;
        workspaceOwners: number;
        totalCreditAccounts: number;
        dau: number;
        mau: number;
        paidUsers: number;
        plans: {
            free: number;
            plus: number;
            pro: number;
            apiPro: number;
        };
    };
    charts: {
        signups14d: DailyChartPoint[];
        workspaceActivity14d: DailyChartPoint[];
        activeUsers14d: DailyChartPoint[];
        visitorsTracked: boolean;
    };
    recentUsers: Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        created_at: string | null;
    }>;
};

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

function formatDate(value: string | null) {
    if (!value) return 'Tanggal tidak tersedia';
    return new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function StatCard({
    title,
    value,
}: {
    title: string;
    value: string;
}) {
    return (
        <div className="rounded-3xl bg-zinc-50/90 p-6">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-900">{value}</p>
        </div>
    );
}

function AreaLineChartCard({
    title,
    points,
}: {
    title: string;
    points: DailyChartPoint[];
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
                    14 hari
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
                        <path
                            d={areaPath}
                            fill="url(#paapan-chart-fill)"
                            opacity="0.95"
                        />
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
                        <linearGradient id="paapan-chart-fill" x1="0" y1="0" x2="0" y2="1">
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

                <div className="grid grid-cols-7 gap-2 px-2 py-3 text-[11px] font-medium text-zinc-400 sm:grid-cols-14">
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

function MiniTrendChart({
    title,
    points,
}: {
    title: string;
    points: DailyChartPoint[];
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
            <h2 className="text-lg font-bold text-zinc-900">{title}</h2>

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
                        <path d={areaPath} fill="url(#paapan-mini-chart-fill)" opacity="0.95" />
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
                        <linearGradient id="paapan-mini-chart-fill" x1="0" y1="0" x2="0" y2="1">
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

                <div className="grid grid-cols-7 gap-2 px-2 py-3 text-[11px] font-medium text-zinc-400 sm:grid-cols-14">
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

export default function AdminOverviewPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);

    const monitoringLinks = useMemo(() => {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseRef = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1];

        return {
            supabase: supabaseRef
                ? `https://supabase.com/dashboard/project/${supabaseRef}`
                : 'https://supabase.com/dashboard',
            vercel: 'https://vercel.com/dashboard',
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadOverview = async () => {
            try {
                const payload = await fetchAdminJson<AdminOverviewResponse>('/api/admin/overview');
                if (!mounted) return;
                setOverview(payload);
                setState('ready');
            } catch (error) {
                if (!mounted) return;
                if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                    setState('unauthorized');
                    return;
                }
                console.error('[Admin] Failed to load overview:', error);
                setState('error');
            }
        };

        loadOverview();
        return () => {
            mounted = false;
        };
    }, []);

    const planCards = useMemo(() => {
        if (!overview) return [];

        return [
            { label: 'Free', value: overview.stats.plans.free, accent: 'bg-zinc-900 text-white' },
            { label: 'Plus', value: overview.stats.plans.plus, accent: 'bg-blue-50 text-blue-700' },
            { label: 'Pro', value: overview.stats.plans.pro, accent: 'bg-amber-50 text-amber-700' },
            { label: 'API Pro', value: overview.stats.plans.apiPro, accent: 'bg-emerald-50 text-emerald-700' },
        ];
    }, [overview]);

    return (
        <AdminShell>
            {state === 'loading' && (
                <div className="rounded-3xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                    Memuat statistik admin...
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
                    <h2 className="text-lg font-bold text-amber-900">Statistik belum bisa dimuat</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                        Ada masalah saat mengambil data admin. Coba refresh halaman atau cek koneksi Supabase.
                    </p>
                </div>
            )}

            {state === 'ready' && overview && (
                <div className="space-y-8">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                            title="Total Pengguna"
                            value={overview.stats.totalUsers.toLocaleString('id-ID')}
                        />
                        <StatCard
                            title="Aktif Hari Ini"
                            value={overview.stats.dau.toLocaleString('id-ID')}
                        />
                        <StatCard
                            title="Aktif 30 Hari"
                            value={overview.stats.mau.toLocaleString('id-ID')}
                        />
                        <StatCard
                            title="Pengguna Berbayar"
                            value={overview.stats.paidUsers.toLocaleString('id-ID')}
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                        <AreaLineChartCard
                            title="User Baru"
                            points={overview.charts.signups14d}
                        />
                        <AreaLineChartCard
                            title="Aktivitas Workspace"
                            points={overview.charts.workspaceActivity14d}
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <MiniTrendChart
                            title="Tren Pengguna Aktif"
                            points={overview.charts.activeUsers14d}
                        />

                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Pengunjung Web</h2>
                            <div className="mt-5 rounded-3xl bg-white p-5">
                                <p className="text-sm font-semibold text-zinc-900">Data ada di Vercel</p>
                                <p className="mt-2 text-sm text-zinc-500">Belum masuk ke dashboard admin.</p>
                            </div>
                        </section>
                    </section>

                    <section className="rounded-3xl bg-zinc-50/80 p-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-zinc-900">Monitoring</h2>
                            <p className="text-sm text-zinc-500">Buka dashboard operasional utama.</p>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <a
                                href={monitoringLinks.vercel}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-3xl bg-white px-5 py-5 transition-colors hover:bg-zinc-100"
                            >
                                <p className="text-sm font-semibold text-zinc-900">Vercel</p>
                                <p className="mt-1 text-sm text-zinc-500">Analytics, Speed Insights, deployment, observability.</p>
                            </a>

                            <a
                                href={monitoringLinks.supabase}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-3xl bg-white px-5 py-5 transition-colors hover:bg-zinc-100"
                            >
                                <p className="text-sm font-semibold text-zinc-900">Supabase</p>
                                <p className="mt-1 text-sm text-zinc-500">Database, auth, storage, logs, usage.</p>
                            </a>
                        </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Pengguna Terbaru</h2>

                            <div className="mt-5 overflow-hidden rounded-3xl bg-white">
                                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_180px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                    <span>User</span>
                                    <span>Email</span>
                                    <span>Bergabung</span>
                                </div>

                                {overview.recentUsers.length === 0 ? (
                                    <div className="px-4 py-6 text-sm text-zinc-500">Belum ada data user terbaru.</div>
                                ) : (
                                    overview.recentUsers.map((user) => (
                                        <div
                                            key={user.id}
                                            className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_180px] gap-4 px-4 py-4 text-sm even:bg-zinc-50/60"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-zinc-900">
                                                    {user.full_name || 'Tanpa nama'}
                                                </p>
                                                <p className="mt-1 truncate text-xs text-zinc-400">{user.id}</p>
                                            </div>
                                            <p className="truncate text-zinc-600">{user.email || 'Email tidak tersedia'}</p>
                                            <p className="text-zinc-500">{formatDate(user.created_at)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Sebaran Paket</h2>

                            <div className="mt-5 space-y-3">
                                {planCards.map((plan) => (
                                    <div
                                        key={plan.label}
                                        className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                    >
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-900">{plan.label}</p>
                                                <p className="mt-1 text-xs text-zinc-400">Jumlah akun</p>
                                            </div>
                                        <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${plan.accent}`}>
                                            {plan.value.toLocaleString('id-ID')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </section>
                </div>
            )}
        </AdminShell>
    );
}
