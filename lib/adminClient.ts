'use client';

import { supabase } from '@/lib/supabase';

async function resolveAdminSession(refreshIfNeeded = true) {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
        return session;
    }

    if (!refreshIfNeeded) {
        return null;
    }

    const {
        data: { session: refreshedSession },
    } = await supabase.auth.refreshSession();

    return refreshedSession || null;
}

export async function getAdminAccessToken() {
    const session = await resolveAdminSession(true);
    return session?.access_token || null;
}

async function fetchWithAdminToken(path: string, accessToken: string, init?: RequestInit) {
    return fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
            Authorization: `Bearer ${accessToken}`,
        },
    });
}

export async function fetchAdminJson<T>(path: string): Promise<T> {
    return fetchAdmin<T>(path);
}

export async function fetchAdmin<T>(path: string, init?: RequestInit): Promise<T> {
    const session = await resolveAdminSession(true);
    if (!session?.access_token) {
        throw new Error('UNAUTHORIZED');
    }

    let response = await fetchWithAdminToken(path, session.access_token, init);

    if (response.status === 401 || response.status === 403) {
        const refreshedSession = await resolveAdminSession(true);
        if (refreshedSession?.access_token && refreshedSession.access_token !== session.access_token) {
            response = await fetchWithAdminToken(path, refreshedSession.access_token, init);
        }
    }

    if (response.status === 401 || response.status === 403) {
        throw new Error('UNAUTHORIZED');
    }

    if (!response.ok) {
        throw new Error('ADMIN_FETCH_FAILED');
    }

    return response.json() as Promise<T>;
}
