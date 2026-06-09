import type { Metadata } from 'next';

import HomeBoardClient from '@/app/home-board-client';

type SharedBoardPageProps = {
    params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
    title: 'Paapan Board',
    description: 'Buka board Paapan dari link share.',
    robots: {
        index: false,
        follow: false,
    },
};

export default async function SharedBoardPage({ params }: SharedBoardPageProps) {
    const { token } = await params;

    return <HomeBoardClient sharedToken={token} />;
}
