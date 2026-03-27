'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { fetchAdminJson } from '@/lib/adminClient';
import { SubscriptionTier } from '@/types/credit';

type AdminUser = {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string | null;
    tier: SubscriptionTier;
    workspace_count: number;
    last_workspace_activity: string | null;
    remaining_credits: number;
    credits_updated_at: string | null;
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

export default function AdminUsersPage() {
    const [state, setState] = useState<LoadState>('loading');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadUsers = async () => {
            try {
                const payload = await fetchAdminJson<{ users: AdminUser[] }>('/api/admin/users');
                if (!mounted) return;
                setUsers(payload.users || []);
                setSelectedUser((payload.users || [])[0] || null);
                setState('ready');
            } catch (error) {
                if (!mounted) return;
                if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                    setState('unauthorized');
                    return;
                }
                console.error('[Admin] Failed to load users:', error);
                setState('error');
            }
        };

        loadUsers();
        return () => {
            mounted = false;
        };
    }, []);

    const filteredUsers = useMemo(() => {
        const keyword = userSearch.trim().toLowerCase();
        if (!keyword) return users;

        return users.filter((user) =>
            [user.full_name || '', user.email || '', user.id, user.tier]
                .join(' ')
                .toLowerCase()
                .includes(keyword)
        );
    }, [users, userSearch]);

    return (
        <AdminShell>
            {state === 'loading' && (
                <div className="rounded-3xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                    Memuat data user admin...
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
                    <h2 className="text-lg font-bold text-amber-900">Data user belum bisa dimuat</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-800">
                        Ada masalah saat mengambil data admin users. Coba refresh halaman atau cek koneksi Supabase.
                    </p>
                </div>
            )}

            {state === 'ready' && (
                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-3xl bg-zinc-50/80 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-zinc-900">Daftar User</h2>
                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Pencarian cepat untuk mengecek user, tier, workspace, dan saldo kredit yang tersisa.
                                </p>
                            </div>

                            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                                <Search size={16} className="text-zinc-400" />
                                <input
                                    value={userSearch}
                                    onChange={(event) => setUserSearch(event.target.value)}
                                    placeholder="Cari nama, email, tier..."
                                    className="w-56 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
                                />
                            </label>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-3xl bg-white">
                            <div className="grid grid-cols-[minmax(0,1.1fr)_110px_110px_140px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                <span>User</span>
                                <span>Plan</span>
                                <span>Workspace</span>
                                <span>Kredit</span>
                            </div>

                            {filteredUsers.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-zinc-500">
                                    Tidak ada user yang cocok dengan pencarian Anda.
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className={`grid w-full grid-cols-[minmax(0,1.1fr)_110px_110px_140px] gap-4 px-4 py-4 text-left text-sm transition-colors hover:bg-zinc-50 ${
                                            selectedUser?.id === user.id ? 'bg-zinc-100/80' : 'bg-white even:bg-zinc-50/50'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-zinc-900">
                                                {user.full_name || 'Tanpa nama'}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-zinc-400">
                                                {user.email || user.id}
                                            </p>
                                        </div>
                                        <span className="self-center text-zinc-600">{user.tier}</span>
                                        <span className="self-center text-zinc-600">
                                            {user.workspace_count.toLocaleString('id-ID')}
                                        </span>
                                        <span className="self-center text-zinc-600">
                                            {user.remaining_credits.toLocaleString('id-ID')}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl bg-zinc-50/80 p-6">
                        <h2 className="text-lg font-bold text-zinc-900">Detail User</h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                            Klik user di tabel kiri untuk melihat snapshot ringkas akun tersebut.
                        </p>

                        {selectedUser ? (
                            <div className="mt-5 space-y-4">
                                <div className="rounded-2xl bg-white p-5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">User</p>
                                    <h3 className="mt-3 text-xl font-bold text-zinc-900">
                                        {selectedUser.full_name || 'Tanpa nama'}
                                    </h3>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        {selectedUser.email || 'Email tidak tersedia'}
                                    </p>
                                    <p className="mt-2 break-all text-xs text-zinc-400">{selectedUser.id}</p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Tier</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">{selectedUser.tier}</p>
                                    </div>
                                    <div className="rounded-2xl bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Workspace</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">
                                            {selectedUser.workspace_count.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Sisa Kredit</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">
                                            {selectedUser.remaining_credits.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Bergabung</p>
                                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                                            {formatDate(selectedUser.created_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                                        Aktivitas Workspace Terakhir
                                    </p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                                        {selectedUser.last_workspace_activity
                                            ? formatDate(selectedUser.last_workspace_activity)
                                            : 'Belum ada aktivitas workspace'}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                                        Ini membantu admin melihat apakah akun masih aktif memakai board cloud.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-2xl bg-white p-6 text-sm text-zinc-500">
                                Pilih salah satu user dari tabel untuk melihat detailnya di sini.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
