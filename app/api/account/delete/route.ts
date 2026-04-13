import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin';
import {
    ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
    accountSupportsPasswordReauth,
    buildDeletionAppMetadata,
    getDeletionEffectiveAt,
    hasRecentSignIn,
} from '@/lib/accountDeletion';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function verifyUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const {
        data: { user },
        error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
        return { errorResponse: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    return { user };
}

async function verifyCurrentPassword(email: string, password: string) {
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const { error } = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
    });

    return !error;
}

export async function POST(request: NextRequest) {
    try {
        const auth = await verifyUser(request);
        if ('errorResponse' in auth) {
            return auth.errorResponse;
        }

        const { user } = auth;

        if (isAdminEmail(user.email)) {
            return NextResponse.json({ error: 'Protected admin account' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const currentPassword =
            typeof body?.currentPassword === 'string' ? body.currentPassword : '';

        const deleteAfter = getDeletionEffectiveAt();
        const deleteAfterIso = deleteAfter.toISOString();
        const requestedAtIso = new Date().toISOString();
        const requiresPasswordReauth = accountSupportsPasswordReauth(user);

        if (requiresPasswordReauth) {
            if (!user.email) {
                return NextResponse.json({ error: 'Email akun tidak tersedia.' }, { status: 400 });
            }

            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Masukkan kata sandi Anda untuk melanjutkan.' },
                    { status: 400 }
                );
            }

            const passwordValid = await verifyCurrentPassword(user.email, currentPassword);
            if (!passwordValid) {
                return NextResponse.json(
                    { error: 'Kata sandi yang Anda masukkan tidak cocok.' },
                    { status: 401 }
                );
            }
        } else if (!hasRecentSignIn(user)) {
            return NextResponse.json(
                {
                    error: 'Untuk akun tanpa kata sandi, login ulang dulu lalu coba lagi beberapa menit setelahnya.',
                },
                { status: 403 }
            );
        }

        const nextAppMetadata = buildDeletionAppMetadata(user.app_metadata, requestedAtIso, deleteAfterIso);
        const { error: scheduleError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: nextAppMetadata,
        });

        if (scheduleError) {
            throw scheduleError;
        }

        return NextResponse.json({
            ok: true,
            status: 'scheduled',
            deleteAfter: deleteAfterIso,
            gracePeriodDays: ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
        });
    } catch (error) {
        console.error('Account delete route error:', error);
        return NextResponse.json({ error: 'Failed to schedule account deletion' }, { status: 500 });
    }
}
