import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
        detectSessionInUrl: typeof window !== 'undefined'
    }
});

// Type definitions for database
export type Profile = {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    ai_response_style: 'concise' | 'balanced' | 'detailed';
    ai_tone: 'friendly' | 'professional';
    ai_language: 'id' | 'en';
    ai_custom_instructions: string | null;
    preferred_language: string;
    created_at: string;
    updated_at: string;
};

export type UserCredits = {
    id: string;
    user_id: string;
    purchased_credits: number;
    used_credits: number;
    free_credits_today: number;
    free_credits_used_today: number;
    last_free_reset: string;
    welcome_bonus_claimed: boolean;
    credits_expires_at: string | null;
    created_at: string;
    updated_at: string;
};

export type CreditTransaction = {
    id: string;
    user_id: string;
    type: 'purchase' | 'usage' | 'free_daily' | 'welcome_bonus' | 'manual_bonus' | 'expired' | 'refund';
    amount: number;
    description: string | null;
    action_type: string | null;
    node_id: string | null;
    package_id: string | null;
    created_at: string;
};

export type CreditPackage = {
    id: string;
    name: string;
    credits: number;
    bonus_credits: number;
    price: number;
    is_active: boolean;
    is_popular: boolean;
    sort_order: number;
    created_at: string;
};

export type Workspace = {
    id: string;
    user_id: string;
    name: string;
    is_favorite: boolean;
    viewport_x: number;
    viewport_y: number;
    viewport_zoom: number;
    nodes: any[]; // JSONB - complex React Flow nodes
    edges: any[]; // JSONB - complex React Flow edges
    strokes: any[]; // JSONB - drawing strokes
    created_at: string;
    updated_at: string;
};

export type CreditBalance = {
    purchased_credits: number;
    used_credits: number;
    remaining_purchased: number;
    free_credits_today: number;
    free_credits_used_today: number;
    free_credits_remaining: number;
    total_remaining: number;
    credits_expires_at: string | null;
    welcome_bonus_claimed: boolean;
};
