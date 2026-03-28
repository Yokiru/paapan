import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import {
    getDateParts,
    getExpectedDailyCredits,
    getExpectedMonthlyCredits,
    getNormalizedCreditBalance,
    getOrCreateSubscriptionTier,
    getWelcomeBonusForTier,
} from '@/lib/serverCredits';
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
    banned_until: string | null;
    ban_reason: string | null;
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
    last_daily_reset?: string | null;
    last_monthly_reset?: string | null;
};

type AdminActionBody =
    | {
        userId: string;
        action: 'update_tier';
        tier: SubscriptionTier;
    }
    | {
        userId: string;
        action: 'adjust_bonus';
        bonusDelta: number;
    }
    | {
        userId: string;
        action: 'adjust_bucket';
        bucket: 'daily' | 'monthly' | 'bonus';
        delta: number;
    }
    | {
        userId: string;
        action: 'reset_bonus';
    }
    | {
        userId: string;
        action: 'reset_credits';
    }
    | {
        userId: string;
        action: 'ban_user';
        reason?: string;
    }
    | {
        userId: string;
        action: 'unban_user';
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
            banned_until: user.banned_until || null,
            ban_reason:
                typeof user.app_metadata?.admin_ban_reason === 'string'
                    ? user.app_metadata.admin_ban_reason
                    : null,
        }));

        users.push(...pageUsers);

        if (pageUsers.length < perPage) break;
        page += 1;
    }

    return users;
}

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const {
        data: { user },
        error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        return { errorResponse: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    if (!isAdminEmail(user.email)) {
        return { errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    return { user };
}

async function buildAdminUsersSnapshot() {
    const [authUsers, profilesResult, subscriptionsResult, workspacesResult] = await Promise.all([
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
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (workspacesResult.error) throw workspacesResult.error;

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

    const profilesById = new Map<string, ProfileRow>();
    ((profilesResult.data || []) as ProfileRow[]).forEach((profile) => {
        profilesById.set(profile.id, profile);
    });

    const recentUsers = authUsers
        .map((authUser) => {
            const profile = profilesById.get(authUser.id);
            const workspace = workspaceStats.get(authUser.id);
            const tier = subscriptions.get(authUser.id) || 'free';

            return {
                id: authUser.id,
                full_name: profile?.full_name || null,
                email: profile?.email || authUser.email,
                created_at: profile?.created_at || authUser.created_at,
                banned_until: authUser.banned_until,
                ban_reason: authUser.ban_reason,
                tier,
                workspace_count: workspace?.count || 0,
                last_workspace_activity: workspace?.lastActivity || null,
            };
        })
        .sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        })
        .slice(0, 50);

    const normalizedBalances = await Promise.all(
        recentUsers.map(async (user) => {
            const normalized = await getNormalizedCreditBalance(supabaseAdmin, user.id, user.tier);
            return [user.id, normalized] as const;
        })
    );

    const creditStats = new Map<
        string,
        {
            remaining: number;
            coreRemaining: number;
            bonusRemaining: number;
            updatedAt: string | null;
        }
    >();

    normalizedBalances.forEach(([userId, item]) => {
        const dailyRemaining = Math.max((item.daily_free_credits || 0) - (item.daily_free_used || 0), 0);
        const monthlyRemaining = Math.max((item.monthly_credits || 0) - (item.monthly_credits_used || 0), 0);
        const bonusRemaining = Math.max((item.bonus_credits || 0) - (item.bonus_credits_used || 0), 0);

        creditStats.set(userId, {
            remaining: dailyRemaining + monthlyRemaining + bonusRemaining,
            coreRemaining: dailyRemaining + monthlyRemaining,
            bonusRemaining,
            updatedAt: null,
        });
    });

    return recentUsers.map((user) => {
        const credits = creditStats.get(user.id);

        return {
            ...user,
            is_banned: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
            banned_until: user.banned_until,
            ban_reason: user.ban_reason,
            remaining_credits: credits?.remaining || 0,
            core_remaining_credits: credits?.coreRemaining || 0,
            bonus_remaining_credits: credits?.bonusRemaining || 0,
            credits_updated_at: credits?.updatedAt || null,
        };
    });
}

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if ('errorResponse' in auth) {
            return auth.errorResponse;
        }

        const users = await buildAdminUsersSnapshot();

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Admin users route error:', error);
        return NextResponse.json({ error: 'Failed to load admin users' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if ('errorResponse' in auth) {
            return auth.errorResponse;
        }

        const body = (await request.json()) as Partial<AdminActionBody>;
        const userId = typeof body.userId === 'string' ? body.userId : '';
        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const { data: targetAuthUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (targetUserError || !targetAuthUser.user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (body.action === 'update_tier') {
            const nextTier = body.tier;
            const allowedTiers: SubscriptionTier[] = ['free', 'plus', 'pro', 'api-pro'];
            if (!nextTier || !allowedTiers.includes(nextTier)) {
                return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
            }

            const { data: existingSub } = await supabaseAdmin
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (existingSub?.id) {
                const { error } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        tier: nextTier,
                        status: 'active',
                    })
                    .eq('user_id', userId);

                if (error) throw error;
            } else {
                const { error } = await supabaseAdmin
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        tier: nextTier,
                        status: 'active',
                    });

                if (error) throw error;
            }

            await getNormalizedCreditBalance(supabaseAdmin, userId, nextTier);
        } else if (body.action === 'adjust_bonus') {
            const bonusDelta = Number(body.bonusDelta);
            if (!Number.isFinite(bonusDelta) || bonusDelta === 0) {
                return NextResponse.json({ error: 'Invalid bonusDelta' }, { status: 400 });
            }

            const currentTier = await getOrCreateSubscriptionTier(supabaseAdmin, userId);
            const balance = await getNormalizedCreditBalance(supabaseAdmin, userId, currentTier);

            const currentBonus = balance.bonus_credits || 0;
            const currentBonusUsed = balance.bonus_credits_used || 0;
            const nextBonus = Math.max(0, currentBonus + bonusDelta);
            const nextBonusUsed = Math.min(currentBonusUsed, nextBonus);

            const { error } = await supabaseAdmin
                .from('credit_balances')
                .update({
                    bonus_credits: nextBonus,
                    bonus_credits_used: nextBonusUsed,
                })
                .eq('user_id', userId);

            if (error) throw error;
        } else if (body.action === 'adjust_bucket') {
            const bucket = body.bucket;
            const delta = Number(body.delta);

            if (!bucket || !['daily', 'monthly', 'bonus'].includes(bucket)) {
                return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
            }

            if (!Number.isFinite(delta) || delta === 0) {
                return NextResponse.json({ error: 'Invalid delta' }, { status: 400 });
            }

            const currentTier = await getOrCreateSubscriptionTier(supabaseAdmin, userId);
            const balance = await getNormalizedCreditBalance(supabaseAdmin, userId, currentTier);

            if (bucket === 'daily') {
                const nextCredits = Math.max(0, (balance.daily_free_credits || 0) + delta);
                const nextUsed = Math.min(balance.daily_free_used || 0, nextCredits);

                const { error } = await supabaseAdmin
                    .from('credit_balances')
                    .update({
                        daily_free_credits: nextCredits,
                        daily_free_used: nextUsed,
                    })
                    .eq('user_id', userId);

                if (error) throw error;
            } else if (bucket === 'monthly') {
                const nextCredits = Math.max(0, (balance.monthly_credits || 0) + delta);
                const nextUsed = Math.min(balance.monthly_credits_used || 0, nextCredits);

                const { error } = await supabaseAdmin
                    .from('credit_balances')
                    .update({
                        monthly_credits: nextCredits,
                        monthly_credits_used: nextUsed,
                    })
                    .eq('user_id', userId);

                if (error) throw error;
            } else {
                const nextCredits = Math.max(0, (balance.bonus_credits || 0) + delta);
                const nextUsed = Math.min(balance.bonus_credits_used || 0, nextCredits);

                const { error } = await supabaseAdmin
                    .from('credit_balances')
                    .update({
                        bonus_credits: nextCredits,
                        bonus_credits_used: nextUsed,
                    })
                    .eq('user_id', userId);

                if (error) throw error;
            }
        } else if (body.action === 'reset_bonus') {
            const currentTier = await getOrCreateSubscriptionTier(supabaseAdmin, userId);
            await getNormalizedCreditBalance(supabaseAdmin, userId, currentTier);
            const defaultBonus = getWelcomeBonusForTier(currentTier);

            const { error } = await supabaseAdmin
                .from('credit_balances')
                .update({
                    bonus_credits: defaultBonus,
                    bonus_credits_used: 0,
                })
                .eq('user_id', userId);

            if (error) throw error;
        } else if (body.action === 'reset_credits') {
            const currentTier = await getOrCreateSubscriptionTier(supabaseAdmin, userId);
            await getNormalizedCreditBalance(supabaseAdmin, userId, currentTier);
            const { dailyKey, monthlyKey } = getDateParts();
            const expectedDailyCredits = getExpectedDailyCredits(currentTier);
            const expectedMonthlyCredits = getExpectedMonthlyCredits(currentTier);

            const { error } = await supabaseAdmin
                .from('credit_balances')
                .update({
                    daily_free_credits: expectedDailyCredits,
                    daily_free_used: 0,
                    monthly_credits: expectedMonthlyCredits,
                    monthly_credits_used: 0,
                    last_daily_reset: expectedDailyCredits > 0 ? dailyKey : null,
                    last_monthly_reset: expectedMonthlyCredits > 0 ? dailyKey : null,
                })
                .eq('user_id', userId);

            if (error) throw error;
        } else if (body.action === 'ban_user') {
            if (isAdminEmail(targetAuthUser.user.email)) {
                return NextResponse.json({ error: 'Protected admin account' }, { status: 400 });
            }

            const reason =
                typeof body.reason === 'string' && body.reason.trim()
                    ? body.reason.trim().slice(0, 300)
                    : null;
            const nextAppMetadata = {
                ...(targetAuthUser.user.app_metadata || {}),
                admin_ban_reason: reason,
                admin_banned_at: new Date().toISOString(),
            };

            const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: '876000h',
                app_metadata: nextAppMetadata,
            });

            if (error) throw error;
        } else if (body.action === 'unban_user') {
            const nextAppMetadata = {
                ...(targetAuthUser.user.app_metadata || {}),
            } as Record<string, unknown>;

            delete nextAppMetadata.admin_ban_reason;
            delete nextAppMetadata.admin_banned_at;

            const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                ban_duration: 'none',
                app_metadata: nextAppMetadata,
            });

            if (error) throw error;
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const users = await buildAdminUsersSnapshot();
        const user = users.find((item) => item.id === userId) || null;

        return NextResponse.json({ ok: true, user, users });
    } catch (error) {
        console.error('Admin users PATCH route error:', error);
        return NextResponse.json({ error: 'Failed to update admin user' }, { status: 500 });
    }
}
