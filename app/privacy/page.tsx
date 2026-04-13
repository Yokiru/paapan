'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
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

                            <h1 className="text-2xl font-bold text-zinc-900 mb-1">Kebijakan Privasi</h1>
                            <p className="text-zinc-400 text-sm">Terakhir diperbarui: 13 Januari 2026</p>
                        </div>

                        {/* Content */}
                        <div className="px-8 py-8 space-y-8">

                            {/* Section 1 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">1. Informasi yang Kami Kumpulkan</h2>

                                <div className="space-y-4">
                                    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                        <h3 className="text-sm font-medium text-zinc-800 mb-2">Informasi Akun</h3>
                                        <ul className="text-sm text-zinc-600 space-y-1">
                                            <li>• Nama dan alamat email</li>
                                            <li>• Foto profil (jika diunggah)</li>
                                            <li>• Preferensi bahasa dan pengaturan</li>
                                        </ul>
                                    </div>

                                    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                        <h3 className="text-sm font-medium text-zinc-800 mb-2">Data Penggunaan</h3>
                                        <ul className="text-sm text-zinc-600 space-y-1">
                                            <li>• Konten yang Anda buat di workspace</li>
                                            <li>• Interaksi dengan fitur AI</li>
                                            <li>• Log aktivitas dan penggunaan kredit</li>
                                        </ul>
                                    </div>

                                    <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                        <h3 className="text-sm font-medium text-zinc-800 mb-2">Informasi Teknis</h3>
                                        <ul className="text-sm text-zinc-600 space-y-1">
                                            <li>• Jenis perangkat dan browser</li>
                                            <li>• Alamat IP (untuk keamanan)</li>
                                            <li>• Cookie dan data sesi</li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">2. Penggunaan Informasi</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Kami menggunakan informasi Anda untuk:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        Menyediakan dan meningkatkan Layanan
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        Memproses permintaan AI Anda
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        Mengirim notifikasi penting tentang akun
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        Mencegah penyalahgunaan dan menjaga keamanan
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500">✓</span>
                                        Mengirim update produk (dengan persetujuan Anda)
                                    </li>
                                </ul>
                            </section>

                            {/* Section 3 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">3. Pemrosesan AI</h2>
                                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                    <p className="text-sm text-blue-800">
                                        🤖 Saat Anda menggunakan fitur AI, pertanyaan dan konteks Anda dikirim ke
                                        penyedia AI (Google Gemini) untuk diproses. <strong>Kami tidak menggunakan
                                            konten Anda untuk melatih model AI.</strong>
                                    </p>
                                </div>
                            </section>

                            {/* Section 4 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">4. Berbagi Data</h2>
                                <div className="bg-green-50 rounded-xl p-4 border border-green-100 mb-4">
                                    <p className="text-sm text-green-800 font-medium">
                                        ✓ Kami TIDAK menjual data Anda
                                    </p>
                                </div>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Kami hanya berbagi data dengan:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        <strong>Penyedia Layanan:</strong> Google (AI), Supabase (database), Vercel (hosting)
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">•</span>
                                        <strong>Kewajiban Hukum:</strong> Jika diwajibkan oleh hukum
                                    </li>
                                </ul>
                            </section>

                            {/* Section 5 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">5. Keamanan Data</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed mb-3">
                                    Kami menerapkan langkah-langkah keamanan industri standar:
                                </p>
                                <ul className="text-sm text-zinc-600 space-y-2 ml-4">
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">🔒</span>
                                        Enkripsi data dalam transit (HTTPS)
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">🔑</span>
                                        Autentikasi aman
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-zinc-400">👁</span>
                                        Akses terbatas ke data pengguna
                                    </li>
                                </ul>
                            </section>

                            {/* Section 6 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">6. Penyimpanan Data</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Data Anda disimpan selama akun Anda aktif. Setelah penghapusan akun,
                                    data akan dihapus dalam <strong>30 hari</strong>, kecuali diwajibkan untuk disimpan
                                    oleh hukum.
                                </p>
                            </section>

                            {/* Section 7 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">7. Hak Anda</h2>
                                <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100">
                                    <p className="text-sm text-zinc-600 mb-3">Anda memiliki hak untuk:</p>
                                    <ul className="text-sm text-zinc-600 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500">→</span>
                                            Mengakses data pribadi Anda
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500">→</span>
                                            Memperbarui atau memperbaiki informasi
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500">→</span>
                                            Menghapus akun dan data Anda
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500">→</span>
                                            Menarik persetujuan komunikasi marketing
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <span className="text-blue-500">→</span>
                                            Mengekspor data Anda
                                        </li>
                                    </ul>
                                </div>
                            </section>

                            {/* Section 8 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">8. Cookie</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Kami menggunakan cookie esensial untuk autentikasi dan preferensi.
                                    Kami <strong>tidak</strong> menggunakan cookie pelacakan pihak ketiga untuk iklan.
                                </p>
                            </section>

                            {/* Section 9 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">9. Anak-anak</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Layanan tidak ditujukan untuk anak di bawah 13 tahun. Kami tidak
                                    dengan sengaja mengumpulkan data dari anak-anak.
                                </p>
                            </section>

                            {/* Section 10 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">10. Perubahan Kebijakan</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Kami dapat memperbarui kebijakan ini. Perubahan material akan
                                    diumumkan melalui email atau notifikasi dalam aplikasi.
                                </p>
                            </section>

                            {/* Section 11 */}
                            <section>
                                <h2 className="text-base font-semibold text-zinc-900 mb-3">11. Kontak</h2>
                                <p className="text-sm text-zinc-600 leading-relaxed">
                                    Untuk pertanyaan tentang privasi, hubungi kami di{' '}
                                    <a href="mailto:hello@paapan.com" className="text-blue-600 hover:underline font-medium">
                                        hello@paapan.com
                                    </a>{' '}
                                    atau{' '}
                                    <a href="https://wa.me/62895360148909" className="text-blue-600 hover:underline font-medium">
                                        WhatsApp
                                    </a>.
                                </p>
                            </section>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
