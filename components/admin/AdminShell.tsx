'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, BarChart3, PanelLeftClose, PanelLeftOpen, Sparkles, TrendingUp, Users } from 'lucide-react';

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
                <div
                    className="grid grid-cols-1 gap-8 transition-[grid-template-columns] duration-300 ease-out lg:[grid-template-columns:var(--admin-sidebar-width)_minmax(0,1fr)]"
                    style={{
                        ['--admin-sidebar-width' as string]: isSidebarOpen ? '220px' : '52px',
                    }}
                >
                    <aside className="sticky top-6 self-start transition-all duration-300 ease-out max-lg:hidden">
                        <div className={`transition-all duration-300 ease-out ${isSidebarOpen ? 'rounded-3xl bg-zinc-50/70 p-4' : 'p-0'}`}>
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen((value) => !value)}
                                className={`inline-flex w-full items-center text-sm font-medium text-zinc-600 transition-all duration-300 ease-out hover:text-zinc-900 ${isSidebarOpen ? 'justify-between gap-3 rounded-2xl px-3 py-3 hover:bg-zinc-100' : 'justify-center rounded-xl px-0 py-2.5 hover:bg-zinc-50'}`}
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
                                            } ${isSidebarOpen ? 'items-start gap-3' : 'items-center justify-center px-0 py-2.5'} transition-all duration-300 ease-out`}
                                            title={item.label}
                                        >
                                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center transition-colors duration-300 ${isActive ? 'text-blue-600' : 'text-zinc-500'}`}>
                                                <item.icon size={16} />
                                            </div>
                                            {isSidebarOpen && (
                                                <p className="pt-1 font-semibold animate-in fade-in duration-200">{item.label}</p>
                                            )}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </aside>

                    <div className="min-w-0 transition-all duration-300 ease-out">{children}</div>
                </div>
            </div>
        </div>
    );
}
