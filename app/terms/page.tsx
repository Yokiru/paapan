'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
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

                            <h1 className="mb-1 text-2xl font-bold text-zinc-900">Syarat Layanan</h1>
                            <p className="text-sm text-zinc-400">Terakhir diperbarui: 2 Juli 2026</p>
                        </div>

                        <div className="space-y-8 px-8 py-8">
                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">1. Penerimaan Syarat</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Dengan mengakses atau menggunakan Paapan, Anda menyatakan telah membaca,
                                    memahami, dan menyetujui Syarat Layanan ini serta Kebijakan Privasi kami.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">2. Deskripsi Layanan</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Paapan adalah workspace visual berbasis AI untuk membuat, menyusun, dan mengelola
                                    konten kerja digital, termasuk teks, node, relasi, dan media.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">3. Kelayakan Pengguna</h2>
                                <ul className="ml-4 list-disc space-y-2 text-sm text-zinc-600">
                                    <li>Anda harus berusia minimal <strong>18 tahun</strong>.</li>
                                    <li>Anda wajib memberikan data registrasi yang akurat dan terbaru.</li>
                                    <li>Anda bertanggung jawab atas keamanan kredensial akun Anda.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">4. Penggunaan yang Dilarang</h2>
                                <ul className="ml-4 list-disc space-y-2 text-sm text-zinc-600">
                                    <li>Menggunakan layanan untuk aktivitas yang melanggar hukum.</li>
                                    <li>Mengunggah atau menyebarkan konten yang melanggar hak pihak lain.</li>
                                    <li>Mencoba mengakses sistem tanpa izin atau mengganggu keamanan layanan.</li>
                                    <li>Menyalahgunakan fitur AI untuk aktivitas berbahaya atau melanggar hukum.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">5. Kredit dan Fitur Berbayar</h2>
                                <p className="mb-3 text-sm leading-relaxed text-zinc-600">
                                    Pada fase Open Beta, detail komersial dapat berubah sewaktu-waktu. Paket berbayar
                                    dan checkout otomatis belum aktif secara umum. Jika fitur berbayar diaktifkan
                                    nanti, ketentuan harga, masa berlaku, dan pembatasan penggunaan akan
                                    diinformasikan secara jelas di aplikasi.
                                </p>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Kredit tidak dapat diuangkan, kecuali dinyatakan lain secara tertulis.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">6. Konten Pengguna</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Anda tetap memiliki hak atas konten yang Anda unggah. Anda memberi Paapan lisensi
                                    terbatas, non-eksklusif, dan diperlukan secara teknis untuk menyimpan, menampilkan,
                                    serta memproses konten demi operasional layanan.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">7. Privasi dan Data Pribadi</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Pemrosesan data pribadi tunduk pada Kebijakan Privasi Paapan dan ketentuan hukum
                                    yang berlaku. Dengan memakai layanan, Anda memahami bahwa data dapat diproses
                                    oleh infrastruktur dan penyedia layanan yang relevan.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">8. Batasan Tanggung Jawab</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Layanan disediakan “sebagaimana adanya”. Kami berupaya menjaga ketersediaan dan
                                    kualitas, tetapi tidak menjamin layanan selalu bebas gangguan atau sepenuhnya tanpa
                                    kesalahan. Output AI bersifat bantuan informasi dan bukan nasihat profesional.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">9. Perubahan Layanan dan Syarat</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Kami dapat mengubah fitur layanan dan Syarat Layanan ini dari waktu ke waktu.
                                    Perubahan material akan diumumkan melalui kanal yang wajar.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">10. Hukum yang Berlaku</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Syarat ini ditafsirkan dan dijalankan berdasarkan hukum Republik Indonesia.
                                </p>
                            </section>

                            <section>
                                <h2 className="mb-3 text-base font-semibold text-zinc-900">11. Kontak</h2>
                                <p className="text-sm leading-relaxed text-zinc-600">
                                    Untuk pertanyaan terkait syarat layanan: {' '}
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
