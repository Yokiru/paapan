import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hardDeleteAccount } from '@/lib/accountDeletion';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const cronSecret = process.env.CRON_SECRET || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function isDeletionDue(user: { app_metadata?: Record<string, unknown> | null }) {
    const rawValue = user.app_metadata?.deletion_effective_at;
    if (typeof rawValue !== 'string' || !rawValue) return false;

    const scheduledAt = new Date(rawValue).getTime();
    if (!Number.isFinite(scheduledAt)) return false;

    return scheduledAt <= Date.now();
}

async function listDeletionDueUsers() {
    const users: Array<{ id: string; email: string | null }> = [];
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) throw error;

        const pageUsers = (data?.users || []).filter(isDeletionDue);
        users.push(
            ...pageUsers.map((user) => ({
                id: user.id,
                email: user.email || null,
            }))
        );

        if ((data?.users || []).length < perPage) {
            break;
        }

        page += 1;
    }

    return users;
}

export async function POST(request: NextRequest) {
    try {
        const incomingSecret = request.headers.get('x-cron-secret') || '';
        if (!cronSecret || incomingSecret !== cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dueUsers = await listDeletionDueUsers();
        const deletedUserIds: string[] = [];

        for (const user of dueUsers) {
            await hardDeleteAccount(supabaseAdmin, user.id);
            deletedUserIds.push(user.id);
        }

        return NextResponse.json({
            ok: true,
            deletedCount: deletedUserIds.length,
            deletedUserIds,
        });
    } catch (error) {
        console.error('Finalize deletions route error:', error);
        return NextResponse.json({ error: 'Failed to finalize scheduled deletions' }, { status: 500 });
    }
}
