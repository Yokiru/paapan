"use client";

import { EdgeProps, getBezierPath } from 'reactflow';

export default function ExperimentEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
}: EdgeProps<{
    isActive?: boolean;
    isHighlighted?: boolean;
    branchAnimation?: 'enter' | 'exit';
}>) {
    const isActive = data?.isActive === true;
    const isHighlighted = data?.isHighlighted === true;
    const branchAnimation = data?.branchAnimation;

    const [path] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    return (
        <g className={`react-flow__edge ${branchAnimation === 'enter' ? 'experiment-branch-enter-edge' : ''} ${branchAnimation === 'exit' ? 'experiment-branch-exit-edge' : ''}`}>
            <path
                id={id}
                className={`react-flow__edge-path experiment-edge-path ${isActive ? 'experiment-edge-active' : ''} ${isHighlighted ? 'experiment-edge-highlighted' : ''} ${branchAnimation === 'enter' ? 'experiment-edge-branch-enter-path' : ''} ${branchAnimation === 'exit' ? 'experiment-edge-branch-exit-path' : ''}`}
                d={path}
                pathLength={branchAnimation ? 1 : undefined}
            />
        </g>
    );
}
