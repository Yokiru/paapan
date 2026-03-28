import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildCreditSnapshot, getNormalizedCreditBalance, getOrCreateSubscriptionTier } from '@/lib/serverCredits';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { isBlockedUser } from '@/lib/authState';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

        if (isBlockedUser(user)) {
            return NextResponse.json({ error: 'Account blocked', code: 'ACCOUNT_BLOCKED' }, { status: 403 });
        }

        const rl = checkRateLimit(`credits:user:${user.id}`, RATE_LIMITS.general);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        const tier = await getOrCreateSubscriptionTier(supabaseAdmin, user.id);
        const normalizedBalance = await getNormalizedCreditBalance(supabaseAdmin, user.id, tier);

        return NextResponse.json(buildCreditSnapshot(normalizedBalance, tier));
    } catch (error) {
        console.error('Credits route error:', error);
        return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 });
    }
}
