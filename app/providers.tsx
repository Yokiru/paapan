'use client';

import { I18nProvider } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    const router = useRouter();

    useEffect(() => {
        let active = true;

        const handleOAuthCode = async () => {
            if (typeof window === 'undefined') return;

            const url = new URL(window.location.href);
            const code = url.searchParams.get('code');
            if (!code) return;

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error('[Auth] OAuth code exchange failed:', error);
                    return;
                }
            }

            if (!active) return;

            url.searchParams.delete('code');
            url.searchParams.delete('next');
            const cleanedUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
            window.history.replaceState({}, '', cleanedUrl);
            router.refresh();
        };

        void handleOAuthCode();

        return () => {
            active = false;
        };
    }, [router]);

    return (
        <I18nProvider>
            {children}
        </I18nProvider>
    );
}
