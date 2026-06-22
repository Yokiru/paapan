import { NextResponse } from 'next/server';
import { getCanonicalAuthOrigin } from '@/lib/authUrls';
import { getScheduledDeletionDate } from '@/lib/authState';
import { createRouteHandlerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';
    const termsAccepted = requestUrl.searchParams.get('terms_accepted') === '1';
    const termsVersion = requestUrl.searchParams.get('terms_version');
    const marketingOptInRaw = requestUrl.searchParams.get('marketing_opt_in');
    const safeNext = next.startsWith('/') ? next : '/';
    const origin = getCanonicalAuthOrigin();
    let response = NextResponse.redirect(`${origin}${safeNext}`);

    if (!code) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const supabase = await createRouteHandlerSupabaseClient(response);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        return NextResponse.redirect(`${origin}/login`);
    }

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (user && (termsAccepted || marketingOptInRaw !== null)) {
        const nextMetadata = {
            ...(user.user_metadata || {}),
            ...(termsAccepted
                ? {
                    terms_accepted: true,
                    terms_accepted_at: new Date().toISOString(),
                    terms_version: typeof termsVersion === 'string' && termsVersion.trim()
                        ? termsVersion.trim()
                        : '2026-04-14',
                }
                : {}),
            ...(marketingOptInRaw !== null
                ? { marketing_opt_in: marketingOptInRaw === '1' }
                : {}),
        };

        const { error: updateMetadataError } = await supabase.auth.updateUser({
            data: nextMetadata,
        });

        if (updateMetadataError) {
            console.warn('[AuthCallback] Failed to store consent metadata:', updateMetadataError.message);
        }
    }

    const scheduledDeletionDate = getScheduledDeletionDate(user);
    if (scheduledDeletionDate) {
        response = NextResponse.redirect(
            `${origin}/login?deletion_scheduled=1&delete_after=${encodeURIComponent(scheduledDeletionDate)}`
        );
    }

    return response;
}
