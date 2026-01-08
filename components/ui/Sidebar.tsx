'use client';

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

/**
 * Sidebar Component - Workspace history and navigation
 */
export default function Sidebar() {
    const {
        workspaces,
        activeWorkspaceId,
        isSidebarOpen,
        setSidebarOpen,
        createWorkspace,
        switchWorkspace,
        deleteWorkspace,
        toggleWorkspaceFavorite,
        loadWorkspaces,
        saveCurrentWorkspace,
    } = useWorkspaceStore();

    const [isLoaded, setIsLoaded] = useState(false);

    // Load workspaces on mount
    useEffect(() => {
        loadWorkspaces();
        setIsLoaded(true);
    }, [loadWorkspaces]);

    // Auto-save every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            saveCurrentWorkspace();
        }, 30000);
        return () => clearInterval(interval);
    }, [saveCurrentWorkspace]);

    // Group workspaces by time
    const groupWorkspaces = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const todayWs: typeof workspaces = [];
        const thisWeekWs: typeof workspaces = [];
        const olderWs: typeof workspaces = [];

        workspaces.forEach(ws => {
            const updated = new Date(ws.updatedAt);
            if (updated >= today) {
                todayWs.push(ws);
            } else if (updated >= thisWeek) {
                thisWeekWs.push(ws);
            } else {
                olderWs.push(ws);
            }
        });

        return { todayWs, thisWeekWs, olderWs };
    };

    const { todayWs, thisWeekWs, olderWs } = groupWorkspaces();

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return new Date(date).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const WorkspaceItem = ({ ws }: { ws: typeof workspaces[0] }) => {
        const isActive = ws.id === activeWorkspaceId;
        const nodeCount = ws.nodes.length;

        return (
            <div
                className={`
                    px-3 py-2.5 rounded-xl cursor-pointer transition-colors mb-1 group
                    ${isActive
                        ? 'bg-blue-50 border border-blue-100'
                        : 'hover:bg-gray-100'
                    }
                `}
                onClick={() => switchWorkspace(ws.id)}
            >
                <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                        {ws.name}
                    </p>
                    <div className="flex items-center gap-1">
                        {/* Heart Favorite Button - always visible if favorited, toggle on hover */}
                        <button
                            className={`
                                p-1 transition-opacity hover:bg-gray-200 rounded
                                ${ws.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleWorkspaceFavorite(ws.id);
                            }}
                            title={ws.isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <svg
                                className={`w-3.5 h-3.5 ${ws.isFavorite ? 'text-rose-400' : 'text-gray-400'}`}
                                fill={ws.isFavorite ? "currentColor" : "none"}
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </button>
                        {!isActive && workspaces.length > 1 && (
                            <button
                                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 rounded"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this workspace?')) {
                                        deleteWorkspace(ws.id);
                                    }
                                }}
                                title="Delete workspace"
                            >
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                    {nodeCount} nodes • {formatTime(ws.updatedAt)}
                </p>
            </div>
        );
    };

    if (!isLoaded) return null;

    return (
        <>
            {/* Invisible overlay - just for click-to-close */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    fixed top-0 left-0 h-full w-[280px] z-50
                    flex flex-col overflow-hidden
                    transform transition-transform duration-300 ease-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                style={{
                    backgroundColor: '#fafafa',
                    borderRight: '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '4px 0 20px rgba(0,0,0,0.04)',
                }}
            >
                {/* Header */}
                <div className="px-4 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">S</span>
                            </div>
                            <span className="font-semibold text-gray-800">Spatial AI</span>
                        </div>
                        {/* New Workspace Button */}
                        <button
                            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                            title="New Workspace"
                            onClick={() => createWorkspace()}
                        >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Workspace List */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {/* Today Section */}
                    {todayWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">Today</p>
                            {todayWs.map(ws => <WorkspaceItem key={ws.id} ws={ws} />)}
                        </div>
                    )}

                    {/* This Week Section */}
                    {thisWeekWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">This Week</p>
                            {thisWeekWs.map(ws => <WorkspaceItem key={ws.id} ws={ws} />)}
                        </div>
                    )}

                    {/* Older Section */}
                    {olderWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">Older</p>
                            {olderWs.map(ws => <WorkspaceItem key={ws.id} ws={ws} />)}
                        </div>
                    )}
                </div>

                {/* Bottom Section - User Profile */}
                <div className="border-t border-gray-100 px-3 py-3">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors">
                        <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">Y</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">Yosia</p>
                            <p className="text-xs text-gray-400">Free Plan</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
