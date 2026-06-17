import type { SupabaseClient } from '@supabase/supabase-js';

import type { SubscriptionTier } from '@/types/credit';

export const PAID_COLLAB_TIERS: SubscriptionTier[] = ['plus', 'pro', 'api-pro', 'enterprise'];

export const isPaidCollabTier = (tier: string | null | undefined): tier is SubscriptionTier => (
    PAID_COLLAB_TIERS.includes((tier || 'free') as SubscriptionTier)
);

export async function fetchServerSubscriptionTier(
    supabaseAdmin: SupabaseClient,
    userId: string
): Promise<SubscriptionTier> {
    const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch subscription tier:', error);
        return 'free';
    }

    return (data?.tier as SubscriptionTier | undefined) || 'free';
}
