'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchAdmin, fetchAdminJson } from '@/lib/adminClient';
import { SubscriptionTier } from '@/types/credit';

type AdminUser = {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string | null;
    is_banned?: boolean;
    banned_until?: string | null;
    ban_reason?: string | null;
    tier: SubscriptionTier;
    workspace_count: number;
    last_workspace_activity: string | null;
    remaining_credits: number;
    core_remaining_credits: number;
    bonus_remaining_credits: number;
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
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [tierDraft, setTierDraft] = useState<SubscriptionTier>('free');
    const [bucketDraft, setBucketDraft] = useState<'daily' | 'monthly' | 'bonus'>('bonus');
    const [bucketDelta, setBucketDelta] = useState('25');
    const [banReasonDraft, setBanReasonDraft] = useState('');
    const [isSavingTier, setIsSavingTier] = useState(false);
    const [isSavingBucket, setIsSavingBucket] = useState(false);
    const [isResettingBonus, setIsResettingBonus] = useState(false);
    const [isResettingCredits, setIsResettingCredits] = useState(false);
    const [isSavingBanState, setIsSavingBanState] = useState(false);
    const [showBanConfirm, setShowBanConfirm] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadUsers = async () => {
            try {
                const payload = await fetchAdminJson<{ users: AdminUser[] }>('/api/admin/users');
                if (!mounted) return;
                setUsers(payload.users || []);
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

    useEffect(() => {
        if (!selectedUser) return;
        setTierDraft(selectedUser.tier);
        setBanReasonDraft(selectedUser.ban_reason || '');
    }, [selectedUser]);

    useEffect(() => {
        setActionMessage(null);
    }, [selectedUser?.id]);

    useEffect(() => {
        if (!isDetailOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsDetailOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDetailOpen]);

    const syncUpdatedUsers = (nextUsers: AdminUser[], nextSelectedId: string) => {
        setUsers(nextUsers);
        const updatedSelected = nextUsers.find((user) => user.id === nextSelectedId) || null;
        setSelectedUser(updatedSelected);
    };

    const handleTierSave = async () => {
        if (!selectedUser || tierDraft === selectedUser.tier) return;
        setIsSavingTier(true);
        setActionMessage(null);
        try {
            const payload = await fetchAdmin<{ ok: boolean; user: AdminUser | null; users: AdminUser[] }>('/api/admin/users', {
                method: 'PATCH',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    action: 'update_tier',
                    tier: tierDraft,
                }),
            });
            syncUpdatedUsers(payload.users || [], selectedUser.id);
            setActionMessage('Plan diperbarui.');
        } catch (error) {
            if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                setActionMessage('Session admin perlu di-refresh.');
            } else {
                setActionMessage('Plan belum tersimpan.');
            }
        } finally {
            setIsSavingTier(false);
        }
    };

    const handleBucketAdjust = async () => {
        if (!selectedUser) return;
        const delta = Number(bucketDelta);
        if (!Number.isFinite(delta) || delta === 0) return;

        setIsSavingBucket(true);
        setActionMessage(null);
        try {
            const payload = await fetchAdmin<{ ok: boolean; user: AdminUser | null; users: AdminUser[] }>('/api/admin/users', {
                method: 'PATCH',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    action: 'adjust_bucket',
                    bucket: bucketDraft,
                    delta,
                }),
            });
            syncUpdatedUsers(payload.users || [], selectedUser.id);
            setBucketDelta('25');
            setActionMessage('Kredit diperbarui.');
        } catch (error) {
            if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                setActionMessage('Session admin perlu di-refresh.');
            } else {
                setActionMessage('Kredit belum berubah.');
            }
        } finally {
            setIsSavingBucket(false);
        }
    };

    const handleResetBonus = async () => {
        if (!selectedUser) return;
        setIsResettingBonus(true);
        setActionMessage(null);
        try {
            const payload = await fetchAdmin<{ ok: boolean; user: AdminUser | null; users: AdminUser[] }>('/api/admin/users', {
                method: 'PATCH',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    action: 'reset_bonus',
                }),
            });
            syncUpdatedUsers(payload.users || [], selectedUser.id);
            setActionMessage('Bonus direset.');
        } catch (error) {
            if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                setActionMessage('Session admin perlu di-refresh.');
            } else {
                setActionMessage('Bonus belum bisa direset.');
            }
        } finally {
            setIsResettingBonus(false);
        }
    };

    const handleResetCredits = async () => {
        if (!selectedUser) return;
        setIsResettingCredits(true);
        setActionMessage(null);
        try {
            const payload = await fetchAdmin<{ ok: boolean; user: AdminUser | null; users: AdminUser[] }>('/api/admin/users', {
                method: 'PATCH',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    action: 'reset_credits',
                }),
            });
            syncUpdatedUsers(payload.users || [], selectedUser.id);
            setActionMessage('Kredit reguler direset.');
        } catch (error) {
            if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                setActionMessage('Session admin perlu di-refresh.');
            } else {
                setActionMessage('Kredit belum bisa direset.');
            }
        } finally {
            setIsResettingCredits(false);
        }
    };

    const executeBanToggle = async () => {
        if (!selectedUser) return;
        setIsSavingBanState(true);
        setActionMessage(null);
        try {
            const payload = await fetchAdmin<{ ok: boolean; user: AdminUser | null; users: AdminUser[] }>('/api/admin/users', {
                method: 'PATCH',
                body: JSON.stringify({
                    userId: selectedUser.id,
                    action: selectedUser.is_banned ? 'unban_user' : 'ban_user',
                    reason: selectedUser.is_banned ? undefined : banReasonDraft.trim(),
                }),
            });
            syncUpdatedUsers(payload.users || [], selectedUser.id);
            setActionMessage(selectedUser.is_banned ? 'Akun dibuka kembali.' : 'Akun diblokir.');
            if (!selectedUser.is_banned) {
                setBanReasonDraft('');
            }
        } catch (error) {
            if (error instanceof Error && error.message === 'UNAUTHORIZED') {
                setActionMessage('Session admin perlu di-refresh.');
            } else {
                setActionMessage(selectedUser.is_banned ? 'Akun belum bisa dibuka.' : 'Akun belum bisa diblokir.');
            }
        } finally {
            setIsSavingBanState(false);
        }
    };

    const handleBanToggle = async () => {
        if (!selectedUser) return;

        if (!selectedUser.is_banned) {
            setShowBanConfirm(true);
            return;
        }

        await executeBanToggle();
    };

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
                <>
                    <div className="rounded-3xl bg-zinc-50/80 p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <h2 className="text-lg font-bold text-zinc-900">Pengguna</h2>

                            <label className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                                <Search size={16} className="text-zinc-400" />
                                <input
                                    value={userSearch}
                                    onChange={(event) => setUserSearch(event.target.value)}
                                    placeholder="Cari user..."
                                    className="w-56 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
                                />
                            </label>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-3xl bg-white">
                            <div className="grid grid-cols-[minmax(0,1.2fr)_90px_80px_140px_90px] gap-4 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                <span>User</span>
                                <span>Plan</span>
                                <span>Board</span>
                                <span>Kredit Reguler</span>
                                <span>Bonus</span>
                            </div>

                            {filteredUsers.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-zinc-500">
                                    Tidak ada user yang cocok dengan pencarian Anda.
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setIsDetailOpen(true);
                                        }}
                                        className={`grid w-full grid-cols-[minmax(0,1.2fr)_90px_80px_140px_90px] gap-4 px-4 py-4 text-left text-sm transition-colors hover:bg-zinc-50 ${
                                            selectedUser?.id === user.id && isDetailOpen ? 'bg-zinc-100/80' : 'bg-white even:bg-zinc-50/50'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate font-semibold text-zinc-900">
                                                    {user.full_name || 'Tanpa nama'}
                                                </p>
                                                {user.is_banned && (
                                                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700">
                                                        Diblokir
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 truncate text-xs text-zinc-400">
                                                {user.email || user.id}
                                            </p>
                                            {user.is_banned && user.ban_reason && (
                                                <p className="mt-1 truncate text-[11px] font-medium text-red-500">
                                                    {user.ban_reason}
                                                </p>
                                            )}
                                        </div>
                                        <span className="self-center text-zinc-600">{user.tier}</span>
                                        <span className="self-center text-zinc-600">
                                            {user.workspace_count.toLocaleString('id-ID')}
                                        </span>
                                        <span className="self-center text-zinc-600">
                                            {user.core_remaining_credits.toLocaleString('id-ID')}
                                        </span>
                                        <span className="self-center text-zinc-600">
                                            {user.bonus_remaining_credits.toLocaleString('id-ID')}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {selectedUser && isDetailOpen && (
                        <div
                            className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/30 px-4 py-8 backdrop-blur-sm"
                            onClick={() => setIsDetailOpen(false)}
                        >
                            <div
                                className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-500">Ringkasan Pengguna</p>
                                        <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-900">
                                            {selectedUser.full_name || 'Tanpa nama'}
                                        </h2>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            {selectedUser.email || 'Email tidak tersedia'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedUser.is_banned ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {selectedUser.is_banned ? 'Diblokir' : 'Aktif'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setIsDetailOpen(false)}
                                            className="rounded-2xl bg-zinc-100 p-2 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
                                            aria-label="Tutup detail user"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                <p className="mt-3 break-all text-xs text-zinc-300">{selectedUser.id}</p>

                                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Plan</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">{selectedUser.tier}</p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Board</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">
                                            {selectedUser.workspace_count.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Status</p>
                                        <p className={`mt-2 text-sm font-semibold ${selectedUser.is_banned ? 'text-red-700' : 'text-blue-700'}`}>
                                            {selectedUser.is_banned ? 'Diblokir' : 'Normal'}
                                        </p>
                                    </div>
                                    {selectedUser.is_banned && (
                                        <div className="rounded-2xl bg-red-50 p-4 sm:col-span-2 lg:col-span-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Alasan Blokir</p>
                                            <p className="mt-2 text-sm font-medium text-red-700">
                                                {selectedUser.ban_reason || 'Tidak ada alasan yang dicatat.'}
                                            </p>
                                        </div>
                                    )}
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Kredit Reguler</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">
                                            {selectedUser.core_remaining_credits.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Bonus</p>
                                        <p className="mt-2 text-lg font-bold text-zinc-900">
                                            {selectedUser.bonus_remaining_credits.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-zinc-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Join</p>
                                        <p className="mt-2 text-sm font-semibold text-zinc-900">
                                            {formatDate(selectedUser.created_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Aktivitas</p>
                                    <p className="mt-2 text-sm font-semibold text-zinc-900">
                                        {selectedUser.last_workspace_activity
                                            ? formatDate(selectedUser.last_workspace_activity)
                                            : 'Belum ada aktivitas workspace'}
                                    </p>
                                </div>

                                <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">Aksi</p>

                                    <div className="mt-4 grid gap-2.5">
                                        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_180px]">
                                            <select
                                                value={tierDraft}
                                                onChange={(event) => setTierDraft(event.target.value as SubscriptionTier)}
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-800 outline-none"
                                            >
                                                <option value="free">free</option>
                                                <option value="plus">plus</option>
                                                <option value="pro">pro</option>
                                                <option value="api-pro">api-pro</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleTierSave}
                                                disabled={isSavingTier || tierDraft === selectedUser.tier}
                                                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSavingTier ? 'Menyimpan...' : 'Simpan Paket'}
                                            </button>
                                        </div>

                                        <div className="grid gap-2.5 sm:grid-cols-[120px_minmax(0,1fr)_180px]">
                                            <select
                                                value={bucketDraft}
                                                onChange={(event) => setBucketDraft(event.target.value as 'daily' | 'monthly' | 'bonus')}
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-800 outline-none"
                                            >
                                                <option value="daily">daily</option>
                                                <option value="monthly">monthly</option>
                                                <option value="bonus">bonus</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={bucketDelta}
                                                onChange={(event) => setBucketDelta(event.target.value)}
                                                placeholder="Tambah / kurang"
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleBucketAdjust}
                                                disabled={isSavingBucket || !bucketDelta.trim() || Number(bucketDelta) === 0}
                                                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSavingBucket ? 'Menyimpan...' : 'Ubah Kredit'}
                                            </button>
                                        </div>

                                        <div className="grid gap-2.5 sm:grid-cols-3">
                                            <button
                                                type="button"
                                                onClick={handleResetBonus}
                                                disabled={isResettingBonus}
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isResettingBonus ? 'Memproses...' : 'Reset Bonus'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleResetCredits}
                                                disabled={isResettingCredits}
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isResettingCredits ? 'Memproses...' : 'Reset Kredit'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBanToggle}
                                                disabled={isSavingBanState}
                                                className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                                                    selectedUser.is_banned
                                                        ? 'bg-blue-600'
                                                        : 'bg-red-600'
                                                }`}
                                            >
                                                {isSavingBanState
                                                    ? 'Memproses...'
                                                    : selectedUser.is_banned
                                                        ? 'Buka Blokir'
                                                        : 'Blokir Akun'}
                                            </button>
                                        </div>

                                        {!selectedUser.is_banned && (
                                            <textarea
                                                value={banReasonDraft}
                                                onChange={(event) => setBanReasonDraft(event.target.value)}
                                                placeholder="Alasan blokir untuk catatan admin"
                                                rows={3}
                                                className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-zinc-800 outline-none placeholder:text-zinc-400"
                                            />
                                        )}

                                        <div className="min-h-5 px-1">
                                            {actionMessage && (
                                                <p className="text-xs font-medium text-zinc-500">{actionMessage}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <ConfirmDialog
                        isOpen={showBanConfirm && !!selectedUser}
                        title="Blokir akun ini?"
                        message={`Pengguna ${selectedUser?.email || selectedUser?.full_name || 'ini'} akan kehilangan akses ke fitur utama Paapan sampai dibuka kembali.`}
                        confirmLabel="Ya, blokir akun"
                        cancelLabel="Batal"
                        variant="danger"
                        onConfirm={() => {
                            void executeBanToggle();
                        }}
                        onCancel={() => setShowBanConfirm(false)}
                    />
                </>
            )}
        </AdminShell>
    );
}
