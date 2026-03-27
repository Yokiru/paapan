import { supabase } from './supabase';
import { CreditBalance, CreditTransaction, SubscriptionTier } from '@/types/credit';

const ALLOWED_CLIENT_CREDIT_BALANCE_FIELDS = new Set([
    'last_daily_reset',
    'last_monthly_reset',
]);

// Fallback error handler (in case tables are not yet created in Supabase)
const handleSupabaseError = (error: any, fallbackResult: any, context: string) => {
    console.warn(`Supabase Error (${context}):`, error.message || error);
    // If the error is about a missing relation (table doesn't exist), we gracefully fallback
    return fallbackResult;
};

export async function fetchUserSubscription(userId: string): Promise<SubscriptionTier> {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('tier')
            .eq('user_id', userId)
            .single();

        if (error) return handleSupabaseError(error, 'free', 'fetchUserSubscription');
        return (data?.tier as SubscriptionTier) || 'free';
    } catch (e) {
        return handleSupabaseError(e, 'free', 'fetchUserSubscription');
    }
}

export async function fetchUserCreditBalance(userId: string): Promise<any | null> {
    try {
        void userId;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return null;
        }

        const response = await fetch('/api/credits', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (!response.ok) {
            const fallbackError = await response.json().catch(() => null);
            return handleSupabaseError(fallbackError || new Error('Failed to fetch server credits'), null, 'fetchUserCreditBalance');
        }

        const payload = await response.json();
        return payload?.balance || null;
    } catch (e) {
        return handleSupabaseError(e, null, 'fetchUserCreditBalance');
    }
}

export async function updateUserCreditBalance(userId: string, updates: Record<string, unknown>) {
    try {
        const filteredEntries = Object.entries(updates).filter(([key]) =>
            ALLOWED_CLIENT_CREDIT_BALANCE_FIELDS.has(key)
        );

        if (filteredEntries.length === 0) {
            console.warn('Blocked unsafe credit balance update from client:', Object.keys(updates));
            return;
        }

        const { error } = await supabase
            .from('credit_balances')
            .update(Object.fromEntries(filteredEntries))
            .eq('user_id', userId);

        if (error) handleSupabaseError(error, null, 'updateUserCreditBalance');
    } catch (e) {
        handleSupabaseError(e, null, 'updateUserCreditBalance');
    }
}

export async function logCreditTransaction(userId: string, transaction: Omit<CreditTransaction, 'id'>) {
    try {
        const { error } = await supabase
            .from('credit_transactions')
            .insert({
                user_id: userId,
                type: transaction.type,
                amount: transaction.amount,
                description: transaction.description,
                action_type: transaction.metadata?.actionType,
                node_id: transaction.metadata?.nodeId,
                created_at: transaction.createdAt.toISOString()
            });

        if (error) handleSupabaseError(error, null, 'logCreditTransaction');
    } catch (e) {
        handleSupabaseError(e, null, 'logCreditTransaction');
    }
}

export async function deductCreditsAtomic(
    userId: string,
    cost: number,
    creditType: 'daily_free' | 'monthly' | 'bonus'
): Promise<boolean> {
    if (typeof window !== 'undefined') {
        console.warn(
            `[SECURITY] Blocked client-side deduct_credits RPC attempt for user ${userId}. ` +
            'Credit deductions must only be executed by trusted server-side flows.'
        );
        return false;
    }

    try {
        const { data, error } = await supabase.rpc('deduct_credits', {
            p_user_id: userId,
            p_cost: cost,
            p_credit_type: creditType
        });

        if (error) {
            console.warn('Supabase RPC Error (deduct_credits):', error.message);
            // SECURITY: Return false to block usage when deduction fails
            return false;
        }

        return data as boolean;
    } catch (e) {
        console.warn('Supabase RPC Exception (deduct_credits):', e);
        return false; // SECURITY: Block usage when deduction fails
    }
}

export async function addBonusCreditsAtomic(
    userId: string,
    amount: number
): Promise<void> {
    if (typeof window !== 'undefined') {
        console.warn(
            `[SECURITY] Blocked client-side bonus credit grant attempt for user ${userId}. ` +
            'Bonus credits must only be granted by a server-verified flow.'
        );
        return;
    }

    try {
        const { error } = await supabase.rpc('add_bonus_credits', {
            p_user_id: userId,
            p_amount: amount
        });

        if (error) {
            console.warn('Supabase RPC Error (add_bonus_credits):', error.message);
        }
    } catch (e) {
        console.warn('Supabase RPC Exception (add_bonus_credits):', e);
    }
}
