import { SupabaseClient } from '@supabase/supabase-js';
import { FREE_TIER_CONFIG, SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { SubscriptionTier } from '@/types/credit';

export const CREDIT_SERVER_TIME_ZONE = 'Asia/Makassar';
const CREDIT_SERVER_UTC_OFFSET_HOURS = 8;

type CreditBalanceRow = {
    id?: string;
    user_id: string;
    bonus_credits?: number | null;
    bonus_credits_used?: number | null;
    daily_free_credits?: number | null;
    daily_free_used?: number | null;
    monthly_credits?: number | null;
    monthly_credits_used?: number | null;
    last_daily_reset?: string | null;
    last_monthly_reset?: string | null;
};

function getDateParts(date = new Date(), timeZone = CREDIT_SERVER_TIME_ZONE) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const values = Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );

    const year = values.year || '1970';
    const month = values.month || '01';
    const day = values.day || '01';

    return {
        dailyKey: `${year}-${month}-${day}`,
        monthlyKey: `${year}-${month}`,
        year: Number(year),
        month: Number(month),
        day: Number(day),
    };
}

function getNextDailyResetAt(date = new Date(), timeZone = CREDIT_SERVER_TIME_ZONE) {
    const parts = getDateParts(date, timeZone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, -CREDIT_SERVER_UTC_OFFSET_HOURS, 0, 0)).toISOString();
}

function getNextMonthlyResetAt(date = new Date(), timeZone = CREDIT_SERVER_TIME_ZONE) {
    const parts = getDateParts(date, timeZone);
    return new Date(Date.UTC(parts.year, parts.month, 1, -CREDIT_SERVER_UTC_OFFSET_HOURS, 0, 0)).toISOString();
}

function getPlanForTier(tier: SubscriptionTier) {
    return SUBSCRIPTION_PLANS.find((plan) => plan.id === tier) || SUBSCRIPTION_PLANS[0];
}

function getExpectedDailyCredits(tier: SubscriptionTier) {
    return tier === 'free' ? FREE_TIER_CONFIG.dailyCredits : 0;
}

function getExpectedMonthlyCredits(tier: SubscriptionTier) {
    const plan = getPlanForTier(tier);
    return plan.creditsPerMonth || 0;
}

function getWelcomeBonusForTier(tier: SubscriptionTier) {
    return tier === 'free' ? FREE_TIER_CONFIG.welcomeBonus : 0;
}

export async function getOrCreateSubscriptionTier(
    supabaseAdmin: SupabaseClient,
    userId: string
): Promise<SubscriptionTier> {
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('id, tier')
        .eq('user_id', userId)
        .maybeSingle();

    if (existingSub?.tier) {
        return existingSub.tier as SubscriptionTier;
    }

    await supabaseAdmin.from('subscriptions').insert({
        user_id: userId,
        tier: 'free',
        status: 'active',
    });

    return 'free';
}

export async function getNormalizedCreditBalance(
    supabaseAdmin: SupabaseClient,
    userId: string,
    tier: SubscriptionTier
) {
    const { dailyKey, monthlyKey } = getDateParts();
    const expectedDailyCredits = getExpectedDailyCredits(tier);
    const expectedMonthlyCredits = getExpectedMonthlyCredits(tier);

    const { data: existingBalance } = await supabaseAdmin
        .from('credit_balances')
        .select('id, user_id, bonus_credits, bonus_credits_used, daily_free_credits, daily_free_used, monthly_credits, monthly_credits_used, last_daily_reset, last_monthly_reset')
        .eq('user_id', userId)
        .maybeSingle();

    if (!existingBalance) {
        const freshBalance: CreditBalanceRow = {
            user_id: userId,
            bonus_credits: getWelcomeBonusForTier(tier),
            bonus_credits_used: 0,
            daily_free_credits: expectedDailyCredits,
            daily_free_used: 0,
            monthly_credits: expectedMonthlyCredits,
            monthly_credits_used: 0,
            last_daily_reset: expectedDailyCredits > 0 ? dailyKey : null,
            last_monthly_reset: expectedMonthlyCredits > 0 ? monthlyKey : null,
        };

        const { data: insertedBalance } = await supabaseAdmin
            .from('credit_balances')
            .insert(freshBalance)
            .select('id, user_id, bonus_credits, bonus_credits_used, daily_free_credits, daily_free_used, monthly_credits, monthly_credits_used, last_daily_reset, last_monthly_reset')
            .single();

        return insertedBalance || freshBalance;
    }

    const updates: Partial<CreditBalanceRow> = {};

    if (tier === 'free') {
        if (existingBalance.last_daily_reset !== dailyKey) {
            updates.daily_free_credits = expectedDailyCredits;
            updates.daily_free_used = 0;
            updates.last_daily_reset = dailyKey;
        }

        if ((existingBalance.monthly_credits || 0) !== 0 || (existingBalance.monthly_credits_used || 0) !== 0) {
            updates.monthly_credits = 0;
            updates.monthly_credits_used = 0;
            updates.last_monthly_reset = null;
        }
    } else {
        if ((existingBalance.daily_free_credits || 0) !== 0 || (existingBalance.daily_free_used || 0) !== 0) {
            updates.daily_free_credits = 0;
            updates.daily_free_used = 0;
            updates.last_daily_reset = null;
        }

        if (expectedMonthlyCredits > 0 && existingBalance.last_monthly_reset !== monthlyKey) {
            updates.monthly_credits = expectedMonthlyCredits;
            updates.monthly_credits_used = 0;
            updates.last_monthly_reset = monthlyKey;
        }

        if (expectedMonthlyCredits === 0 && ((existingBalance.monthly_credits || 0) !== 0 || (existingBalance.monthly_credits_used || 0) !== 0)) {
            updates.monthly_credits = 0;
            updates.monthly_credits_used = 0;
            updates.last_monthly_reset = null;
        }
    }

    if (Object.keys(updates).length === 0) {
        return existingBalance;
    }

    const { data: updatedBalance } = await supabaseAdmin
        .from('credit_balances')
        .update(updates)
        .eq('user_id', userId)
        .select('id, user_id, bonus_credits, bonus_credits_used, daily_free_credits, daily_free_used, monthly_credits, monthly_credits_used, last_daily_reset, last_monthly_reset')
        .single();

    return {
        ...existingBalance,
        ...updates,
        ...(updatedBalance || {}),
    };
}

export function buildCreditSnapshot(balance: CreditBalanceRow, tier: SubscriptionTier) {
    const purchasedCredits = balance.bonus_credits || 0;
    const purchasedUsed = balance.bonus_credits_used || 0;
    const dailyCredits = balance.daily_free_credits || 0;
    const dailyUsed = balance.daily_free_used || 0;
    const monthlyCredits = balance.monthly_credits || 0;
    const monthlyUsed = balance.monthly_credits_used || 0;

    return {
        tier,
        timeZone: CREDIT_SERVER_TIME_ZONE,
        balance: {
            bonus_credits: purchasedCredits,
            bonus_credits_used: purchasedUsed,
            daily_free_credits: dailyCredits,
            daily_free_used: dailyUsed,
            monthly_credits: monthlyCredits,
            monthly_credits_used: monthlyUsed,
            daily_free_remaining: Math.max(0, dailyCredits - dailyUsed),
            monthly_remaining: Math.max(0, monthlyCredits - monthlyUsed),
            bonus_remaining: Math.max(0, purchasedCredits - purchasedUsed),
            total_remaining:
                Math.max(0, dailyCredits - dailyUsed) +
                Math.max(0, monthlyCredits - monthlyUsed) +
                Math.max(0, purchasedCredits - purchasedUsed),
            last_daily_reset: balance.last_daily_reset || null,
            last_monthly_reset: balance.last_monthly_reset || null,
        },
        reset: {
            nextDailyResetAt: getNextDailyResetAt(),
            nextMonthlyResetAt: getNextMonthlyResetAt(),
        },
    };
}
