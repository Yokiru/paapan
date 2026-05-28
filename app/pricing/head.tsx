import { getCanonicalAuthOrigin } from '@/lib/authUrls';

export default function Head() {
    const siteUrl = getCanonicalAuthOrigin();
    const title = 'Harga Paapan AI: Paket, Kredit, dan BYOK untuk Workspace Visual';
    const description =
        'Lihat harga dan paket Paapan AI untuk workspace visual berbasis canvas. Pahami free plan, kredit AI, BYOK Gemini, dan arah paket berbayar yang sedang disiapkan.';
    const canonicalUrl = `${siteUrl}/pricing`;
    const ogImage = `${siteUrl}/brand/lockup/paapan-lockup.png`;

    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta
                name="keywords"
                content="harga Paapan AI, paket Paapan, pricing Paapan AI, AI workspace pricing, BYOK Gemini pricing, kredit AI Paapan"
            />
            <link rel="canonical" href={canonicalUrl} />

            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:site_name" content="Paapan AI" />
            <meta property="og:locale" content="id_ID" />
            <meta property="og:type" content="website" />
            <meta property="og:image" content={ogImage} />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
        </>
    );
}
