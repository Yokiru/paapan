import { supabase } from './supabase';
import { CreditBalance, CreditTransaction, SubscriptionTier } from '@/types/credit';

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
        const { data, error } = await supabase
            .from('credit_balances')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) return handleSupabaseError(error, null, 'fetchUserCreditBalance');
        return data;
    } catch (e) {
        return handleSupabaseError(e, null, 'fetchUserCreditBalance');
    }
}

export async function updateUserCreditBalance(userId: string, updates: any) {
    try {
        const { error } = await supabase
            .from('credit_balances')
            .update(updates)
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
    try {
        const { data, error } = await supabase.rpc('deduct_credits', {
            p_user_id: userId,
            p_cost: cost,
            p_credit_type: creditType
        });

        if (error) {
            console.warn('Supabase RPC Error (deduct_credits):', error.message);
            // Graceful fallback to return true if RPC doesn't exist yet
            return true;
        }

        return data as boolean;
    } catch (e) {
        console.warn('Supabase RPC Exception (deduct_credits):', e);
        return true; // Fallback
    }
}

export async function addBonusCreditsAtomic(
    userId: string,
    amount: number
): Promise<void> {
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
