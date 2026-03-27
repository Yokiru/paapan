'use client';

import { supabase } from '@/lib/supabase';

export async function getAdminAccessToken() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || null;
}

export async function fetchAdminJson<T>(path: string): Promise<T> {
    const accessToken = await getAdminAccessToken();
    if (!accessToken) {
        throw new Error('UNAUTHORIZED');
    }

    const response = await fetch(path, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status === 401 || response.status === 403) {
        throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
        throw new Error('ADMIN_FETCH_FAILED');
    }

    return response.json() as Promise<T>;
}
