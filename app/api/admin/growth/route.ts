import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import { SubscriptionTier } from '@/types/credit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type AuthUserSummary = {
    id: string;
    email: string | null;
    created_at: string | null;
};

type WorkspaceSummary = {
    user_id: string;
    created_at: string | null;
    updated_at: string | null;
};

type DailyMetricPoint = {
    date: string;
    label: string;
    value: number;
};

type RetentionSummary = {
    eligible: number;
    retained: number;
    rate: number;
};

type RetentionCohort = {
    cohort: string;
    total: number;
    d1Rate: number;
    d7Rate: number;
    d30Rate: number;
};

async function countByTier(tier: SubscriptionTier) {
    const { count, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('tier', tier);

    if (error) throw error;
    return count || 0;
}

async function listAllAuthUsers() {
    const users: AuthUserSummary[] = [];
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) throw error;

        const pageUsers = (data?.users || []).map((user) => ({
            id: user.id,
            email: user.email || null,
            created_at: user.created_at || null,
        }));

        users.push(...pageUsers);

        if (pageUsers.length < perPage) break;
        page += 1;
    }

    return users;
}

function formatDateKey(value: string | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value));
}

function formatDateLabel(value: string) {
    const date = new Date(`${value}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Makassar',
    }).format(date);
}

function addDaysToDateKey(value: string, days: number) {
    const date = new Date(`${value}T00:00:00+08:00`);
    date.setDate(date.getDate() + days);
    return formatDateKey(date.toISOString()) || value;
}

function getWeekStartKey(value: string) {
    const date = new Date(`${value}T00:00:00+08:00`);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return formatDateKey(date.toISOString()) || value;
}

function formatWeekLabel(value: string) {
    const start = value;
    const end = addDaysToDateKey(value, 6);
    return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}

function buildDailySeries(days: number) {
    const points: DailyMetricPoint[] = [];
    const now = new Date();

    for (let index = days - 1; index >= 0; index -= 1) {
        const day = new Date(now);
        day.setDate(now.getDate() - index);
        const key = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(day);

        points.push({
            date: key,
            label: formatDateLabel(key),
            value: 0,
        });
    }

    return points;
}

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (!isAdminEmail(user.email)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [authUsers, workspacesResult, plusUsers, proUsers, apiProUsers] = await Promise.all([
            listAllAuthUsers(),
            supabaseAdmin
                .from('workspaces')
                .select('user_id, created_at, updated_at'),
            countByTier('plus'),
            countByTier('pro'),
            countByTier('api-pro'),
        ]);

        if (workspacesResult.error) throw workspacesResult.error;

        const workspaces = (workspacesResult.data || []) as WorkspaceSummary[];
        const totalUsers = authUsers.length;
        const paidUsers = plusUsers + proUsers + apiProUsers;
        const activatedUsers = new Set(workspaces.map((item) => item.user_id)).size;

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 29);

        const signups30d = buildDailySeries(30);
        const activations30d = buildDailySeries(30);
        const activeUsers30dBase = buildDailySeries(30);

        const signupsMap = new Map(signups30d.map((point) => [point.date, point]));
        const activationsMap = new Map(activations30d.map((point) => [point.date, point]));
        const activeUsersByDay = new Map<string, Set<string>>();
        const activeDateKeysByUser = new Map<string, Set<string>>();
        const firstWorkspaceByUser = new Map<string, string>();
        const activeUsers7d = new Set<string>();
        const activeUsers30dSet = new Set<string>();

        authUsers.forEach((authUser) => {
            const key = formatDateKey(authUser.created_at);
            if (!key) return;
            const point = signupsMap.get(key);
            if (point) point.value += 1;
        });

        workspaces.forEach((workspace) => {
            const createdKey = formatDateKey(workspace.created_at);
            const updatedKey = formatDateKey(workspace.updated_at);

            if (createdKey) {
                const existing = firstWorkspaceByUser.get(workspace.user_id);
                if (!existing || createdKey < existing) {
                    firstWorkspaceByUser.set(workspace.user_id, createdKey);
                }
            }

            if (updatedKey) {
                if (!activeUsersByDay.has(updatedKey)) {
                    activeUsersByDay.set(updatedKey, new Set());
                }
                activeUsersByDay.get(updatedKey)?.add(workspace.user_id);

                if (!activeDateKeysByUser.has(workspace.user_id)) {
                    activeDateKeysByUser.set(workspace.user_id, new Set());
                }
                activeDateKeysByUser.get(workspace.user_id)?.add(updatedKey);
            }

            if (workspace.updated_at) {
                const updatedAt = new Date(workspace.updated_at);
                if (updatedAt >= sevenDaysAgo) {
                    activeUsers7d.add(workspace.user_id);
                }
                if (updatedAt >= thirtyDaysAgo) {
                    activeUsers30dSet.add(workspace.user_id);
                }
            }
        });

        firstWorkspaceByUser.forEach((dateKey) => {
            const point = activationsMap.get(dateKey);
            if (point) point.value += 1;
        });

        const activeUsers30d = activeUsers30dBase.map((point) => ({
            ...point,
            value: activeUsersByDay.get(point.date)?.size || 0,
        }));

        const newUsers7d = authUsers.filter((authUser) => {
            if (!authUser.created_at) return false;
            return new Date(authUser.created_at) >= sevenDaysAgo;
        }).length;

        const dauKey = formatDateKey(now.toISOString());
        const dau = dauKey ? activeUsersByDay.get(dauKey)?.size || 0 : 0;
        const mau = activeUsers30dSet.size;
        const wau = activeUsers7d.size;

        const retentionSummary = (
            dayOffset: number
        ): RetentionSummary => {
            let eligible = 0;
            let retained = 0;

            authUsers.forEach((authUser) => {
                const signupKey = formatDateKey(authUser.created_at);
                if (!signupKey || !authUser.created_at) return;

                const signupDate = new Date(authUser.created_at);
                const eligibleThreshold = new Date(now);
                eligibleThreshold.setDate(now.getDate() - dayOffset);
                if (signupDate > eligibleThreshold) return;

                eligible += 1;
                const targetKey = addDaysToDateKey(signupKey, dayOffset);
                const activeSet = activeDateKeysByUser.get(authUser.id);
                if (activeSet?.has(targetKey)) {
                    retained += 1;
                }
            });

            return {
                eligible,
                retained,
                rate: eligible > 0 ? retained / eligible : 0,
            };
        };

        const cohortMap = new Map<string, { total: number; d1: number; d7: number; d30: number }>();
        authUsers.forEach((authUser) => {
            const signupKey = formatDateKey(authUser.created_at);
            if (!signupKey || !authUser.created_at) return;

            const weekKey = getWeekStartKey(signupKey);
            const existing = cohortMap.get(weekKey) || { total: 0, d1: 0, d7: 0, d30: 0 };
            existing.total += 1;

            const activeSet = activeDateKeysByUser.get(authUser.id);
            const signupDate = new Date(authUser.created_at);

            const eligibleD1 = new Date(now);
            eligibleD1.setDate(now.getDate() - 1);
            if (signupDate <= eligibleD1 && activeSet?.has(addDaysToDateKey(signupKey, 1))) {
                existing.d1 += 1;
            }

            const eligibleD7 = new Date(now);
            eligibleD7.setDate(now.getDate() - 7);
            if (signupDate <= eligibleD7 && activeSet?.has(addDaysToDateKey(signupKey, 7))) {
                existing.d7 += 1;
            }

            const eligibleD30 = new Date(now);
            eligibleD30.setDate(now.getDate() - 30);
            if (signupDate <= eligibleD30 && activeSet?.has(addDaysToDateKey(signupKey, 30))) {
                existing.d30 += 1;
            }

            cohortMap.set(weekKey, existing);
        });

        const cohorts: RetentionCohort[] = Array.from(cohortMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 6)
            .map(([cohortKey, values]) => ({
                cohort: formatWeekLabel(cohortKey),
                total: values.total,
                d1Rate: values.total > 0 ? values.d1 / values.total : 0,
                d7Rate: values.total > 0 ? values.d7 / values.total : 0,
                d30Rate: values.total > 0 ? values.d30 / values.total : 0,
            }));

        return NextResponse.json({
            stats: {
                totalUsers,
                newUsers7d,
                activatedUsers,
                activationRate: totalUsers > 0 ? activatedUsers / totalUsers : 0,
                paidUsers,
                paidConversionRate: totalUsers > 0 ? paidUsers / totalUsers : 0,
                dau,
                wau,
                mau,
                stickiness: mau > 0 ? dau / mau : 0,
            },
            charts: {
                signups30d,
                activations30d,
                activeUsers30d,
            },
            retention: {
                d1: retentionSummary(1),
                d7: retentionSummary(7),
                d30: retentionSummary(30),
                cohorts,
            },
        });
    } catch (error) {
        console.error('Admin growth route error:', error);
        return NextResponse.json({ error: 'Failed to load admin growth' }, { status: 500 });
    }
}
