"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Users, Server, Zap, DollarSign, Database, BrainCircuit, CreditCard, ChevronRight } from 'lucide-react';

export default function BusinessSimulationPage() {
    // Parameter Simulasi yang bisa diatur pengguna
    const [initialUsers, setInitialUsers] = useState<number>(100);
    const [monthlyGrowthRate, setMonthlyGrowthRate] = useState<number>(30); // 30%
    const [conversionRatePlus, setConversionRatePlus] = useState<number>(4); // 4%
    const [conversionRatePro, setConversionRatePro] = useState<number>(1); // 1%

    // Asumsi Biaya (Realistis update Gemini 2.5 series)
    const AI_COST_PER_CREDIT = 8; // Rp 8 per credit (Blended cost antara 2.0 Flash Lite gratisan, 2.5 Flash, dan 2.5 Pro yang lebih mahal)
    const VERCEL_PRO_COST = 310000; // $20 (~Rp 310.000)
    const SUPABASE_PRO_COST = 390000; // $25 (~Rp 390.000)

    // Asumsi Penggunaan
    const FREE_USER_DAU_RATE = 0.2; // 20% pengguna gratis aktif tiap hari
    const CREDITS_PER_DAY_FREE = 5;
    const AVG_USAGE_RATE = 0.6; // Pengguna berbayar rata-rata menghabiskan 60% dari kuota mereka
    const PLUS_CREDITS = 300;
    const PRO_CREDITS = 1500;

    // Harga Paket
    const PRICE_PLUS = 29000;
    const PRICE_PRO = 79000;
    const PG_FEE = 0.05; // 5% potongan Payment Gateway

    // Hitung Simulasi 12 Bulan
    const simulationData = useMemo(() => {
        let currentUsers = initialUsers;
        const data = [];

        for (let month = 1; month <= 12; month++) {
            // Pengguna Bulan Ini
            const plusUsers = Math.round(currentUsers * (conversionRatePlus / 100));
            const proUsers = Math.round(currentUsers * (conversionRatePro / 100));
            const freeUsers = currentUsers - plusUsers - proUsers;

            // Biaya AI
            const freeAiCost = freeUsers * FREE_USER_DAU_RATE * CREDITS_PER_DAY_FREE * 30 * AI_COST_PER_CREDIT;
            const plusAiCost = plusUsers * PLUS_CREDITS * AVG_USAGE_RATE * AI_COST_PER_CREDIT;
            const proAiCost = proUsers * PRO_CREDITS * AVG_USAGE_RATE * AI_COST_PER_CREDIT;
            const totalAiCost = freeAiCost + plusAiCost + proAiCost;

            // Kapan harus upgrade infrastruktur?
            // Vercel: Perlu Pro ketika traffic mulai signifikan / butuh bypass batas fungsi server (asumsi di > 1000 user)
            const needsVercelPro = currentUsers > 1000;
            // Supabase: Perlu Pro ketika melampaui 500MB database, 50k MAU, atau butuh auto-backup (asumsi di > 2000 user)
            const needsSupabasePro = currentUsers > 2000;

            const vercelCost = needsVercelPro ? VERCEL_PRO_COST : 0;
            const supabaseCost = needsSupabasePro ? SUPABASE_PRO_COST : 0;

            // Storage Costs (AWS S3 / Supabase Storage for User Images)
            // Asumsi: Rata-rata 1 User Premium unggah 5MB/Bulan, Free 1MB/Bulan
            const totalStorageMB_month = (plusUsers * 5) + (proUsers * 10) + (freeUsers * 1);
            // Akumulasi storage per bulan (karena file menetap)
            // Supabase storage Pro = $25/bulan include DB (Sudah dicover di atas). 
            // Kalau free limitnya 1 GB. Jadi kalau total > 1000 MB dan masih free, akan hit limit.
            // Biaya tambahan storage: misal Rp 1.500 per GB ($0.1 per GB S3)
            const overageStorageGB = Math.max(0, (totalStorageMB_month * month) / 1000 - 1);
            const storageCost = overageStorageGB * 1500;

            const totalInfraCost = vercelCost + supabaseCost + storageCost;

            // Overhead tetap bulanan (Domain, email provider, tool operasional minimal)
            // Asumsi Domain + Basic Tools = Rp 50.000 / bulan
            const fixedOverhead = 50000;

            // Pemasukan
            const grossRevenue = (plusUsers * PRICE_PLUS) + (proUsers * PRICE_PRO);
            const netRevenue = grossRevenue * (1 - PG_FEE);

            // Profit (Dipotong pajak 11% PPN dsb - asumsi simplifikasi di margin akhir aja)
            let netProfit = netRevenue - totalAiCost - totalInfraCost - fixedOverhead;

            // Anggap kena pajak penghasilan/badan kalau profit sudah di atas 10 Juta per bulan (simplifikasi UMKM 0.5%)
            if (netProfit > 10000000) {
                netProfit = netProfit * 0.995;
            }

            data.push({
                month,
                totalUsers: currentUsers,
                freeUsers,
                plusUsers,
                proUsers,
                totalAiCost,
                vercelCost,
                supabaseCost,
                storageCost,
                fixedOverhead,
                netRevenue,
                netProfit,
                grossRevenue
            });

            // Growth untuk bulan depan
            currentUsers = Math.round(currentUsers * (1 + (monthlyGrowthRate / 100)));
        }

        return data;
    }, [initialUsers, monthlyGrowthRate, conversionRatePlus, conversionRatePro]);

    const formatRupiah = (num: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    };

    return (
        <div className="h-screen overflow-y-auto bg-slate-50 text-slate-800 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors self-start sm:self-auto">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Dokumentasi Bisnis & Simulasi</h1>
                        <p className="text-sm text-slate-500">Proyeksi finansial Paapan selama 12 bulan</p>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-12">

                {/* Bagian 1: Harga & Modal */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                        <DollarSign className="w-8 h-8 text-blue-600 p-1.5 bg-blue-100 rounded-lg shrink-0" />
                        <h2 className="text-xl sm:text-2xl font-bold">Model Bisnis & Struktur Modal</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Struktur Modal 1: AI */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <BrainCircuit className="w-8 h-8 text-fuchsia-500 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Modal AI (Gemini 2.5)</h3>
                            <p className="text-slate-600 text-sm mb-4">
                                Penggunaan API dihitung menggunakan *blended cost* model `gemini-2.0-flash-lite`, `2.5-flash` (Plus), dan `2.5-pro` (Pro).
                            </p>
                            <ul className="text-sm space-y-2 text-slate-600">
                                <li className="flex justify-between"><span>Input/Output (Blended)</span> <span className="font-medium text-slate-900">~Rp 8 / kredit</span></li>
                                <li className="flex justify-between"><span>Beban Free User (Asumsi)</span> <span className="font-medium text-emerald-600">Rp 240 / bulan</span></li>
                                <li className="flex justify-between"><span>Beban Pro (Asumsi 60%)</span> <span className="font-medium text-amber-600">Rp 7.200 / bulan</span></li>
                            </ul>
                        </div>

                        {/* Struktur Modal 2: Server */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <Server className="w-8 h-8 text-slate-700 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Modal Hosting (Vercel)</h3>
                            <p className="text-slate-600 text-sm mb-4">
                                Aplikasi di-*host* di Vercel menggunakan Edge Network dan Serverless Functions untuk Next.js.
                            </p>
                            <ul className="text-sm space-y-2 text-slate-600">
                                <li className="flex justify-between"><span>Fase Awal (&lt; 1k user)</span> <span className="font-medium text-emerald-600">Gratis (Hobby)</span></li>
                                <li className="flex justify-between"><span>Fase Pertumbuhan</span> <span className="font-medium text-amber-600">Rp 310.000 / bln (Pro)</span></li>
                                <li className="flex justify-between"><span>Pemicu Upgrade</span> <span className="font-medium text-slate-900">Edge Function Timeout</span></li>
                            </ul>
                        </div>

                        {/* Struktur Modal 3: Database & Storage */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <Database className="w-8 h-8 text-emerald-500 mb-4" />
                            <h3 className="text-lg font-semibold mb-2">DB & Storage (Supabase)</h3>
                            <p className="text-slate-600 text-sm mb-4">
                                Menyimpan users, workspace JSON, dan file gambar pengguna (S3 Bucket).
                            </p>
                            <ul className="text-sm space-y-2 text-slate-600">
                                <li className="flex justify-between"><span>Biaya Inti (Pro)</span> <span className="font-medium text-amber-600">Rp 390.000 / bln</span></li>
                                <li className="flex justify-between"><span>Extra Storage (Gambar)</span> <span className="font-medium text-slate-900">~Rp 1.500 / GB</span></li>
                                <li className="flex justify-between"><span>Pemicu Upgrade</span> <span className="font-medium text-slate-900">Disk &gt;500MB / File &gt;1GB</span></li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="bg-blue-50 border border-blue-100 p-6 rounded-2xl">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">Overhead Bulanan Lainnya</h3>
                    <p className="text-blue-800 text-sm">
                        Simulasi ini juga memperhitungkan biaya <strong>Overhead (Domain, Email Bisnis)</strong> sebesar rata-rata Rp 50.000 / bulan, potongan <strong>Payment Gateway (Midtrans/Xendit)</strong> sebesar 5% per transaksi, serta potongan wajib <strong>Pajak UMKM 0.5%</strong> otomatis jika profit bersih di bulan tersebut melebihi Rp 10.000.000.
                    </p>
                </section>

                {/* Bagian 2: Konfigurator Simulasi */}
                <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                        <TrendingUp className="w-8 h-8 text-violet-600 p-1.5 bg-violet-100 rounded-lg shrink-0" />
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold">Kalkulator Simulasi Bisnis Pertama</h2>
                            <p className="text-slate-500 text-xs sm:text-sm mt-1">Ubah variabel di bawah ini untuk melihat proyeksi 12 bulan.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 bg-slate-50 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-6 sm:mb-8 border border-slate-100">
                        {/* Control 1 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Pengguna Awal (Bulan 1)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="10" max="1000" step="10" value={initialUsers} onChange={(e) => setInitialUsers(parseInt(e.target.value))} className="w-full accent-violet-600" />
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border min-w-[3rem] text-center">{initialUsers}</span>
                            </div>
                        </div>
                        {/* Control 2 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Pertumbuhan Bulanan (%)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="0" max="100" step="5" value={monthlyGrowthRate} onChange={(e) => setMonthlyGrowthRate(parseInt(e.target.value))} className="w-full accent-violet-600" />
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border min-w-[3rem] text-center">{monthlyGrowthRate}%</span>
                            </div>
                        </div>
                        {/* Control 3 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Konversi ke Paket Plus (%)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="0" max="20" step="1" value={conversionRatePlus} onChange={(e) => setConversionRatePlus(parseFloat(e.target.value))} className="w-full accent-violet-600" />
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border min-w-[3rem] text-center">{conversionRatePlus}%</span>
                            </div>
                        </div>
                        {/* Control 4 */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Konversi ke Paket Pro (%)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="0" max="10" step="0.5" value={conversionRatePro} onChange={(e) => setConversionRatePro(parseFloat(e.target.value))} className="w-full accent-violet-600" />
                                <span className="text-sm font-mono bg-white px-2 py-1 rounded border min-w-[3rem] text-center">{conversionRatePro}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabel Data */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="py-4 px-2 font-semibold text-slate-600">Bulan</th>
                                    <th className="py-4 px-2 font-semibold text-slate-600">Total User</th>
                                    <th className="py-4 px-2 font-semibold text-slate-600 text-center">Free / Plus / Pro</th>
                                    <th className="py-4 px-2 font-semibold text-rose-600 text-right">Modal Server</th>
                                    <th className="py-4 px-2 font-semibold text-rose-600 text-right">Modal AI</th>
                                    <th className="py-4 px-2 font-semibold text-emerald-600 text-right">Pendapatan Kotor</th>
                                    <th className="py-4 px-2 font-bold text-slate-900 text-right">Profit Bersih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulationData.map((data) => (
                                    <tr key={data.month} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-3 px-2 font-medium">Bulan {data.month}</td>
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-1.5">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                {data.totalUsers.toLocaleString('id-ID')}
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-center text-slate-500 font-mono text-xs">
                                            {data.freeUsers} / {data.plusUsers} / {data.proUsers}
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            {(data.vercelCost === 0 && data.supabaseCost === 0 && data.storageCost === 0) ? (
                                                <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium">Free Tier</span>
                                            ) : (
                                                <span className="text-rose-600 font-mono text-xs">{formatRupiah(data.vercelCost + data.supabaseCost + data.storageCost + data.fixedOverhead)}</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-2 text-right text-rose-600 font-mono text-xs">
                                            {formatRupiah(data.totalAiCost)}
                                        </td>
                                        <td className="py-3 px-2 text-right text-emerald-600 font-mono text-xs">
                                            {formatRupiah(data.grossRevenue)}
                                        </td>
                                        <td className={`py-3 px-2 text-right font-bold w-40 ${data.netProfit < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {formatRupiah(data.netProfit)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Highlight Box Bulan Ke-12 */}
                    <div className="mt-8 bg-blue-50 border border-blue-100 p-4 sm:p-6 rounded-xl sm:rounded-2xl">
                        <h4 className="font-semibold text-blue-900 mb-4 text-center sm:text-left">Ringkasan Bulan ke-12</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-center sm:text-left">
                            <div className="bg-white p-3 rounded-lg sm:p-0 sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-blue-600/80 mb-1">Total Pengguna</p>
                                <p className="text-lg sm:text-xl font-bold text-blue-900">{simulationData[11].totalUsers.toLocaleString('id-ID')} orang</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg sm:p-0 sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-blue-600/80 mb-1">Total Biaya Operasional</p>
                                <p className="text-lg sm:text-xl font-bold text-rose-700">{formatRupiah(simulationData[11].totalAiCost + simulationData[11].vercelCost + simulationData[11].supabaseCost + simulationData[11].storageCost + simulationData[11].fixedOverhead)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg sm:p-0 sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-blue-600/80 mb-1">Total Pendapatan (Bln 12)</p>
                                <p className="text-lg sm:text-xl font-bold text-emerald-700">{formatRupiah(simulationData[11].grossRevenue)}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg sm:p-0 sm:bg-transparent">
                                <p className="text-xs sm:text-sm text-blue-600/80 mb-1">Laba Bersih Akhir</p>
                                <p className={`text-lg sm:text-xl font-bold ${simulationData[11].netProfit < 0 ? 'text-rose-700' : 'text-blue-900'}`}>
                                    {formatRupiah(simulationData[11].netProfit)}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
