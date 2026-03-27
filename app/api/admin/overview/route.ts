import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import { SubscriptionTier } from '@/types/credit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type RecentUser = {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string | null;
};

type AuthUserSummary = {
    id: string;
    email: string | null;
    created_at: string | null;
};

type DailyMetricPoint = {
    date: string;
    label: string;
    value: number;
};

async function countRows(table: string) {
    const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count || 0;
}

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

        const [
            authUsers,
            totalWorkspaces,
            totalCreditAccounts,
            plusUsers,
            proUsers,
            apiProUsers,
            profilesResult,
            workspacesResult,
        ] = await Promise.all([
            listAllAuthUsers(),
            countRows('workspaces'),
            countRows('credit_balances'),
            countByTier('plus'),
            countByTier('pro'),
            countByTier('api-pro'),
            supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, created_at')
                .limit(200),
            supabaseAdmin
                .from('workspaces')
                .select('user_id, updated_at'),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (workspacesResult.error) throw workspacesResult.error;

        const totalUsers = authUsers.length;
        const freeUsers = Math.max(totalUsers - plusUsers - proUsers - apiProUsers, 0);
        const signupSeries = buildDailySeries(14);
        const workspaceSeries = buildDailySeries(14);
        const activeUsersByDay = new Map<string, Set<string>>();
        const activeUsers30d = new Set<string>();
        const profilesById = new Map<string, RecentUser>();
        ((profilesResult.data || []) as RecentUser[]).forEach((profile) => {
            profilesById.set(profile.id, profile);
        });

        const signupSeriesMap = new Map(signupSeries.map((point) => [point.date, point]));
        authUsers.forEach((authUser) => {
            const key = formatDateKey(authUser.created_at);
            if (!key) return;
            const point = signupSeriesMap.get(key);
            if (point) point.value += 1;
        });

        const workspaceSeriesMap = new Map(workspaceSeries.map((point) => [point.date, point]));
        const todayKey = formatDateKey(new Date().toISOString());
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

        (workspacesResult.data || []).forEach((item) => {
            const key = formatDateKey(item.updated_at);
            if (!key) return;
            const point = workspaceSeriesMap.get(key);
            if (point) {
                point.value += 1;
            }

            if (!activeUsersByDay.has(key)) {
                activeUsersByDay.set(key, new Set());
            }
            activeUsersByDay.get(key)?.add(item.user_id);

            if (item.updated_at && new Date(item.updated_at) >= thirtyDaysAgo) {
                activeUsers30d.add(item.user_id);
            }
        });

        const recentUsers = authUsers
            .map((authUser) => {
                const profile = profilesById.get(authUser.id);
                return {
                    id: authUser.id,
                    full_name: profile?.full_name || null,
                    email: profile?.email || authUser.email,
                    created_at: profile?.created_at || authUser.created_at,
                };
            })
            .sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 8);

        const uniqueWorkspaceOwners = new Set((workspacesResult.data || []).map((item) => item.user_id)).size;

        return NextResponse.json({
            admin: {
                email: user.email,
            },
            stats: {
                totalUsers,
                totalWorkspaces,
                workspaceOwners: uniqueWorkspaceOwners,
                totalCreditAccounts,
                dau: todayKey ? activeUsersByDay.get(todayKey)?.size || 0 : 0,
                mau: activeUsers30d.size,
                paidUsers: plusUsers + proUsers + apiProUsers,
                plans: {
                    free: freeUsers,
                    plus: plusUsers,
                    pro: proUsers,
                    apiPro: apiProUsers,
                },
            },
            charts: {
                signups14d: signupSeries,
                workspaceActivity14d: workspaceSeries,
                activeUsers14d: workspaceSeries.map((point) => ({
                    date: point.date,
                    label: point.label,
                    value: activeUsersByDay.get(point.date)?.size || 0,
                })),
                visitorsTracked: false,
            },
            recentUsers,
        });
    } catch (error) {
        console.error('Admin overview route error:', error);
        return NextResponse.json({ error: 'Failed to load admin overview' }, { status: 500 });
    }
}
