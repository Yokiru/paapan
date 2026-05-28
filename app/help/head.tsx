import { getCanonicalAuthOrigin } from '@/lib/authUrls';

export default function Head() {
    const siteUrl = getCanonicalAuthOrigin();
    const title = 'Bantuan Paapan AI: Panduan Workspace, Canvas, dan AI';
    const description =
        'Pusat bantuan Paapan AI untuk memahami workspace visual, canvas, kredit, BYOK, upload gambar, dan cara memakai AI langsung di board.';
    const canonicalUrl = `${siteUrl}/help`;
    const ogImage = `${siteUrl}/brand/lockup/paapan-lockup.png`;

    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta
                name="keywords"
                content="bantuan Paapan AI, panduan Paapan, cara pakai Paapan AI, AI workspace help, canvas AI guide, BYOK Gemini Paapan"
            />
            <link rel="canonical" href={canonicalUrl} />

            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:site_name" content="Paapan AI" />
            <meta property="og:locale" content="id_ID" />
            <meta property="og:type" content="article" />
            <meta property="og:image" content={ogImage} />

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />
        </>
    );
}
