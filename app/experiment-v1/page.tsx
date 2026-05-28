import { notFound } from 'next/navigation';
import ExperimentBoardClient from './experiment-board-client';

export default function ExperimentV1Page() {
    if (process.env.NODE_ENV === 'production') {
        notFound();
    }

    return <ExperimentBoardClient />;
}
