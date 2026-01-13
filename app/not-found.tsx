'use client';

import Link from 'next/link';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="fixed inset-0 bg-zinc-100 flex items-center justify-center p-4">
            {/* Double Layer Card */}
            <div className="bg-zinc-200 rounded-2xl p-2.5 max-w-md w-full">
                <div className="bg-white rounded-xl p-8 text-center">

                    {/* 404 Illustration */}
                    <div className="mb-6">
                        <div className="text-8xl font-bold text-zinc-200 select-none">404</div>
                        <div className="text-4xl -mt-4">🔍</div>
                    </div>

                    {/* Title */}
                    <h1 className="text-xl font-bold text-zinc-900 mb-2">
                        Halaman Tidak Ditemukan
                    </h1>

                    {/* Description */}
                    <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
                        Sepertinya halaman yang kamu cari tidak ada atau sudah dipindahkan.
                    </p>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Link
                            href="/"
                            className="flex items-center justify-center gap-2 w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                        >
                            <Home size={18} />
                            <span>Kembali ke Beranda</span>
                        </Link>

                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center justify-center gap-2 w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium py-3 px-4 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={18} />
                            <span>Halaman Sebelumnya</span>
                        </button>
                    </div>

                    {/* Help Link */}
                    <div className="mt-8 pt-6 border-t border-zinc-100">
                        <p className="text-xs text-zinc-400">
                            Butuh bantuan?{' '}
                            <a
                                href="https://wa.me/62895360148909?text=Halo%20Admin%20Paapan!%20Saya%20menemukan%20halaman%20404."
                                target="_blank"
                                className="text-blue-600 hover:underline font-medium"
                            >
                                Hubungi kami
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
