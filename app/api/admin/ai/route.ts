import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type AIEventRow = {
    created_at: string;
    route: 'api.generate' | 'api.byok.validate' | 'api.upload.image';
    event: string;
    user_id: string | null;
    requested_ai_mode: 'paapan' | 'byok' | null;
    requested_ai_provider: string | null;
    resolved_model_id: string | null;
    status: number | null;
    code: string | null;
    action_type: string | null;
};

type DailyMetricPoint = {
    date: string;
    label: string;
    value: number;
};

const formatDateKey = (value: string) =>
    new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value));

const formatDateLabel = (value: string) => {
    const date = new Date(`${value}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Asia/Makassar',
    }).format(date);
};

const buildDailySeries = (days: number) => {
    const now = new Date();
    const points: DailyMetricPoint[] = [];

    for (let index = days - 1; index >= 0; index -= 1) {
        const day = new Date(now);
        day.setDate(now.getDate() - index);

        const key = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Makassar',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(day);

        points.push({
            date: key,
            label: formatDateLabel(key),
            value: 0,
        });
    }

    return points;
};

const isMissingRelationError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = 'code' in error ? error.code : '';
    const maybeMessage = 'message' in error ? error.message : '';
    const code = typeof maybeCode === 'string' ? maybeCode : '';
    const message = typeof maybeMessage === 'string' ? maybeMessage.toLowerCase() : '';

    return code === '42P01' || (message.includes('relation') && message.includes('does not exist'));
};

async function fetchAIEvents() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const { data, error } = await supabaseAdmin
        .from('ai_events')
        .select('created_at, route, event, user_id, requested_ai_mode, requested_ai_provider, resolved_model_id, status, code, action_type')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(10000);

    if (error) {
        if (isMissingRelationError(error)) {
            return { trackingEnabled: false as const, events: [] as AIEventRow[] };
        }

        throw error;
    }

    return {
        trackingEnabled: true as const,
        events: (data || []) as AIEventRow[],
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

        const { trackingEnabled, events } = await fetchAIEvents();
        const requests30d = buildDailySeries(30);
        const byok30d = buildDailySeries(30);
        const failures30d = buildDailySeries(30);
        const requestsMap = new Map(requests30d.map((point) => [point.date, point]));
        const byokMap = new Map(byok30d.map((point) => [point.date, point]));
        const failuresMap = new Map(failures30d.map((point) => [point.date, point]));

        const generateEvents = events.filter((item) => item.route === 'api.generate');
        const validationEvents = events.filter((item) => item.route === 'api.byok.validate');
        const successfulGenerateEvents = generateEvents.filter((item) => item.event === 'success');
        const failedGenerateEvents = generateEvents.filter((item) => item.event !== 'success');
        const byokGenerateEvents = generateEvents.filter((item) => item.requested_ai_mode === 'byok');
        const validationSuccesses = validationEvents.filter((item) => item.event === 'validation_success');
        const validationFailures = validationEvents.filter((item) => item.event === 'validation_failed');
        const uploadEvents = events.filter((item) => item.route === 'api.upload.image');

        const aiUsers = new Set(generateEvents.map((item) => item.user_id).filter(Boolean));
        const byokUsers = new Set(byokGenerateEvents.map((item) => item.user_id).filter(Boolean));
        const byokAdoptionRate = aiUsers.size > 0 ? byokUsers.size / aiUsers.size : 0;

        const modelUsage = new Map<string, number>();
        const actionUsage = new Map<string, number>();
        const errorCodes = new Map<string, number>();
        successfulGenerateEvents.forEach((item) => {
            const modelId = item.resolved_model_id || 'unknown';
            modelUsage.set(modelId, (modelUsage.get(modelId) || 0) + 1);
        });

        generateEvents.forEach((item) => {
            const actionType = item.action_type || 'unknown';
            actionUsage.set(actionType, (actionUsage.get(actionType) || 0) + 1);

            if (item.event !== 'success') {
                const code = item.code || 'UNKNOWN';
                errorCodes.set(code, (errorCodes.get(code) || 0) + 1);
            }
        });

        validationEvents.forEach((item) => {
            if (item.event === 'validation_failed') {
                const code = item.code || 'UNKNOWN';
                errorCodes.set(code, (errorCodes.get(code) || 0) + 1);
            }
        });

        uploadEvents.forEach((item) => {
            if (item.status && item.status >= 400) {
                const code = item.code || 'UNKNOWN';
                errorCodes.set(code, (errorCodes.get(code) || 0) + 1);
            }
        });

        events.forEach((item) => {
            const key = formatDateKey(item.created_at);
            if (item.route === 'api.generate') {
                requestsMap.get(key)!.value += 1;

                if (item.requested_ai_mode === 'byok') {
                    byokMap.get(key)!.value += 1;
                }

                if (item.event !== 'success') {
                    failuresMap.get(key)!.value += 1;
                }
            }

            if (item.route === 'api.byok.validate' && item.event === 'validation_failed') {
                failuresMap.get(key)!.value += 1;
            }
        });

        return NextResponse.json({
            trackingEnabled,
            stats: {
                requests30d: generateEvents.length,
                successRate: generateEvents.length > 0 ? successfulGenerateEvents.length / generateEvents.length : 0,
                aiUsers30d: aiUsers.size,
                byokRequests30d: byokGenerateEvents.length,
                byokUsers30d: byokUsers.size,
                validationSuccesses30d: validationSuccesses.length,
                validationFailures30d: validationFailures.length,
                byokAdoptionRate,
                uploadFailures30d: uploadEvents.filter((item) => (item.status || 0) >= 400).length,
            },
            charts: {
                requests30d,
                byok30d,
                failures30d,
            },
            topModels: Array.from(modelUsage.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([modelId, count]) => ({ modelId, count })),
            topActions: Array.from(actionUsage.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([actionType, count]) => ({ actionType, count })),
            topErrors: Array.from(errorCodes.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([code, count]) => ({ code, count })),
        });
    } catch (error) {
        console.error('Admin AI route error:', error);
        return NextResponse.json({ error: 'Failed to load admin AI data' }, { status: 500 });
    }
}
