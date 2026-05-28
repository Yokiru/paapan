import type { MetadataRoute } from 'next';
import { getCanonicalAuthOrigin } from '@/lib/authUrls';

type SitemapPage = {
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
    priority: number;
};

const PUBLIC_PAGES: SitemapPage[] = [
    {
        path: '/',
        changeFrequency: 'daily',
        priority: 1,
    },
    {
        path: '/help',
        changeFrequency: 'weekly',
        priority: 0.9,
    },
    {
        path: '/pricing',
        changeFrequency: 'weekly',
        priority: 0.9,
    },
    {
        path: '/feedback',
        changeFrequency: 'monthly',
        priority: 0.5,
    },
    {
        path: '/privacy',
        changeFrequency: 'yearly',
        priority: 0.3,
    },
    {
        path: '/terms',
        changeFrequency: 'yearly',
        priority: 0.3,
    },
];

export default function sitemap(): MetadataRoute.Sitemap {
    const siteUrl = getCanonicalAuthOrigin();
    const lastModified = new Date();

    return PUBLIC_PAGES.map((page) => ({
        url: `${siteUrl}${page.path}`,
        lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
    }));
}
