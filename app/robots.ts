import type { MetadataRoute } from 'next';
import { getCanonicalAuthOrigin } from '@/lib/authUrls';

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getCanonicalAuthOrigin();

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/auth/',
                    '/doc',
                    '/login',
                    '/register',
                    '/forgot-password',
                    '/reset-password',
                    '/welcome',
                ],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
        host: siteUrl,
    };
}
