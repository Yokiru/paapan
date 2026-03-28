'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowLeft, BarChart3, PanelLeftClose, PanelLeftOpen, Sparkles, TrendingUp, Users } from 'lucide-react';

const ADMIN_NAV_ITEMS = [
    {
        href: '/admin',
        label: 'Statistik',
        icon: BarChart3,
    },
    {
        href: '/admin/users',
        label: 'Pengguna',
        icon: Users,
    },
    {
        href: '/admin/growth',
        label: 'Pertumbuhan',
        icon: TrendingUp,
    },
    {
        href: '/admin/ai',
        label: 'AI',
        icon: Sparkles,
    },
    {
        href: '/admin/system',
        label: 'Sistem',
        icon: Activity,
    },
] as const;

export function AdminShell({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);

    useEffect(() => {
        const saved = window.localStorage.getItem('paapan-admin-sidebar-open');
        setIsSidebarOpen(saved === 'false' ? false : true);
        setHasLoadedSidebarPreference(true);
    }, []);

    useEffect(() => {
        if (!hasLoadedSidebarPreference) return;
        window.localStorage.setItem('paapan-admin-sidebar-open', String(isSidebarOpen));
    }, [hasLoadedSidebarPreference, isSidebarOpen]);

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                    >
                        <ArrowLeft size={18} />
                        <span>Kembali</span>
                    </Link>
                </div>

                <div className={`mt-8 grid gap-8 ${isSidebarOpen ? 'lg:grid-cols-[220px_minmax(0,1fr)]' : 'lg:grid-cols-[52px_minmax(0,1fr)]'}`}>
                    <aside className={`lg:sticky lg:top-6 lg:self-start ${isSidebarOpen ? '' : 'max-lg:hidden'}`}>
                        <div className={isSidebarOpen ? 'rounded-3xl bg-zinc-50/70 p-4' : 'p-0'}>
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen((value) => !value)}
                                className={`inline-flex w-full items-center text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 ${isSidebarOpen ? 'justify-between gap-3 rounded-2xl px-3 py-3 hover:bg-zinc-100' : 'justify-center rounded-xl px-0 py-2.5 hover:bg-zinc-50'}`}
                                title={isSidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
                            >
                                {isSidebarOpen ? (
                                    <>
                                        <span>Menu</span>
                                        <PanelLeftClose size={16} />
                                    </>
                                ) : (
                                    <PanelLeftOpen size={16} />
                                )}
                            </button>

                            <nav className="mt-4 space-y-2">
                                {ADMIN_NAV_ITEMS.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex rounded-2xl px-3 py-3 text-sm transition-colors ${
                                                isActive
                                                    ? 'text-blue-600'
                                                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                                            } ${isSidebarOpen ? 'items-start gap-3' : 'items-center justify-center px-0 py-2.5'}`}
                                            title={item.label}
                                        >
                                            <div className={`mt-0.5 flex h-8 w-8 items-center justify-center ${isActive ? 'text-blue-600' : 'text-zinc-500'}`}>
                                                <item.icon size={16} />
                                            </div>
                                            {isSidebarOpen && (
                                                <p className="pt-1 font-semibold">{item.label}</p>
                                            )}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    <div>{children}</div>
                </div>
            </div>
        </div>
    );
}
