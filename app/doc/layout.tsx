import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAdminEmail } from '@/lib/admin';
import { createReadonlyServerSupabaseClient } from '@/lib/supabaseServer';

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function DocLayout({
    children,
}: {
    children: ReactNode;
}) {
    const supabase = await createReadonlyServerSupabaseClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user || !isAdminEmail(user.email)) {
        notFound();
    }

    return children;
}
