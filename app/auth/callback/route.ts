import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getCanonicalAuthOrigin } from '@/lib/authUrls';
import { getScheduledDeletionDate } from '@/lib/authState';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';
    const safeNext = next.startsWith('/') ? next : '/';
    const origin = getCanonicalAuthOrigin();
    const cookieStore = await cookies();
    let response = NextResponse.redirect(`${origin}${safeNext}`);

    if (!code) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const scheduledDeletionDate = getScheduledDeletionDate(user);
    if (scheduledDeletionDate) {
        response = NextResponse.redirect(
            `${origin}/login?deletion_scheduled=1&delete_after=${encodeURIComponent(scheduledDeletionDate)}`
        );
    }

    return response;
}
