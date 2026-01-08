"use client";

import React from 'react';
import { Position, Edge } from 'reactflow';

interface HandleMenuProps {
    position: Position;
    onAskFollowUp: () => void;
    onClose: () => void;
    borderColor: string;
    connectedEdges?: Edge[];
    onDisconnect?: (edgeId: string) => void;
    onEdgeHover?: (edgeId: string | null) => void;
}

/**
 * HandleMenu - Bubble popup menu for node handles
 * Shows options like "Ask a follow-up" and disconnect edges
 */
const HandleMenu = ({
    position,
    onAskFollowUp,
    onClose,
    borderColor,
    connectedEdges = [],
    onDisconnect,
    onEdgeHover,
}: HandleMenuProps) => {
    // Position offset based on handle position
    const menuStyle: React.CSSProperties = {
        position: 'absolute',
        zIndex: 100,
        ...(position === Position.Top && { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' }),
        ...(position === Position.Bottom && { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' }),
        ...(position === Position.Left && { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' }),
        ...(position === Position.Right && { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' }),
    };

    const hasEdges = connectedEdges.length > 0;

    return (
        <div
            style={menuStyle}
            className="handle-menu bg-white rounded-xl shadow-lg border border-gray-200 p-1 animate-fadeIn min-w-[160px]"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Ask Follow-up button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onAskFollowUp();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Ask a follow-up
            </button>

            {/* Disconnect section - only show if edges exist */}
            {hasEdges && (
                <>
                    <div className="border-t border-gray-100 my-1" />
                    <div className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">
                        Disconnect
                    </div>
                    {connectedEdges.map((edge) => (
                        <button
                            key={edge.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDisconnect?.(edge.id);
                                onClose();
                            }}
                            onMouseEnter={() => onEdgeHover?.(edge.id)}
                            onMouseLeave={() => onEdgeHover?.(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            Edge to {edge.source === edge.id.split('-')[1] ? edge.target : edge.source}
                        </button>
                    ))}
                </>
            )}
        </div>
    );
};

export default HandleMenu;
