import type { Metadata } from 'next';

import SharedBoardClient from './shared-board-client';

type SharedBoardPageProps = {
    params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
    title: 'Shared Board | Paapan AI',
    description: 'Buka board Paapan dalam mode view-only melalui link share.',
    robots: {
        index: false,
        follow: false,
    },
};

export default async function SharedBoardPage({ params }: SharedBoardPageProps) {
    const { token } = await params;

    return <SharedBoardClient token={token} />;
}
