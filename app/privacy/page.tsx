'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
    return (
        <div className="fixed inset-0 overflow-y-auto bg-zinc-100">
            <div className="px-4 py-8">
                <div className="mx-auto max-w-3xl rounded-2xl bg-zinc-200 p-2.5">
                    <div className="overflow-hidden rounded-xl bg-white">
                        <div className="border-b border-zinc-100 px-8 py-6">
                            <Link
                                href="/"
                                className="mb-6 inline-flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-900"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-sm font-medium">Kembali</span>
                            </Link>

                            <h1 className="mb-1 text-2xl font-bold text-zinc-900">Kebijakan Privasi</h1>
                            <p className="text-sm text-zinc-400">Terakhir diperbarui: 14 April 2026</p>
                        </div>

                        <div className="space-y-8 px-8 py-8">
                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">1. Pengendali Data</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Paapan adalah layanan digital yang dikelola oleh tim Paapan. Kontak resmi: {' '}
                                    <a href="mailto:hello@paapan.com" className="font-medium text-blue-600 hover:underline">
                                        hello@paapan.com
                                    </a>.
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                                    Catatan: detail identitas badan hukum dan alamat korespondensi legal akan diperbarui
                                    pada versi kebijakan berikutnya.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">2. Data yang Kami Kumpulkan</h2>
                                <ul className="ml-4 list-disc space-y-2 text-sm text-zinc-600">
                                    <li>Data akun: nama, email, dan preferensi akun.</li>
                                    <li>Data workspace: konten board, teks, gambar, relasi node, dan metadata terkait.</li>
                                    <li>Data penggunaan: log aktivitas, histori kredit, dan interaksi fitur.</li>
                                    <li>Data teknis: alamat IP, user agent, data sesi, dan cookie esensial.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">3. Tujuan dan Dasar Pemrosesan</h2>
                                <p className="mb-3 text-sm leading-relaxed text-zinc-600">
                                    Kami memproses data untuk operasional layanan, keamanan akun, dukungan pengguna,
                                    peningkatan produk, serta kepatuhan hukum.
                                </p>
                                <ul className="ml-4 list-disc space-y-2 text-sm text-zinc-600">
                                    <li>Persetujuan Anda.</li>
                                    <li>Pelaksanaan perjanjian layanan.</li>
                                    <li>Kewajiban hukum yang berlaku.</li>
                                    <li>Kepentingan sah yang proporsional dan terukur.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">4. Pemrosesan AI dan Pihak Ketiga</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Saat Anda memakai fitur AI, input Anda dapat diproses oleh penyedia model AI (misalnya
                                    Google Gemini) sesuai kebutuhan jawaban. Infrastruktur data dan hosting juga dapat
                                    melibatkan penyedia pihak ketiga seperti Supabase dan Vercel.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">5. Berbagi Data dan Transfer Lintas Negara</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Kami tidak menjual data pribadi. Data hanya dibagikan seperlunya kepada penyedia
                                    layanan atau bila diwajibkan hukum. Dalam hal transfer lintas negara, kami berupaya
                                    memastikan perlindungan setara melalui kontrak, kontrol akses, dan pengamanan teknis
                                    yang wajar.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">6. Keamanan Data</h2>
                                <ul className="ml-4 list-disc space-y-2 text-sm text-zinc-600">
                                    <li>Enkripsi data saat transit (HTTPS/TLS).</li>
                                    <li>Kontrol akses berbasis otorisasi dan pembatasan akses internal.</li>
                                    <li>Monitoring dan pencatatan aktivitas penting untuk investigasi insiden.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">7. Retensi dan Penghapusan</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Data disimpan selama akun aktif. Jika akun dijadwalkan dihapus, data akan diproses
                                    untuk penghapusan permanen paling lambat <strong>7 hari</strong> sejak penjadwalan
                                    penghapusan, kecuali ada kewajiban retensi berdasarkan hukum.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">8. Hak Anda sebagai Subjek Data</h2>
                                <p className="mb-3 text-sm leading-relaxed text-zinc-600">
                                    Anda dapat meminta akses, koreksi, pembaruan, penghapusan, pembatasan, keberatan,
                                    penarikan persetujuan, dan portabilitas data sesuai hukum yang berlaku.
                                </p>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Permintaan diajukan ke {' '}
                                    <a href="mailto:hello@paapan.com" className="font-medium text-blue-600 hover:underline">
                                        hello@paapan.com
                                    </a> {' '}
                                    dengan subjek “Permintaan Data Pribadi”. Kami akan melakukan verifikasi identitas
                                    sebelum memproses permintaan.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">9. Cookie</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Kami menggunakan cookie esensial untuk autentikasi, keamanan sesi, dan preferensi
                                    dasar aplikasi. Kami tidak memakai cookie iklan pihak ketiga.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">10. Batas Usia</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Layanan ditujukan untuk pengguna berusia <strong>18 tahun ke atas</strong>.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">11. Insiden Pelindungan Data</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Jika terjadi kegagalan pelindungan data pribadi yang berdampak pada pengguna, kami
                                    akan melakukan pemberitahuan secara tertulis sesuai ketentuan peraturan perundang-undangan.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">12. Perubahan Kebijakan</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Kebijakan ini dapat diperbarui dari waktu ke waktu. Perubahan material akan
                                    diumumkan melalui kanal yang wajar (email atau notifikasi dalam aplikasi).
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">13. Kontak</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Untuk pertanyaan privasi: {' '}
                                    <a href="mailto:hello@paapan.com" className="font-medium text-blue-600 hover:underline">
                                        hello@paapan.com
                                    </a> {' '}
                                    atau {' '}
                                    <a href="https://wa.me/62895360148909" className="font-medium text-blue-600 hover:underline">
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
