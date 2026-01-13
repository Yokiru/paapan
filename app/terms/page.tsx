'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
    return (
        <div className="fixed inset-0 bg-zinc-100 overflow-y-auto">
            <div className="py-8 px-4">
                {/* Double Layer Card */}
                <div className="max-w-3xl mx-auto bg-zinc-200 rounded-2xl p-2.5">
                    <div className="bg-white rounded-xl overflow-hidden">

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-zinc-100">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-sm font-medium">Kembali</span>
                            </Link>

                            <h1 className="text-2xl font-bold text-zinc-900 mb-1">Syarat Layanan</h1>
                            <p className="text-zinc-400 text-sm">Terakhir diperbarui: 13 Januari 2026</p>
                        </div>

                        {/* Content */}
                        <div className="px-8 py-8 space-y-8">

                            {/* Section 1 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">1. Penerimaan Syarat</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Dengan mengakses dan menggunakan layanan Paapan ("Layanan"), Anda menyetujui
                                    untuk terikat dengan syarat dan ketentuan ini. Jika Anda tidak menyetujui
                                    syarat ini, mohon untuk tidak menggunakan Layanan kami.
                                </p>
                            </section>

                            {/* Section 2 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">2. Deskripsi Layanan</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Paapan adalah platform workspace berbasis AI yang menyediakan:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Canvas interaktif untuk brainstorming
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Asisten AI untuk membantu pekerjaan Anda
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Fitur kolaborasi dan organisasi
                                    </li>
                                </ul>
                            </section>

                            {/* Section 3 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">3. Akun Pengguna</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Untuk menggunakan Layanan, Anda harus:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Berusia minimal 13 tahun
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Memberikan informasi yang akurat saat pendaftaran
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Menjaga kerahasiaan kredensial akun Anda
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        Bertanggung jawab atas semua aktivitas di akun Anda
                                    </li>
                                </ul>
                            </section>

                            {/* Section 4 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">4. Penggunaan yang Diizinkan</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Anda setuju untuk <strong>TIDAK</strong>:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400">✕</span>
                                        Menggunakan Layanan untuk aktivitas ilegal
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400">✕</span>
                                        Mengunggah konten yang melanggar hukum atau hak pihak lain
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400">✕</span>
                                        Mencoba mengakses sistem tanpa izin
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400">✕</span>
                                        Menyalahgunakan fitur AI untuk konten berbahaya
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-400">✕</span>
                                        Menggunakan bot atau scraping otomatis
                                    </li>
                                </ul>
                            </section>

                            {/* Section 5 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">5. Sistem Kredit</h2>
                                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                    <ul className="text-sm text-zinc-600 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-zinc-400">•</span>
                                            Pengguna gratis mendapat <strong>5 kredit/hari</strong> (reset harian)
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-zinc-400">•</span>
                                            Kredit berbayar berlaku <strong>30 hari</strong> sejak pembelian
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-zinc-400">•</span>
                                            Kredit tidak dapat diuangkan atau ditransfer
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-zinc-400">•</span>
                                            Kredit yang tidak terpakai akan hangus sesuai ketentuan
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* Section 6 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">6. Pembayaran dan Pengembalian</h2>
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <p className="text-sm text-amber-800">
                                        🚀 <strong>Open Beta:</strong> Sistem pembayaran belum aktif. Ketentuan pembayaran
                                        akan diumumkan sebelum peluncuran resmi.
                                    </p>
                                </div>
                            </section>

                            {/* Section 7 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">7. Konten Pengguna</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Anda mempertahankan kepemilikan atas konten yang Anda buat. Dengan menggunakan
                                    Layanan, Anda memberikan kami lisensi untuk menyimpan dan memproses konten
                                    tersebut sesuai kebutuhan operasional Layanan.
                                </p>
                            </section>

                            {/* Section 8 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">8. Batasan Tanggung Jawab</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Layanan disediakan "sebagaimana adanya". Kami tidak menjamin bahwa Layanan
                                    akan selalu tersedia, bebas error, atau memenuhi kebutuhan spesifik Anda.
                                    Respons AI bersifat informatif dan bukan pengganti saran profesional.
                                </p>
                            </section>

                            {/* Section 9 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">9. Perubahan Syarat</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Kami dapat memperbarui syarat ini sewaktu-waktu. Perubahan material akan
                                    diumumkan melalui email atau notifikasi dalam aplikasi.
                                </p>
                            </section>

                            {/* Section 10 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">10. Kontak</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Untuk pertanyaan tentang syarat ini, hubungi kami via WhatsApp di{' '}
                                    <a href="https://wa.me/62895360148909" className="text-blue-600 hover:underline font-medium">
                                        0895360148909
                                    </a>
                                </p>
                            </section>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
