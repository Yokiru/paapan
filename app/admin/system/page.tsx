'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { fetchAdminJson } from '@/lib/adminClient';

type RouteHealth = {
    route: string;
    total: number;
    failures: number;
    successRate: number;
};

type RecentIncident = {
    createdAt: string;
    route: string;
    event: string;
    status: number | null;
    code: string;
    reason: string;
    userId: string | null;
};

type AdminSystemResponse = {
    trackingEnabled: boolean;
    stats: {
        incidents7d: number;
        rateLimited7d: number;
        unavailable7d: number;
        uploadFailures7d: number;
    };
    routeHealth: RouteHealth[];
    topErrors: Array<{
        code: string;
        count: number;
    }>;
    topReasons: Array<{
        reason: string;
        count: number;
    }>;
    recentIncidents: RecentIncident[];
};

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

function formatDate(value: string) {
    return new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
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

export default function AdminSystemPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [payload, setPayload] = useState<AdminSystemResponse | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            try {
                const data = await fetchAdminJson<AdminSystemResponse>('/api/admin/system');
                if (!mounted) return;
                setPayload(data);
                setState('ready');
            } catch (error) {
                if (!mounted) return;
                if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                    setState('unauthorized');
                    return;
                }
                console.error('[Admin] Failed to load system data:', error);
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
                    Memuat system...
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
                    <h2 className="text-lg font-bold text-amber-900">System health belum bisa dimuat</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                        Coba refresh halaman atau cek koneksi Supabase.
                    </p>
                </div>
            ) : null}

            {state === 'ready' && payload ? (
                <div className="space-y-8">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Gangguan" value={payload.stats.incidents7d.toLocaleString('id-ID')} />
                        <StatCard title="Kena Batas" value={payload.stats.rateLimited7d.toLocaleString('id-ID')} />
                        <StatCard title="AI Tidak Tersedia" value={payload.stats.unavailable7d.toLocaleString('id-ID')} />
                        <StatCard title="Upload Gagal" value={payload.stats.uploadFailures7d.toLocaleString('id-ID')} />
                    </section>

                    {!payload.trackingEnabled ? (
                        <section className="rounded-3xl bg-zinc-50/80 p-6">
                            <h2 className="text-lg font-bold text-zinc-900">Tracking belum aktif</h2>
                            <p className="mt-2 text-sm text-zinc-500">
                                Jalankan SQL `ai_events` dulu agar system health mulai membaca event route.
                            </p>
                        </section>
                    ) : (
                        <>
                            <section className="rounded-3xl bg-zinc-50/80 p-6">
                                <h2 className="text-lg font-bold text-zinc-900">Kesehatan Layanan</h2>

                                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                                    {payload.routeHealth.map((item) => (
                                        <div key={item.route} className="rounded-2xl bg-white px-4 py-4">
                                            <p className="text-sm font-semibold text-zinc-900">
                                                {item.route === 'api.generate'
                                                    ? 'Generate AI'
                                                    : item.route === 'api.byok.validate'
                                                        ? 'Validasi BYOK'
                                                        : item.route === 'api.upload.image'
                                                            ? 'Upload Gambar'
                                                            : item.route}
                                            </p>
                                            <p className="mt-2 text-2xl font-black tracking-tight text-zinc-900">
                                                {formatPercent(item.successRate)}
                                            </p>
                                            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                                                <span>{item.total.toLocaleString('id-ID')} kejadian</span>
                                                <span>{item.failures.toLocaleString('id-ID')} gagal</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="grid gap-6 xl:grid-cols-2">
                                <section className="rounded-3xl bg-zinc-50/80 p-6">
                                    <h2 className="text-lg font-bold text-zinc-900">Error Teratas</h2>

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
                                                    <p className="truncate pr-4 text-sm font-semibold text-zinc-900">{item.code}</p>
                                                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-700">
                                                        {item.count.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>

                                <section className="rounded-3xl bg-zinc-50/80 p-6">
                                    <h2 className="text-lg font-bold text-zinc-900">Penyebab Teratas</h2>

                                    <div className="mt-5 space-y-3">
                                        {payload.topReasons.length === 0 ? (
                                            <div className="rounded-2xl bg-white px-4 py-4 text-sm text-zinc-500">
                                                Belum ada reason yang tercatat.
                                            </div>
                                        ) : (
                                            payload.topReasons.map((item) => (
                                                <div
                                                    key={item.reason}
                                                    className="flex items-center justify-between rounded-2xl bg-white px-4 py-4"
                                                >
                                                    <p className="truncate pr-4 text-sm font-semibold text-zinc-900">{item.reason}</p>
                                                    <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-bold text-zinc-700">
                                                        {item.count.toLocaleString('id-ID')}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </section>
                            </section>

                            <section className="rounded-3xl bg-zinc-50/80 p-6">
                                <h2 className="text-lg font-bold text-zinc-900">Gangguan Terbaru</h2>

                                <div className="mt-5 overflow-hidden rounded-3xl bg-white">
                                    <div className="grid grid-cols-[160px_160px_120px_minmax(0,1fr)] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                        <span>Waktu</span>
                                        <span>Route</span>
                                        <span>Code</span>
                                        <span>Reason</span>
                                    </div>

                                    {payload.recentIncidents.length === 0 ? (
                                        <div className="px-4 py-6 text-sm text-zinc-500">Belum ada incident terbaru.</div>
                                    ) : (
                                        payload.recentIncidents.map((item, index) => (
                                            <div
                                                key={`${item.createdAt}-${item.route}-${index}`}
                                                className="grid grid-cols-[160px_160px_120px_minmax(0,1fr)] gap-4 px-4 py-4 text-sm even:bg-zinc-50/60"
                                            >
                                                <p className="text-zinc-500">{formatDate(item.createdAt)}</p>
                                                <p className="truncate font-semibold text-zinc-900">{item.route}</p>
                                                <p className="truncate text-zinc-700">{item.code}</p>
                                                <p className="truncate text-zinc-500">{item.reason}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            ) : null}
        </AdminShell>
    );
}
