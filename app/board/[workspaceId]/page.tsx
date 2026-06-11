import type { Metadata } from 'next';

import HomeBoardClient from '@/app/home-board-client';

type BoardPageProps = {
    params: Promise<{ workspaceId: string }>;
};

export const metadata: Metadata = {
    title: 'Paapan Board',
    description: 'Buka board Paapan pribadi.',
    robots: {
        index: false,
        follow: false,
    },
};

export default async function BoardPage({ params }: BoardPageProps) {
    const { workspaceId } = await params;

    return <HomeBoardClient workspaceId={workspaceId} />;
}
