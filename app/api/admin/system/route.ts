import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type SystemEventRow = {
    created_at: string;
    route: string;
    event: string;
    status: number | null;
    code: string | null;
    reason: string | null;
    user_id: string | null;
};

const isMissingRelationError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? error.code : '';
    const maybeMessage = 'message' in error ? error.message : '';
    const code = typeof maybeCode === 'string' ? maybeCode : '';
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';

    return code === '42P01' || (message.includes('relation') && message.includes('does not exist'));
};

async function fetchEvents() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const { data, error } = await supabaseAdmin
        .from('ai_events')
        .select('created_at, route, event, status, code, reason, user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000);

    if (error) {
        if (isMissingRelationError(error)) {
            return { trackingEnabled: false as const, events: [] as SystemEventRow[] };
        }

        throw error;
    }

    return {
        trackingEnabled: true as const,
        events: (data || []) as SystemEventRow[],
    };
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

        const { trackingEnabled, events } = await fetchEvents();

        const routes = ['api.generate', 'api.byok.validate', 'api.upload.image'];
        const routeHealth = routes.map((route) => {
            const routeEvents = events.filter((item) => item.route === route);
            const failures = routeEvents.filter((item) => (item.status || 0) >= 400).length;
            const successes = routeEvents.filter((item) => (item.status || 0) < 400).length;
            const total = routeEvents.length;

            return {
                route,
                total,
                failures,
                successRate: total > 0 ? successes / total : 0,
            };
        });

        const topErrorCodes = new Map<string, number>();
        const topReasons = new Map<string, number>();

        events.forEach((item) => {
            if ((item.status || 0) >= 400) {
                const code = item.code || 'UNKNOWN';
                topErrorCodes.set(code, (topErrorCodes.get(code) || 0) + 1);

                const reason = item.reason || 'unknown';
                topReasons.set(reason, (topReasons.get(reason) || 0) + 1);
            }
        });

        const recentIncidents = events
            .filter((item) => (item.status || 0) >= 400)
            .slice(0, 12)
            .map((item) => ({
                createdAt: item.created_at,
                route: item.route,
                event: item.event,
                status: item.status,
                code: item.code || 'UNKNOWN',
                reason: item.reason || 'unknown',
                userId: item.user_id,
            }));

        const rateLimitedCount = events.filter((item) => item.code === 'RATE_LIMITED').length;
        const unavailableCount = events.filter((item) => item.code === 'AI_UNAVAILABLE').length;
        const uploadFailCount = events.filter((item) => item.route === 'api.upload.image' && (item.status || 0) >= 400).length;

        return NextResponse.json({
            trackingEnabled,
            stats: {
                incidents7d: recentIncidents.length,
                rateLimited7d: rateLimitedCount,
                unavailable7d: unavailableCount,
                uploadFailures7d: uploadFailCount,
            },
            routeHealth,
            topErrors: Array.from(topErrorCodes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([code, count]) => ({ code, count })),
            topReasons: Array.from(topReasons.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([reason, count]) => ({ reason, count })),
            recentIncidents,
        });
    } catch (error) {
        console.error('Admin system route error:', error);
        return NextResponse.json({ error: 'Failed to load system health' }, { status: 500 });
    }
}
