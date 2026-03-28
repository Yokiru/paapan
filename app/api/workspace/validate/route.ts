import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { isBlockedUser } from '@/lib/authState';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Tier-based limits (must match creditCosts.ts SUBSCRIPTION_PLANS)
const TIER_LIMITS: Record<string, { maxWorkspaces: number; maxNodes: number }> = {
    free: { maxWorkspaces: 3, maxNodes: 50 },
    plus: { maxWorkspaces: 10, maxNodes: 300 },
    pro: { maxWorkspaces: -1, maxNodes: -1 }, // unlimited
};

/**
 * Server-side workspace limit validation
 * SECURITY: Prevents tier manipulation via localStorage
 * 
 * POST body: { action: 'create_workspace' | 'add_node', workspaceId?: string }
 */
export async function POST(request: NextRequest) {
    try {
        // Auth
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            // Guests: return static limits only, no spoofable-IP rate limit bucket required.
            return NextResponse.json({
                allowed: true,
                tier: 'guest',
                limits: { maxWorkspaces: 1, maxNodes: 10 }
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        if (isBlockedUser(user)) {
            return NextResponse.json({ error: 'Account blocked', code: 'ACCOUNT_BLOCKED' }, { status: 403 });
        }

        const rl = checkRateLimit(`validate:user:${user.id}`, RATE_LIMITS.general);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        // Fetch real tier from database (NOT from client)
        const { data: sub } = await supabaseAdmin
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .single();

        const tier = sub?.tier || 'free';
        const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

        const body = await request.json();
        const { action, workspaceId } = body;

        if (action === 'create_workspace') {
            // Count existing workspaces
            const { count } = await supabaseAdmin
                .from('workspaces')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id);

            const currentCount = count || 0;

            // Use strictly greater than (>) because the newly created workspace is ALREADY in the count
            // due to parallel execution. E.g max 3, inserting 3rd -> count is 3. 3 > 3 is false (allowed).
            // inserting 4th -> count is 4. 4 > 3 is true (rejected).
            if (limits.maxWorkspaces !== -1 && currentCount > limits.maxWorkspaces) {
                return NextResponse.json({
                    allowed: false,
                    reason: `Workspace limit reached (${currentCount}/${limits.maxWorkspaces}). Upgrade your plan.`,
                    tier,
                    limits
                });
            }
        }

        if (action === 'add_node' && workspaceId) {
            // Count existing nodes in workspace
            const { data: ws } = await supabaseAdmin
                .from('workspaces')
                .select('nodes')
                .eq('id', workspaceId)
                .eq('user_id', user.id)
                .single();

            const nodeCount = Array.isArray(ws?.nodes) ? ws.nodes.length : 0;

            // Use strictly greater than (>) for the same reason
            if (limits.maxNodes !== -1 && nodeCount > limits.maxNodes) {
                return NextResponse.json({
                    allowed: false,
                    reason: `Node limit reached (${nodeCount}/${limits.maxNodes}). Upgrade your plan.`,
                    tier,
                    limits
                });
            }
        }

        return NextResponse.json({
            allowed: true,
            tier,
            limits
        });

    } catch (error) {
        console.error('Validate error:', error);
        return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
    }
}
