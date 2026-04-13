import type { Metadata } from 'next';
import { getCanonicalAuthOrigin } from '@/lib/authUrls';
import HomeBoardClient from './home-board-client';

const siteUrl = getCanonicalAuthOrigin();

export const metadata: Metadata = {
    title: 'Paapan AI: Visual Workspace, Canvas, dan Whiteboard untuk Ide',
    description:
        'Paapan AI adalah workspace visual berbasis canvas untuk menulis ide, menghubungkan node, menata gambar, dan memakai AI langsung di board. Cocok untuk brainstorming, mind mapping, dan kerja visual modern.',
    alternates: {
        canonical: '/',
    },
    keywords: [
        'Paapan AI',
        'visual workspace',
        'AI workspace',
        'AI canvas',
        'AI whiteboard',
        'whiteboard AI',
        'board AI',
        'mind mapping AI',
        'brainstorming AI',
        'visual thinking AI',
    ],
    openGraph: {
        title: 'Paapan AI: Visual Workspace, Canvas, dan Whiteboard untuk Ide',
        description:
            'Workspace visual berbasis canvas untuk ide, gambar, dan AI langsung di board. Dirancang untuk brainstorming, mind mapping, dan kerja visual yang tidak nyaman hidup di chat vertikal.',
        url: siteUrl,
        siteName: 'Paapan AI',
        locale: 'id_ID',
        type: 'website',
        images: [
            {
                url: '/brand/lockup/paapan-lockup.png',
                width: 1200,
                height: 630,
                alt: 'Paapan AI visual workspace',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Paapan AI: Visual Workspace, Canvas, dan Whiteboard untuk Ide',
        description:
            'Canvas visual untuk ide, board, gambar, dan AI dalam satu workspace. Cocok untuk brainstorming, mapping, dan kerja visual modern.',
        images: ['/brand/lockup/paapan-lockup.png'],
    },
};

const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Paapan AI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
        'Paapan AI adalah workspace visual berbasis canvas untuk menulis ide, menghubungkan node, menata gambar, dan memakai AI langsung di board.',
    offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'IDR',
    },
    featureList: [
        'Visual workspace berbasis canvas',
        'AI langsung di board',
        'Mind mapping dan brainstorming',
        'Node, gambar, dan koneksi dalam satu ruang kerja',
    ],
    brand: {
        '@type': 'Brand',
        name: 'Paapan AI',
    },
};

export default function HomePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
            />
            <HomeBoardClient />
        </>
    );
}
