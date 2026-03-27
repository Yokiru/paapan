'use client';

import { useEffect, useMemo, useState } from 'react';
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
    subtitle,
}: {
    title: string;
    value: string;
    subtitle: string;
}) {
    return (
        <div className="rounded-3xl bg-zinc-50/90 p-6">
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-zinc-900">{value}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{subtitle}</p>
        </div>
    );
}

function BarChartCard({
    title,
    description,
    points,
}: {
    title: string;
    description: string;
    points: DailyChartPoint[];
}) {
    const maxValue = Math.max(...points.map((point) => point.value), 1);

    return (
        <section className="rounded-3xl bg-zinc-50/80 p-6">
            <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>

            <div className="mt-6 grid grid-cols-7 gap-3 sm:grid-cols-14">
                {points.map((point) => (
                    <div key={point.date} className="flex flex-col items-center gap-2">
                        <div className="flex h-36 w-full items-end rounded-2xl bg-white px-1.5 py-2">
                            <div
                                className="w-full rounded-xl bg-zinc-900"
                                style={{
                                    height: `${Math.max((point.value / maxValue) * 100, point.value > 0 ? 12 : 0)}%`,
                                }}
                                title={`${point.label}: ${point.value}`}
                            />
                        </div>
                        <p className="text-[11px] font-medium text-zinc-400">{point.label}</p>
                        <p className="text-xs font-semibold text-zinc-700">{point.value}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function AdminOverviewPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);

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
                            title="Total Users"
                            value={overview.stats.totalUsers.toLocaleString('id-ID')}
                            subtitle="Jumlah akun auth yang sudah terdaftar di Paapan."
                        />
                        <StatCard
                            title="DAU"
                            value={overview.stats.dau.toLocaleString('id-ID')}
                            subtitle="User unik yang punya aktivitas workspace hari ini."
                        />
                        <StatCard
                            title="MAU"
                            value={overview.stats.mau.toLocaleString('id-ID')}
                            subtitle="User unik yang punya aktivitas workspace dalam 30 hari terakhir."
                        />
                        <StatCard
                            title="Paid Users"
                            value={overview.stats.paidUsers.toLocaleString('id-ID')}
                            subtitle="Jumlah akun di tier Plus, Pro, dan API Pro."
                        />
                        <StatCard
                            title="Credit Accounts"
                            value={overview.stats.totalCreditAccounts.toLocaleString('id-ID')}
                            subtitle="Akun yang sudah memiliki balance kredit di sistem."
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                        <BarChartCard
                            title="User Baru 14 Hari Terakhir"
                            description="Tren signup harian dari akun yang benar-benar terdaftar di auth."
                            points={overview.charts.signups14d}
                        />
                        <BarChartCard
                            title="Aktivitas Workspace 14 Hari Terakhir"
                            description="Jumlah update workspace yang tersimpan per hari. Ini paling dekat ke sinyal penggunaan produk saat ini."
                            points={overview.charts.workspaceActivity14d}
                        />
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">User Aktif Harian</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                Jumlah user unik yang punya aktivitas workspace pada hari tersebut.
                            </p>

                            <div className="mt-5 space-y-3">
                                {overview.charts.activeUsers14d.map((point) => (
                                    <div key={point.date} className="grid grid-cols-[88px_minmax(0,1fr)_48px] items-center gap-3">
                                        <p className="text-sm font-medium text-zinc-600">{point.label}</p>
                                        <div className="h-3 overflow-hidden rounded-full bg-white">
                                            <div
                                                className="h-full rounded-full bg-zinc-900"
                                                style={{
                                                    width: `${Math.max(
                                                        (point.value / Math.max(...overview.charts.activeUsers14d.map((item) => item.value), 1)) * 100,
                                                        point.value > 0 ? 8 : 0
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-right text-sm font-semibold text-zinc-800">{point.value}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Pengunjung</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                Untuk saat ini kita baru menampilkan data user dan aktivitas produk yang memang sudah tersimpan di database.
                            </p>

                            <div className="mt-5 rounded-3xl bg-white p-5">
                                <p className="text-sm font-semibold text-zinc-900">Analytics pengunjung belum aktif</p>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Kalau kamu mau metrik pengunjung, session, dan page views, kita perlu pasang analytics seperti Vercel Analytics, PostHog, atau Plausible.
                                </p>
                            </div>
                        </section>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Recent Users</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                Delapan akun terbaru yang terdaftar di Paapan.
                            </p>

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
                            <h2 className="text-lg font-bold text-zinc-900">Distribusi Plan</h2>
                            <p className="mt-2 text-sm leading-6 text-zinc-500">
                                Snapshot cepat untuk melihat persebaran akun berdasarkan tier subscription.
                            </p>

                            <div className="mt-5 space-y-3">
                                {planCards.map((plan) => (
                                    <div
                                        key={plan.label}
                                        className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-zinc-900">{plan.label}</p>
                                            <p className="mt-1 text-xs text-zinc-400">Akun pada tier ini</p>
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
