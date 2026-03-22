"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    CreditCard,
    Database,
    DollarSign,
    Server,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { CREDIT_COSTS, SUBSCRIPTION_PLANS, formatPrice } from '@/lib/creditCosts';

const USD_TO_IDR = 16500;

const VERCEL_PRO_MONTHLY_IDR = 20 * USD_TO_IDR;
const VERCEL_PRO_INCLUDED_USAGE_CREDIT_IDR = 20 * USD_TO_IDR;
const SUPABASE_PRO_MONTHLY_IDR = 25 * USD_TO_IDR;
const SUPABASE_PRO_COMPUTE_CREDITS_IDR = 10 * USD_TO_IDR;

const FREE_STORAGE_LIMIT_MB = 1024;
const FREE_DATABASE_LIMIT_MB = 500;
const SUPABASE_FREE_MAU_LIMIT = 50000;
const SUPABASE_PRO_STORAGE_INCLUDED_GB = 100;
const SUPABASE_PRO_DATABASE_INCLUDED_GB = 8;
const SUPABASE_PRO_EGRESS_INCLUDED_GB = 250;
const SUPABASE_PRO_MAU_INCLUDED = 100000;
const SUPABASE_STORAGE_OVERAGE_PER_GB_IDR = 350;
const SUPABASE_DATABASE_OVERAGE_PER_GB_IDR = 0.125 * USD_TO_IDR;
const SUPABASE_EGRESS_OVERAGE_PER_GB_IDR = 0.09 * USD_TO_IDR;
const SUPABASE_MAU_OVERAGE_PER_USER_IDR = 0.00325 * USD_TO_IDR;
const MONTHLY_FIXED_OVERHEAD_IDR = 50000;
const PAYMENT_GATEWAY_FEE_RATE = 0.02;

const FREE_USER_ACTIVE_RATE = 0.15;
const FREE_CREDIT_USAGE_RATE = 0.65;
const PLUS_USAGE_RATE = 0.55;
const PRO_USAGE_RATE = 0.45;

const FREE_STORAGE_MB_PER_MONTH = 0.2;
const PLUS_STORAGE_MB_PER_MONTH = 2;
const API_PRO_STORAGE_MB_PER_MONTH = 2.5;
const PRO_STORAGE_MB_PER_MONTH = 4;
const FREE_DATABASE_MB_PER_USER = 0.04;
const PLUS_DATABASE_MB_PER_USER = 0.08;
const API_PRO_DATABASE_MB_PER_USER = 0.1;
const PRO_DATABASE_MB_PER_USER = 0.12;
const FREE_EGRESS_GB_PER_MONTH = 0.01;
const PLUS_EGRESS_GB_PER_MONTH = 0.03;
const API_PRO_EGRESS_GB_PER_MONTH = 0.04;
const PRO_EGRESS_GB_PER_MONTH = 0.06;

const AI_COST_PER_CREDIT_IDR = {
    free: 0.6,
    plus: 4,
    pro: 7,
};

type PlanId = 'free' | 'plus' | 'api-pro' | 'pro';

type SimulationRow = {
    month: number;
    totalUsers: number;
    freeUsers: number;
    plusUsers: number;
    apiProUsers: number;
    proUsers: number;
    estimatedMau: number;
    accumulatedStorageMb: number;
    accumulatedDatabaseMb: number;
    estimatedEgressGb: number;
    aiCost: number;
    vercelCost: number;
    vercelIncludedUsageCredit: number;
    supabaseCost: number;
    storageOverageCost: number;
    databaseOverageCost: number;
    egressOverageCost: number;
    mauOverageCost: number;
    fixedOverhead: number;
    grossRevenue: number;
    netRevenue: number;
    netProfit: number;
};

const planById = (id: PlanId) => {
    const plan = SUBSCRIPTION_PLANS.find((item) => item.id === id);
    if (!plan) {
        throw new Error(`Missing subscription plan: ${id}`);
    }
    return plan;
};

const FREE_PLAN = planById('free');
const PLUS_PLAN = planById('plus');
const API_PRO_PLAN = planById('api-pro');
const PRO_PLAN = planById('pro');

const PAAPAN_PLAN_SUMMARY = [FREE_PLAN, PLUS_PLAN, API_PRO_PLAN, PRO_PLAN];

const CREDIT_USAGE_SUMMARY = [
    CREDIT_COSTS.chat_simple,
    CREDIT_COSTS.chat_standard,
    CREDIT_COSTS.chat_advanced,
    CREDIT_COSTS.image_analysis,
    CREDIT_COSTS.code_generation,
    CREDIT_COSTS.long_response,
];

function formatCompactNumber(value: number) {
    return new Intl.NumberFormat('id-ID').format(value);
}

function formatPercent(value: number) {
    return `${value.toFixed(1)}%`;
}

function buildSimulation({
    initialUsers,
    monthlyGrowthRate,
    conversionRatePlus,
    conversionRateApiPro,
    conversionRatePro,
}: {
    initialUsers: number;
    monthlyGrowthRate: number;
    conversionRatePlus: number;
    conversionRateApiPro: number;
    conversionRatePro: number;
}): SimulationRow[] {
    let currentUsers = initialUsers;
    let accumulatedStorageMb = 0;
    let accumulatedDatabaseMb = 0;
    const rows: SimulationRow[] = [];

    for (let month = 1; month <= 12; month++) {
        const totalPaidRate = conversionRatePlus + conversionRateApiPro + conversionRatePro;
        const normalizationFactor = totalPaidRate > 100 ? 100 / totalPaidRate : 1;

        const plusUsers = Math.round(currentUsers * ((conversionRatePlus * normalizationFactor) / 100));
        const apiProUsers = Math.round(currentUsers * ((conversionRateApiPro * normalizationFactor) / 100));
        const proUsers = Math.round(currentUsers * ((conversionRatePro * normalizationFactor) / 100));
        const paidUsers = plusUsers + apiProUsers + proUsers;
        const freeUsers = Math.max(0, currentUsers - paidUsers);
        const estimatedMau = Math.round(currentUsers * 0.55);

        const freeMonthlyCreditsUsed =
            freeUsers *
            FREE_USER_ACTIVE_RATE *
            FREE_PLAN.creditsPerDay *
            30 *
            FREE_CREDIT_USAGE_RATE;
        const plusMonthlyCreditsUsed = plusUsers * PLUS_PLAN.creditsPerMonth * PLUS_USAGE_RATE;
        const proMonthlyCreditsUsed = proUsers * PRO_PLAN.creditsPerMonth * PRO_USAGE_RATE;

        const freeAiCost = freeMonthlyCreditsUsed * AI_COST_PER_CREDIT_IDR.free;
        const plusAiCost = plusMonthlyCreditsUsed * AI_COST_PER_CREDIT_IDR.plus;
        const proAiCost = proMonthlyCreditsUsed * AI_COST_PER_CREDIT_IDR.pro;
        const aiCost = freeAiCost + plusAiCost + proAiCost;

        accumulatedStorageMb +=
            freeUsers * FREE_STORAGE_MB_PER_MONTH +
            plusUsers * PLUS_STORAGE_MB_PER_MONTH +
            apiProUsers * API_PRO_STORAGE_MB_PER_MONTH +
            proUsers * PRO_STORAGE_MB_PER_MONTH;

        accumulatedDatabaseMb +=
            freeUsers * FREE_DATABASE_MB_PER_USER +
            plusUsers * PLUS_DATABASE_MB_PER_USER +
            apiProUsers * API_PRO_DATABASE_MB_PER_USER +
            proUsers * PRO_DATABASE_MB_PER_USER;

        const estimatedEgressGb =
            freeUsers * FREE_EGRESS_GB_PER_MONTH +
            plusUsers * PLUS_EGRESS_GB_PER_MONTH +
            apiProUsers * API_PRO_EGRESS_GB_PER_MONTH +
            proUsers * PRO_EGRESS_GB_PER_MONTH;

        const needsSupabasePro =
            accumulatedStorageMb > FREE_STORAGE_LIMIT_MB * 0.85 ||
            accumulatedDatabaseMb > FREE_DATABASE_LIMIT_MB * 0.85 ||
            estimatedMau > SUPABASE_FREE_MAU_LIMIT * 0.8;
        const vercelCost = VERCEL_PRO_MONTHLY_IDR;
        const supabaseCost = needsSupabasePro
            ? Math.max(0, SUPABASE_PRO_MONTHLY_IDR - SUPABASE_PRO_COMPUTE_CREDITS_IDR)
            : 0;

        const storageOverageGb = Math.max(0, accumulatedStorageMb - FREE_STORAGE_LIMIT_MB) / 1024;
        const storageOverageCost = needsSupabasePro ? storageOverageGb * SUPABASE_STORAGE_OVERAGE_PER_GB_IDR : 0;
        const databaseOverageGb = Math.max(0, accumulatedDatabaseMb - SUPABASE_PRO_DATABASE_INCLUDED_GB * 1024) / 1024;
        const databaseOverageCost = needsSupabasePro ? databaseOverageGb * SUPABASE_DATABASE_OVERAGE_PER_GB_IDR : 0;
        const egressOverageGb = Math.max(0, estimatedEgressGb - SUPABASE_PRO_EGRESS_INCLUDED_GB);
        const egressOverageCost = needsSupabasePro ? egressOverageGb * SUPABASE_EGRESS_OVERAGE_PER_GB_IDR : 0;
        const mauOverageUsers = Math.max(0, estimatedMau - SUPABASE_PRO_MAU_INCLUDED);
        const mauOverageCost = needsSupabasePro ? mauOverageUsers * SUPABASE_MAU_OVERAGE_PER_USER_IDR : 0;

        const grossRevenue =
            plusUsers * PLUS_PLAN.priceIDR +
            apiProUsers * API_PRO_PLAN.priceIDR +
            proUsers * PRO_PLAN.priceIDR;
        const netRevenue = grossRevenue * (1 - PAYMENT_GATEWAY_FEE_RATE);
        const netProfit =
            netRevenue -
            aiCost -
            vercelCost -
            supabaseCost -
            storageOverageCost -
            databaseOverageCost -
            egressOverageCost -
            mauOverageCost -
            MONTHLY_FIXED_OVERHEAD_IDR;

        rows.push({
            month,
            totalUsers: currentUsers,
            freeUsers,
            plusUsers,
            apiProUsers,
            proUsers,
            estimatedMau,
            accumulatedStorageMb,
            accumulatedDatabaseMb,
            estimatedEgressGb,
            aiCost,
            vercelCost,
            vercelIncludedUsageCredit: VERCEL_PRO_INCLUDED_USAGE_CREDIT_IDR,
            supabaseCost,
            storageOverageCost,
            databaseOverageCost,
            egressOverageCost,
            mauOverageCost,
            fixedOverhead: MONTHLY_FIXED_OVERHEAD_IDR,
            grossRevenue,
            netRevenue,
            netProfit,
        });

        currentUsers = Math.round(currentUsers * (1 + monthlyGrowthRate / 100));
    }

    return rows;
}

export default function BusinessSimulationPage() {
    const [initialUsers, setInitialUsers] = useState(100);
    const [monthlyGrowthRate, setMonthlyGrowthRate] = useState(20);
    const [conversionRatePlus, setConversionRatePlus] = useState(4);
    const [conversionRateApiPro, setConversionRateApiPro] = useState(1);
    const [conversionRatePro, setConversionRatePro] = useState(1);

    const simulationData = useMemo(
        () =>
            buildSimulation({
                initialUsers,
                monthlyGrowthRate,
                conversionRatePlus,
                conversionRateApiPro,
                conversionRatePro,
            }),
        [initialUsers, monthlyGrowthRate, conversionRatePlus, conversionRateApiPro, conversionRatePro]
    );

    const month12 = simulationData[11];
    const totalPaidUsers = month12.plusUsers + month12.apiProUsers + month12.proUsers;
    const paidRatio = month12.totalUsers > 0 ? (totalPaidUsers / month12.totalUsers) * 100 : 0;
    const monthBreakEven = simulationData.find((row) => row.netProfit > 0)?.month ?? null;

    return (
        <div className="min-h-screen bg-slate-50 pb-20 text-slate-800">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Link
                        href="/"
                        className="self-start rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 sm:self-auto"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Dokumentasi Bisnis & Simulasi Paapan</h1>
                        <p className="text-sm text-slate-500">
                            Update Maret 2026. Simulator ini memakai plan Paapan saat ini dan asumsi resmi terbaru dari
                            Vercel & Supabase.
                        </p>
                    </div>
                </div>
            </header>

            <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8">
                <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
                    <div className="flex items-start gap-4">
                        <DollarSign className="mt-0.5 h-8 w-8 rounded-lg bg-blue-100 p-1.5 text-blue-700" />
                        <div className="space-y-3">
                            <h2 className="text-2xl font-bold text-blue-950">Baseline simulasi yang dipakai</h2>
                            <p className="max-w-4xl text-sm leading-6 text-blue-900">
                                Halaman ini bukan laporan akuntansi final, tetapi kalkulator realistis untuk menguji
                                apakah model bisnis Paapan masih sehat saat dipakai publik. Angka plan mengikuti data
                                Paapan di kode sekarang, sedangkan asumsi infrastruktur mengikuti referensi resmi
                                terbaru dari Vercel dan Supabase per 22 Maret 2026.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                        <Server className="h-8 w-8 rounded-lg bg-slate-100 p-1.5 text-slate-700" />
                        <h2 className="text-xl font-bold sm:text-2xl">Asumsi Infrastruktur Terkini</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <Server className="mb-4 h-8 w-8 text-slate-800" />
                            <h3 className="text-lg font-semibold text-slate-900">Vercel</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Untuk simulasi publik, baseline memakai <strong>Vercel Pro</strong> sejak awal
                                peluncuran berbayar. Harga referensinya sekitar <strong>{formatPrice(VERCEL_PRO_MONTHLY_IDR)}</strong>
                                {' '}per bulan dari plan Pro resmi.
                            </p>
                            <ul className="mt-4 space-y-2 text-sm text-slate-600">
                                <li className="flex justify-between gap-4">
                                    <span>Plan simulasi</span>
                                    <span className="font-medium text-slate-900">Pro</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Included usage credit</span>
                                    <span className="font-medium text-slate-900">{formatPrice(VERCEL_PRO_INCLUDED_USAGE_CREDIT_IDR)}</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Edge Requests (Pro)</span>
                                    <span className="font-medium text-slate-900">10 juta</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Asumsi kurs</span>
                                    <span className="font-medium text-slate-900">Rp 16.500 / USD</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Catatan</span>
                                    <span className="font-medium text-slate-900">Pro wajib untuk komersial</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <Database className="mb-4 h-8 w-8 text-emerald-600" />
                            <h3 className="text-lg font-semibold text-slate-900">Supabase</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Simulasi memakai <strong>Free dahulu</strong> lalu upgrade ke <strong>Pro</strong>
                                saat storage mendekati batas aman atau user sudah cukup banyak. Harga referensi Pro
                                sekitar <strong>{formatPrice(SUPABASE_PRO_MONTHLY_IDR)}</strong> per bulan dengan
                                compute credits bawaan sekitar <strong>{formatPrice(SUPABASE_PRO_COMPUTE_CREDITS_IDR)}</strong>.
                            </p>
                            <ul className="mt-4 space-y-2 text-sm text-slate-600">
                                <li className="flex justify-between gap-4">
                                    <span>Free storage</span>
                                    <span className="font-medium text-slate-900">1 GB</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Free database</span>
                                    <span className="font-medium text-slate-900">500 MB</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Free MAU</span>
                                    <span className="font-medium text-slate-900">50.000</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Pro storage / egress</span>
                                    <span className="font-medium text-slate-900">100 GB / 250 GB</span>
                                </li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <CreditCard className="mb-4 h-8 w-8 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-900">Fee transaksi & overhead</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Saya pakai asumsi konservatif untuk biaya di luar AI dan hosting, supaya hasil profit
                                tidak terlihat terlalu indah.
                            </p>
                            <ul className="mt-4 space-y-2 text-sm text-slate-600">
                                <li className="flex justify-between gap-4">
                                    <span>Payment gateway</span>
                                    <span className="font-medium text-slate-900">{formatPercent(PAYMENT_GATEWAY_FEE_RATE * 100)}</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Domain + tools dasar</span>
                                    <span className="font-medium text-slate-900">{formatPrice(MONTHLY_FIXED_OVERHEAD_IDR)}</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>Storage overage</span>
                                    <span className="font-medium text-slate-900">~{formatPrice(SUPABASE_STORAGE_OVERAGE_PER_GB_IDR)}/GB</span>
                                </li>
                                <li className="flex justify-between gap-4">
                                    <span>DB overage</span>
                                    <span className="font-medium text-slate-900">~{formatPrice(SUPABASE_DATABASE_OVERAGE_PER_GB_IDR)}/GB</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                        <Users className="h-8 w-8 rounded-lg bg-violet-100 p-1.5 text-violet-700" />
                        <h2 className="text-xl font-bold sm:text-2xl">Plan Paapan Saat Ini</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                        {PAAPAN_PLAN_SUMMARY.map((plan) => {
                            const creditLabel =
                                plan.id === 'free'
                                    ? `${plan.creditsPerDay} kredit / hari`
                                    : plan.id === 'api-pro'
                                      ? '0 kredit sistem'
                                      : `${formatCompactNumber(plan.creditsPerMonth)} kredit / bulan`;

                            const workspaceLabel =
                                plan.maxWorkspaces === -1 ? 'Unlimited workspace' : `${plan.maxWorkspaces} workspace`;

                            return (
                                <div
                                    key={plan.id}
                                    className={`rounded-2xl border p-6 shadow-sm ${
                                        plan.popular
                                            ? 'border-blue-200 bg-blue-50'
                                            : 'border-slate-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                                            <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                                        </div>
                                        {plan.popular ? (
                                            <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                                                Popular
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-5 space-y-2">
                                        <div className="text-2xl font-bold text-slate-900">{formatPrice(plan.priceIDR)}</div>
                                        <div className="text-sm text-slate-500">{creditLabel}</div>
                                    </div>

                                    <ul className="mt-5 space-y-2 text-sm text-slate-600">
                                        <li className="flex justify-between gap-4">
                                            <span>Model</span>
                                            <span className="font-medium text-slate-900">{plan.models.length}</span>
                                        </li>
                                        <li className="flex justify-between gap-4">
                                            <span>Workspace</span>
                                            <span className="font-medium text-slate-900">{workspaceLabel}</span>
                                        </li>
                                        <li className="flex justify-between gap-4">
                                            <span>Cloud sync</span>
                                            <span className="font-medium text-slate-900">{plan.cloudSync ? 'Ya' : 'Tidak'}</span>
                                        </li>
                                        <li className="flex justify-between gap-4">
                                            <span>BYOK</span>
                                            <span className="font-medium text-slate-900">{plan.byok ? 'Ya' : 'Tidak'}</span>
                                        </li>
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                        <Zap className="h-8 w-8 rounded-lg bg-amber-100 p-1.5 text-amber-700" />
                        <h2 className="text-xl font-bold sm:text-2xl">Usage Kredit Paapan</h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {CREDIT_USAGE_SUMMARY.map((usage) => (
                            <div key={usage.action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{usage.description}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{usage.model}</p>
                                    </div>
                                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                                        {usage.credits} kredit
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                        Simulasi AI di bawah memakai asumsi biaya blended yang lebih konservatif daripada sekadar harga
                        token mentah, supaya ada buffer untuk retry, long response, dan model premium. Jadi hasil profit
                        yang keluar lebih dekat ke realita operasional Paapan.
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <TrendingUp className="h-8 w-8 rounded-lg bg-emerald-100 p-1.5 text-emerald-700" />
                        <div>
                            <h2 className="text-xl font-bold sm:text-2xl">Kalkulator Simulasi 12 Bulan</h2>
                            <p className="text-sm text-slate-500">
                                Ini simulator arah bisnis. Bukan forecast akuntansi final, tapi cukup berguna untuk
                                menguji apakah Paapan sehat di skenario konservatif.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Pengguna awal</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="20"
                                    max="2000"
                                    step="20"
                                    value={initialUsers}
                                    onChange={(event) => setInitialUsers(Number(event.target.value))}
                                    className="w-full accent-emerald-600"
                                />
                                <span className="min-w-[4rem] rounded border bg-white px-2 py-1 text-center text-sm font-mono">
                                    {initialUsers}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Growth / bulan</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="60"
                                    step="5"
                                    value={monthlyGrowthRate}
                                    onChange={(event) => setMonthlyGrowthRate(Number(event.target.value))}
                                    className="w-full accent-emerald-600"
                                />
                                <span className="min-w-[4rem] rounded border bg-white px-2 py-1 text-center text-sm font-mono">
                                    {monthlyGrowthRate}%
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Konversi Plus</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="15"
                                    step="0.5"
                                    value={conversionRatePlus}
                                    onChange={(event) => setConversionRatePlus(Number(event.target.value))}
                                    className="w-full accent-emerald-600"
                                />
                                <span className="min-w-[4rem] rounded border bg-white px-2 py-1 text-center text-sm font-mono">
                                    {conversionRatePlus}%
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Konversi API Pro</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={conversionRateApiPro}
                                    onChange={(event) => setConversionRateApiPro(Number(event.target.value))}
                                    className="w-full accent-emerald-600"
                                />
                                <span className="min-w-[4rem] rounded border bg-white px-2 py-1 text-center text-sm font-mono">
                                    {conversionRateApiPro}%
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Konversi Pro</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="0.5"
                                    value={conversionRatePro}
                                    onChange={(event) => setConversionRatePro(Number(event.target.value))}
                                    className="w-full accent-emerald-600"
                                />
                                <span className="min-w-[4rem] rounded border bg-white px-2 py-1 text-center text-sm font-mono">
                                    {conversionRatePro}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full whitespace-nowrap text-left text-sm">
                            <thead>
                                <tr className="border-b-2 border-slate-200">
                                    <th className="px-2 py-4 font-semibold text-slate-600">Bulan</th>
                                    <th className="px-2 py-4 font-semibold text-slate-600">Total User</th>
                                    <th className="px-2 py-4 text-center font-semibold text-slate-600">Free / Plus / API Pro / Pro</th>
                                    <th className="px-2 py-4 text-right font-semibold text-rose-600">Biaya Infra + Overhead</th>
                                    <th className="px-2 py-4 text-right font-semibold text-rose-600">Biaya AI</th>
                                    <th className="px-2 py-4 text-right font-semibold text-emerald-600">Revenue Bersih</th>
                                    <th className="px-2 py-4 text-right font-bold text-slate-900">Profit Bersih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {simulationData.map((row) => {
                                    const infraCost =
                                        row.vercelCost +
                                        row.supabaseCost +
                                        row.storageOverageCost +
                                        row.databaseOverageCost +
                                        row.egressOverageCost +
                                        row.mauOverageCost +
                                        row.fixedOverhead;

                                    return (
                                        <tr key={row.month} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                                            <td className="px-2 py-3 font-medium">Bulan {row.month}</td>
                                            <td className="px-2 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="h-4 w-4 text-slate-400" />
                                                    {formatCompactNumber(row.totalUsers)}
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 text-center font-mono text-xs text-slate-500">
                                                {row.freeUsers} / {row.plusUsers} / {row.apiProUsers} / {row.proUsers}
                                            </td>
                                            <td className="px-2 py-3 text-right font-mono text-xs text-rose-600">
                                                {formatPrice(infraCost)}
                                            </td>
                                            <td className="px-2 py-3 text-right font-mono text-xs text-rose-600">
                                                {formatPrice(row.aiCost)}
                                            </td>
                                            <td className="px-2 py-3 text-right font-mono text-xs text-emerald-600">
                                                {formatPrice(row.netRevenue)}
                                            </td>
                                            <td
                                                className={`w-40 px-2 py-3 text-right font-bold ${
                                                    row.netProfit < 0 ? 'text-rose-600' : 'text-slate-900'
                                                }`}
                                            >
                                                {formatPrice(row.netProfit)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900">Cara hitung Biaya Infra + Overhead</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Kolom ini sekarang menghitung <strong>Vercel Pro flat fee</strong>, <strong>Supabase Pro saat trigger upgrade tercapai</strong>, overage storage/database/egress/MAU Supabase, dan overhead bulanan dasar.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900">Trigger upgrade Supabase</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Simulasi upgrade ke Pro saat salah satu baseline Free mulai mepet: storage &gt; 85% dari 1 GB, database &gt; 85% dari 500 MB, atau MAU mendekati limit Free.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-semibold text-slate-900">Catatan Vercel overage</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Vercel Pro memberi included usage credit, tetapi overage functions/transfer sangat tergantung CPU, memory, dan traffic nyata. Jadi simulator ini memakai baseline Pro tetap, bukan per-request billing detail.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div>
                                <p className="text-sm text-emerald-700/80">Total pengguna bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {formatCompactNumber(month12.totalUsers)} user
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Paid users bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {formatCompactNumber(totalPaidUsers)} user
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Paid ratio bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">{formatPercent(paidRatio)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Break-even estimasi</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {monthBreakEven ? `Bulan ${monthBreakEven}` : 'Belum tercapai'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Storage bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {month12.accumulatedStorageMb.toFixed(0)} MB
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">DB bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {month12.accumulatedDatabaseMb.toFixed(0)} MB
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Estimasi MAU bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {formatCompactNumber(month12.estimatedMau)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-emerald-700/80">Estimasi egress bulan 12</p>
                                <p className="text-xl font-bold text-emerald-950">
                                    {month12.estimatedEgressGb.toFixed(1)} GB
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Catatan Baca Simulasi</h2>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                        <p>
                            Simulator ini sengaja memakai baseline yang lebih hati-hati: Vercel Pro dari awal, payment
                            fee 2%, dan biaya AI blended. Jadi hasil profit tidak terlalu optimistis.
                        </p>
                        <p>
                            API Pro dimasukkan sebagai revenue plan, tetapi tidak memakai kredit sistem Paapan. Karena
                            itu margin plan ini biasanya lebih tinggi daripada Plus dan Pro, meskipun tetap menambah
                            beban hosting, storage, dan support.
                        </p>
                        <p>
                            Angka storage dihitung kumulatif per bulan, bukan hanya bulan berjalan. Ini lebih cocok
                            dengan sifat file gambar yang menetap di Supabase Storage.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
