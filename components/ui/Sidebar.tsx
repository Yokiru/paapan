'use client';

import React, { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useMindStore } from '@/store/useMindStore';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import AISettingsModal from './AISettingsModal';

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
        saveCurrentWorkspace,
    } = useWorkspaceStore();

    const strokes = useMindStore(state => state.strokes);

    const isLoaded = useWorkspaceStore(state => state.isLoaded);

    // Auto-save every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            saveCurrentWorkspace();
        }, 30000);
        return () => clearInterval(interval);
    }, [saveCurrentWorkspace]);

    // Save before browser closes/refreshes
    useEffect(() => {
        const handleBeforeUnload = () => {
            saveCurrentWorkspace();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveCurrentWorkspace]);

    // Auto-save when strokes change (debounced)
    useEffect(() => {
        if (!isLoaded) return;
        const timeout = setTimeout(() => {
            saveCurrentWorkspace();
        }, 1000); // Save 1 second after last stroke
        return () => clearTimeout(timeout);
    }, [strokes, saveCurrentWorkspace, isLoaded]);

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
                            title="New Board"
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
                <ProfileSection />
            </div>
        </>
    );
}

/**
 * Profile Section Component - Shows user avatar, name, plan and popup menu
 */
function ProfileSection() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false);

    return (
        <div className="border-t border-gray-100 px-3 py-3 relative">
            {/* Profile Button */}
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Y</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-700 truncate">Yosia</p>
                    <p className="text-xs text-gray-400">Free Plan</p>
                </div>
                {/* 3-dot icon */}
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                </svg>
            </button>

            {/* Profile Menu Popup */}
            {isMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsMenuOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {/* Profile */}
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                setIsProfileModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Profile</span>
                        </button>

                        {/* AI Settings */}
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                setIsAISettingsModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">AI Settings</span>
                        </button>

                        {/* Subscription */}
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                // Navigate to subscription
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Subscription</span>
                            <span className="ml-auto text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">⚡ PRO</span>
                        </button>

                        {/* Settings */}
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                setIsSettingsModalOpen(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Settings</span>
                        </button>

                        {/* Divider */}
                        <div className="my-2 border-t border-gray-100" />

                        {/* Sign Out */}
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                // Handle sign out
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Sign out</span>
                        </button>
                    </div>
                </>
            )}

            {/* Profile Modal */}
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />

            {/* Settings Modal */}
            <SettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
            />

            {/* AI Settings Modal */}
            <AISettingsModal
                isOpen={isAISettingsModalOpen}
                onClose={() => setIsAISettingsModalOpen(false)}
            />
        </div>
    );
}
