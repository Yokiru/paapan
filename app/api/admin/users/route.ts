import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import { SubscriptionTier } from '@/types/credit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type ProfileRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    created_at: string | null;
};

type AuthUserRow = {
    id: string;
    email: string | null;
    created_at: string | null;
};

type SubscriptionRow = {
    user_id: string;
    tier: SubscriptionTier;
};

type WorkspaceRow = {
    user_id: string;
    updated_at: string | null;
};

type CreditBalanceRow = {
    user_id: string;
    daily_free_credits: number | null;
    daily_free_used: number | null;
    monthly_credits: number | null;
    monthly_credits_used: number | null;
    bonus_credits: number | null;
    bonus_credits_used: number | null;
    updated_at: string | null;
};

async function listAllAuthUsers() {
    const users: AuthUserRow[] = [];
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

        const [authUsers, profilesResult, subscriptionsResult, workspacesResult, creditsResult] = await Promise.all([
            listAllAuthUsers(),
            supabaseAdmin
                .from('profiles')
                .select('id, full_name, email, created_at')
                .limit(200),
            supabaseAdmin
                .from('subscriptions')
                .select('user_id, tier'),
            supabaseAdmin
                .from('workspaces')
                .select('user_id, updated_at'),
            supabaseAdmin
                .from('credit_balances')
                .select('user_id, daily_free_credits, daily_free_used, monthly_credits, monthly_credits_used, bonus_credits, bonus_credits_used, updated_at'),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (subscriptionsResult.error) throw subscriptionsResult.error;
        if (workspacesResult.error) throw workspacesResult.error;
        if (creditsResult.error) throw creditsResult.error;

        const subscriptions = new Map<string, SubscriptionTier>();
        ((subscriptionsResult.data || []) as SubscriptionRow[]).forEach((item) => {
            subscriptions.set(item.user_id, item.tier);
        });

        const workspaceStats = new Map<string, { count: number; lastActivity: string | null }>();
        ((workspacesResult.data || []) as WorkspaceRow[]).forEach((item) => {
            const existing = workspaceStats.get(item.user_id) || { count: 0, lastActivity: null };
            existing.count += 1;

            if (!existing.lastActivity || (item.updated_at && new Date(item.updated_at) > new Date(existing.lastActivity))) {
                existing.lastActivity = item.updated_at;
            }

            workspaceStats.set(item.user_id, existing);
        });

        const creditStats = new Map<string, { remaining: number; updatedAt: string | null }>();
        ((creditsResult.data || []) as CreditBalanceRow[]).forEach((item) => {
            const dailyRemaining = Math.max((item.daily_free_credits || 0) - (item.daily_free_used || 0), 0);
            const monthlyRemaining = Math.max((item.monthly_credits || 0) - (item.monthly_credits_used || 0), 0);
            const bonusRemaining = Math.max((item.bonus_credits || 0) - (item.bonus_credits_used || 0), 0);

            creditStats.set(item.user_id, {
                remaining: dailyRemaining + monthlyRemaining + bonusRemaining,
                updatedAt: item.updated_at,
            });
        });

        const profilesById = new Map<string, ProfileRow>();
        ((profilesResult.data || []) as ProfileRow[]).forEach((profile) => {
            profilesById.set(profile.id, profile);
        });

        const users = authUsers
            .map((authUser) => {
                const profile = profilesById.get(authUser.id);
                const workspace = workspaceStats.get(authUser.id);
                const credits = creditStats.get(authUser.id);

                return {
                    id: authUser.id,
                    full_name: profile?.full_name || null,
                    email: profile?.email || authUser.email,
                    created_at: profile?.created_at || authUser.created_at,
                    tier: subscriptions.get(authUser.id) || 'free',
                    workspace_count: workspace?.count || 0,
                    last_workspace_activity: workspace?.lastActivity || null,
                    remaining_credits: credits?.remaining || 0,
                    credits_updated_at: credits?.updatedAt || null,
                };
            })
            .sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, 50);

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Admin users route error:', error);
        return NextResponse.json({ error: 'Failed to load admin users' }, { status: 500 });
    }
}
