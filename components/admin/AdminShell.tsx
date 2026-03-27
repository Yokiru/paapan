'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, PanelLeftClose, PanelLeftOpen, Users } from 'lucide-react';

const ADMIN_NAV_ITEMS = [
    {
        href: '/admin',
        label: 'Statistik',
        description: 'Ringkasan produk',
        icon: BarChart3,
    },
    {
        href: '/admin/users',
        label: 'Users',
        description: 'Akun dan aktivitas',
        icon: Users,
    },
] as const;

export function AdminShell({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

                    <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Admin Dashboard
                    </div>
                </div>

                <div className={`mt-8 grid gap-8 ${isSidebarOpen ? 'lg:grid-cols-[240px_minmax(0,1fr)]' : 'lg:grid-cols-[88px_minmax(0,1fr)]'}`}>
                    <aside className={`lg:sticky lg:top-6 lg:self-start ${isSidebarOpen ? '' : 'max-lg:hidden'}`}>
                        <div className="rounded-3xl bg-zinc-50 p-4">
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen((value) => !value)}
                                className={`inline-flex w-full items-center rounded-2xl bg-white px-3 py-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ${isSidebarOpen ? 'justify-between gap-3' : 'justify-center'}`}
                                title={isSidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
                            >
                                {isSidebarOpen ? (
                                    <>
                                        <span>Navigasi</span>
                                        <PanelLeftClose size={16} />
                                    </>
                                ) : (
                                    <PanelLeftOpen size={16} />
                                )}
                            </button>

                            {isSidebarOpen && (
                                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                    Navigasi Admin
                                </p>
                            )}
                            <nav className="mt-4 space-y-2">
                                {ADMIN_NAV_ITEMS.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`flex rounded-2xl px-3 py-3 text-sm transition-colors ${
                                                isActive
                                                    ? 'bg-white text-zinc-900 shadow-sm'
                                                    : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
                                            } ${isSidebarOpen ? 'items-start gap-3' : 'items-center justify-center'}`}
                                            title={item.label}
                                        >
                                            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-sm">
                                                <item.icon size={16} />
                                            </div>
                                            {isSidebarOpen && (
                                                <div>
                                                    <p className="font-semibold">{item.label}</p>
                                                    <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                                                        {item.description}
                                                    </p>
                                                </div>
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
