'use client';

import Link from 'next/link';
import {
    ArrowLeft,
    Bot,
    Compass,
    CreditCard,
    HelpCircle,
    Image as ImageIcon,
    KeyRound,
    Lock,
    LucideIcon,
    MessageSquare,
    PanelLeft,
    Sparkles,
    Upload,
    Wrench,
} from 'lucide-react';

const QUICK_START_STEPS = [
    {
        step: '1',
        title: 'Masuk dan buka workspace pertama',
        description:
            'Setelah login, Paapan akan menyiapkan workspace awal Anda. Ini adalah tempat semua ide, frame, gambar, dan respons AI akan terkumpul.',
    },
    {
        step: '2',
        title: 'Tambahkan node pertama',
        description:
            'Klik di canvas untuk mulai menulis ide. Anda bisa memakai mind node, text node, drawing, atau image node sesuai cara berpikir Anda.',
    },
    {
        step: '3',
        title: 'Kirim prompt AI pertama',
        description:
            'Buka input AI lalu kirim pertanyaan singkat seperti "buat ringkasan ide bisnis ini" atau "pecah ide ini jadi langkah eksekusi".',
    },
    {
        step: '4',
        title: 'Pilih mode AI yang sesuai',
        description:
            'Gunakan Kredit Paapan jika ingin langsung jalan. Gunakan BYOK jika ingin request AI memakai API key Gemini Anda sendiri.',
    },
];

const COMMON_SCENARIOS = [
    {
        title: 'AI tidak merespons',
        body: 'Biasanya karena sesi login habis, saldo kredit habis, atau provider BYOK Anda sedang kena limit. Coba cek mode AI yang aktif, lalu kirim ulang prompt.',
    },
    {
        title: 'BYOK berhasil, tapi model belum muncul',
        body: 'Daftar model baru dimuat setelah validasi key berhasil. Jika list masih kosong, validasi ulang key Anda agar model Gemini terbaru dimuat ulang.',
    },
    {
        title: 'Upload gambar ditolak',
        body: 'Pastikan file memakai format aman seperti PNG, JPG, WEBP, GIF, BMP, atau AVIF dan ukurannya tidak melebihi batas upload.',
    },
    {
        title: 'Workspace terasa belum sinkron',
        body: 'Coba refresh halaman dan pastikan koneksi internet stabil. Untuk public test, sinkronisasi sudah aktif tetapi masih terus kami rapikan.',
    },
];

const FAQS = [
    {
        question: 'Apa beda Kredit Paapan dan BYOK?',
        answer:
            'Kredit Paapan memakai kuota AI yang disediakan oleh Paapan. BYOK memakai API key Gemini pribadi Anda sendiri, jadi billing dan quota mengikuti provider AI Anda.',
    },
    {
        question: 'Kalau BYOK aktif, apakah kredit Paapan tetap berkurang?',
        answer:
            'Tidak. Selama mode BYOK aktif, key valid, dan request memang berjalan lewat provider pribadi Anda, kredit Paapan tidak akan dipotong.',
    },
    {
        question: 'Kapan kredit free direset?',
        answer:
            'Free plan mendapat 5 kredit harian dan reset-nya dihitung dari server pada zona waktu Asia/Makassar, bukan dari jam lokal device Anda.',
    },
    {
        question: 'Mengapa provider lain sudah terlihat tetapi belum bisa dipakai?',
        answer:
            'UI multi-provider sudah kami siapkan sebagai fondasi, tetapi engine yang aktif saat ini baru Gemini. Provider lain ditampilkan sebagai segera hadir agar arah produk tetap jelas.',
    },
    {
        question: 'Apakah API key BYOK saya disimpan di cloud?',
        answer:
            'Tidak. Saat ini key BYOK disimpan lokal di browser ini agar lebih aman untuk public test dan tidak ikut tersinkron ke device lain.',
    },
    {
        question: 'Bisa kah saya langsung pakai AI tanpa login?',
        answer:
            'Tidak. Untuk menjaga keamanan, quota, dan sinkronisasi workspace, fitur AI saat ini hanya tersedia untuk pengguna yang sudah login.',
    },
];

const HELP_SECTIONS = [
    {
        id: 'mulai-cepat',
        title: 'Mulai Cepat',
        icon: Compass,
        description: 'Panduan singkat dari akun baru sampai prompt AI pertama yang berhasil.',
        points: [
            'Setelah login, workspace pertama Anda akan menjadi pusat kerja untuk semua ide dan respons AI.',
            'Node AI paling enak dipakai saat konteks Anda masih singkat dan jelas. Mulailah dari satu pertanyaan dulu.',
            'Frame berguna untuk mengelompokkan hasil brainstorming, tugas, atau topik besar agar canvas tetap rapi.',
            'Kalau Anda masih mencoba-coba, fokus dulu ke alur sederhana: tulis ide, kirim prompt, lalu rapikan hasil AI ke frame.',
        ],
    },
    {
        id: 'mode-ai',
        title: 'Mode AI',
        icon: Bot,
        description: 'Paapan saat ini punya dua mode utama untuk memakai AI, dan keduanya punya kegunaan yang berbeda.',
        points: [
            'Kredit Paapan cocok untuk mulai cepat tanpa perlu menyiapkan API key sendiri.',
            'BYOK cocok untuk user yang ingin memakai quota dan billing provider AI mereka sendiri.',
            'Mode AI aktif selalu menentukan jalur request yang dipakai saat Anda mengirim prompt.',
            'Untuk public test, provider BYOK yang aktif saat ini baru Gemini.',
        ],
    },
    {
        id: 'byok',
        title: 'BYOK',
        icon: KeyRound,
        description: 'Bring Your Own Key untuk user yang ingin memakai Gemini API key pribadi mereka sendiri.',
        points: [
            'Masukkan Gemini API key Anda di Pengaturan AI lalu klik Validasi.',
            'Setelah validasi berhasil, Paapan akan mendeteksi model Gemini yang benar-benar tersedia dari key Anda.',
            'Model AI baru akan tampil setelah key tervalidasi, supaya list yang muncul benar-benar relevan untuk akun Anda.',
            'Jika quota provider Anda habis, request BYOK bisa gagal walau key tetap valid.',
        ],
    },
    {
        id: 'kredit',
        title: 'Kredit',
        icon: CreditCard,
        description: 'Sistem kredit menjaga pemakaian AI tetap jelas, terukur, dan konsisten dari server.',
        points: [
            'Free plan mendapat 5 kredit harian dari server.',
            'Reset kredit free mengikuti waktu server Asia/Makassar, bukan jam di device Anda.',
            'Jika saldo tidak cukup, AI akan menolak request dengan pesan yang jelas dan UI akan sinkron ulang ke saldo server.',
            'Saat public test, pembelian kredit belum dibuka dan paket berbayar masih disiapkan bertahap.',
        ],
    },
    {
        id: 'canvas',
        title: 'Canvas Dasar',
        icon: PanelLeft,
        description: 'Fitur dasar yang paling sering dipakai di canvas Paapan untuk berpikir, memetakan, dan merapikan ide.',
        points: [
            'Mind node untuk menulis ide, ringkasan, dan hasil AI.',
            'Frame untuk mengelompokkan area kerja agar ide lebih rapi.',
            'Text dan drawing cocok untuk catatan cepat, sketsa, dan penjelasan visual ringan.',
            'Gunakan drag, zoom, dan connect antar node untuk membangun alur berpikir Anda.',
        ],
    },
    {
        id: 'upload-gambar',
        title: 'Upload Gambar',
        icon: Upload,
        description: 'Gambar bisa dipakai sebagai konteks visual untuk berpikir bersama AI dan memperkaya isi canvas Anda.',
        points: [
            'Format aman seperti PNG, JPG, WEBP, GIF, BMP, dan AVIF didukung.',
            'SVG tidak didukung untuk alasan keamanan.',
            'Upload bisa ditolak jika ukuran file terlalu besar atau kuota storage penuh.',
            'Saat gambar berhasil diunggah, node image akan muncul dan bisa ikut dipakai sebagai konteks AI.',
        ],
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: Wrench,
        description: 'Beberapa masalah umum yang paling sering ditemui saat public test beserta arah cek awalnya.',
        points: [
            'Jika AI tidak merespons, cek dulu apakah sesi login Anda masih aktif dan mode AI Anda benar.',
            'Jika BYOK valid tetapi request gagal, kemungkinan quota provider Anda sedang habis atau kena limit.',
            'Jika model BYOK belum muncul, validasi ulang key agar daftar model dimuat ulang.',
            'Jika workspace terasa tidak sinkron, refresh halaman lalu cek koneksi internet Anda.',
        ],
    },
    {
        id: 'privasi-keamanan',
        title: 'Privasi & Keamanan',
        icon: Lock,
        description: 'Hal-hal penting tentang data, keamanan, dan public test.',
        points: [
            'Paapan memakai koneksi aman dan pembatasan keamanan dasar untuk melindungi request Anda.',
            'API key BYOK disimpan lokal di browser ini, bukan di cloud Paapan.',
            'Konten AI diproses oleh provider AI yang relevan sesuai mode yang Anda pakai.',
            'Karena ini masih public test, beberapa fitur masih bisa berubah secara bertahap.',
        ],
    },
    {
        id: 'hubungi-kami',
        title: 'Hubungi Kami',
        icon: MessageSquare,
        description: 'Kalau Anda buntu, jangan diam sendiri.',
        points: [
            'Gunakan menu Feedback untuk mengirim masukan cepat via WhatsApp.',
            'Gunakan halaman ini dulu untuk jawaban umum sebelum menghubungi tim.',
            'Saat melapor bug, sertakan langkah kejadian, screenshot, dan akun/plan yang dipakai.',
            'Untuk bantuan langsung, tim Paapan tetap bisa dihubungi via WhatsApp bisnis.',
        ],
    },
];

function HelpSection({
    id,
    title,
    description,
    points,
    icon: Icon,
}: {
    id: string;
    title: string;
    description: string;
    points: string[];
    icon: LucideIcon;
}) {
    return (
        <section id={id} className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                    <Icon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
                </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 sm:p-5">
                <ul className="space-y-3">
                    {points.map((point) => (
                        <li key={point} className="flex items-start gap-3 text-sm leading-6 text-zinc-700">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                            <span>{point}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

function SectionTitle({
    id,
    title,
    description,
}: {
    id: string;
    title: string;
    description: string;
}) {
    return (
        <div id={id} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 sm:text-base">{description}</p>
        </div>
    );
}

export default function HelpPage() {
    return (
        <div className="min-h-screen bg-zinc-100">
            <div className="px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-6xl rounded-[28px] bg-zinc-200 p-2.5">
                    <div className="overflow-hidden rounded-[24px] bg-white">
                        <div className="border-b border-zinc-100 px-6 py-6 sm:px-8 sm:py-7">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                            >
                                <ArrowLeft size={18} />
                                <span>Kembali</span>
                            </Link>

                            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div className="max-w-2xl">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                                        <HelpCircle size={14} />
                                        Pusat Bantuan
                                    </div>
                                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 sm:text-4xl">
                                        Semua yang perlu Anda tahu untuk mulai memakai Paapan.
                                    </h1>
                                    <p className="mt-3 text-sm leading-6 text-zinc-500 sm:text-base">
                                        Halaman ini merangkum cara kerja AI, kredit, BYOK, upload gambar, dan langkah cepat
                                        saat Anda butuh bantuan selama public test.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex items-center gap-2 text-zinc-700">
                                            <Sparkles size={16} />
                                            <span className="text-sm font-semibold">Public test</span>
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                                            Beberapa fitur masih tumbuh cepat dan bisa berubah bertahap.
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                        <div className="flex items-center gap-2 text-zinc-700">
                                            <ImageIcon size={16} />
                                            <span className="text-sm font-semibold">Butuh bantuan cepat?</span>
                                        </div>
                                        <a
                                            href="https://wa.me/62895360148909?text=Halo%20Admin%20Paapan!%20Saya%20butuh%20bantuan:"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
                                        >
                                            Hubungi tim via WhatsApp
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-8 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
                            <aside className="lg:sticky lg:top-6 lg:self-start">
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
                                        Isi Bantuan
                                    </p>
                                    <nav className="mt-4 space-y-1.5">
                                        <a
                                            href="#alur-pertama"
                                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                                        >
                                            <Compass size={16} className="text-zinc-400" />
                                            <span>Alur Pertama</span>
                                        </a>
                                        <a
                                            href="#yang-sering-terjadi"
                                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                                        >
                                            <Wrench size={16} className="text-zinc-400" />
                                            <span>Masalah Umum</span>
                                        </a>
                                        {HELP_SECTIONS.map((section) => (
                                            <a
                                                key={section.id}
                                                href={`#${section.id}`}
                                                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                                            >
                                                <section.icon size={16} className="text-zinc-400" />
                                                <span>{section.title}</span>
                                            </a>
                                        ))}
                                        <a
                                            href="#faq"
                                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900"
                                        >
                                            <HelpCircle size={16} className="text-zinc-400" />
                                            <span>FAQ</span>
                                        </a>
                                    </nav>
                                </div>
                            </aside>

                            <div className="space-y-5">
                                <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
                                    <SectionTitle
                                        id="alur-pertama"
                                        title="Alur Pertama Kali"
                                        description="Kalau ini pertama kalinya Anda memakai Paapan, ikuti alur sederhana ini. Tujuannya supaya Anda cepat sampai ke momen pertama ketika canvas dan AI mulai terasa nyambung."
                                    />

                                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                        {QUICK_START_STEPS.map((item) => (
                                            <div key={item.step} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-zinc-700 shadow-sm">
                                                    {item.step}
                                                </div>
                                                <h3 className="mt-4 text-base font-semibold text-zinc-900">{item.title}</h3>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
                                    <SectionTitle
                                        id="yang-sering-terjadi"
                                        title="Masalah yang Paling Sering Terjadi"
                                        description="Bagian ini dibuat dari pola pertanyaan yang biasanya muncul saat public test. Kalau Anda terburu-buru, mulai dari sini dulu."
                                    />

                                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                        {COMMON_SCENARIOS.map((item) => (
                                            <div key={item.title} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                                                <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {HELP_SECTIONS.map((section) => (
                                    <HelpSection key={section.id} {...section} />
                                ))}

                                <section id="faq" className="scroll-mt-24 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-7">
                                    <SectionTitle
                                        id="faq-title"
                                        title="FAQ"
                                        description="Beberapa pertanyaan yang kemungkinan besar akan muncul saat Anda baru mencoba Paapan, terutama di area AI, kredit, dan BYOK."
                                    />

                                    <div className="mt-6 space-y-4">
                                        {FAQS.map((item) => (
                                            <div key={item.question} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-5">
                                                <h3 className="text-base font-semibold text-zinc-900">{item.question}</h3>
                                                <p className="mt-2 text-sm leading-6 text-zinc-600">{item.answer}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
