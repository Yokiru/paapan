'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { isTransientWorkspaceNetworkError, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useMindStore } from '@/store/useMindStore';
import { useAISettingsStore } from '@/store/useAISettingsStore';
import ProfileModal from './ProfileModal';
import AISettingsModal from './AISettingsModal';
import CreditDisplay from './CreditDisplay';
import CreditPurchaseModal from './CreditPurchaseModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { getScheduledDeletionDate, isBlockedUser } from '@/lib/authState';
import { getWorkspaceLimit } from '@/lib/creditCosts';
import type { User } from '@supabase/supabase-js';
import { isExperimentModeEnabled, shouldHideExperimentAuthUi } from '@/lib/experimentMode';

interface SidebarProps {
    sharedMode?: boolean;
}

/**
 * Sidebar Component - Workspace history and navigation
 */
export default function Sidebar({ sharedMode = false }: SidebarProps = {}) {
    const router = useRouter();
    const { t } = useTranslation();
    const isExperiment = isExperimentModeEnabled();
    const {
        workspaces,
        activeWorkspaceId,
        isSidebarOpen,
        setSidebarOpen,
        createWorkspace,
        switchWorkspace,
        deleteWorkspace,
        renameWorkspace,
        toggleWorkspaceFavorite,
        saveCurrentWorkspace,
    } = useWorkspaceStore();

    const strokes = useMindStore(state => state.strokes);

    const isLoaded = useWorkspaceStore(state => state.isLoaded);
    const isLoading = useWorkspaceStore(state => state.isLoading);
    const userId = useWorkspaceStore(state => state.userId);
    const guestLimitReason = useMindStore(state => state.guestLimitReason);

    // Workspace limit alert state
    const [showLimitAlert, setShowLimitAlert] = useState(false);

    // Delete confirmation state
    const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);

    // Three-dot menu state
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    // Rename state
    const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    const saveImmediately = useCallback(() => {
        const activeWorkspace = useWorkspaceStore.getState().getActiveWorkspace();
        if (activeWorkspace?.shareToken || activeWorkspace?.isExternalShare) return;

        void saveCurrentWorkspace(true).catch((error) => {
            if (isTransientWorkspaceNetworkError(error)) {
                console.warn('Sidebar autosave sementara gagal.');
                return;
            }

            console.error('Sidebar autosave failed:', error);
        });
    }, [saveCurrentWorkspace]);

    const startRename = (wsId: string, currentName: string) => {
        setMenuOpenId(null);
        setRenamingWorkspaceId(wsId);
        setRenameValue(currentName);
        setTimeout(() => renameInputRef.current?.focus(), 50);
    };

    const confirmRename = () => {
        if (renamingWorkspaceId && renameValue.trim()) {
            renameWorkspace(renamingWorkspaceId, renameValue.trim());
        }
        setRenamingWorkspaceId(null);
    };

    const cancelRename = () => {
        setRenamingWorkspaceId(null);
    };

    const activateWorkspaceFromSidebar = (ws: typeof workspaces[0]) => {
        if (renamingWorkspaceId === ws.id) return;

        if (ws.shareToken || ws.isExternalShare) {
            if (ws.shareToken) {
                router.push(`/b/${ws.shareToken}`);
            } else {
                router.push(`/board/${ws.id}`);
            }

            const safeNodes = JSON.parse(JSON.stringify(ws.nodes || []));
            const safeEdges = JSON.parse(JSON.stringify(ws.edges || []));

            useMindStore.setState({
                nodes: safeNodes,
                edges: safeEdges,
                frames: ws.frames || [],
                selectedFrameId: null,
                strokes: ws.strokes || [],
                arrows: ws.arrows || [],
                strokeHistory: [],
                strokeFuture: [],
                pendingViewport: ws.viewport || { x: 0, y: 0, zoom: 1 },
            });
            useWorkspaceStore.setState({ activeWorkspaceId: ws.id });
            return;
        }

        void switchWorkspace(ws.id);
        router.push(`/board/${ws.id}`);
    };

    // Close dropdown menu when clicking outside
    useEffect(() => {
        if (!menuOpenId) return;
        const handleClickOutside = () => setMenuOpenId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpenId]);

    const handleNewWorkspace = async () => {
        const wsId = await createWorkspace();
        if (wsId) {
            router.push(`/board/${wsId}`);
            return;
        }

        if (!wsId) {
            if (isExperiment) return;
            // Check if guest
            const { userId } = useWorkspaceStore.getState();
            if (!userId) {
                useMindStore.getState().setGuestLimitReason('workspace');
            } else {
                router.push('/pricing');
            }
        }
    };

    // Auto-save interval: 5s for cloud users, 30s for guests
    useEffect(() => {
        const interval = setInterval(() => {
            saveImmediately();
        }, userId ? 5000 : 30000);
        return () => clearInterval(interval);
    }, [saveImmediately, userId]);

    // Save before browser closes/refreshes - multiple event listeners for reliability
    useEffect(() => {
        const handleBeforeUnload = () => {
            saveImmediately();
        };

        // visibilitychange fires BEFORE beforeunload and is more reliable for async saves
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                saveImmediately();
            }
        };

        // pagehide is another reliable event for saving before page unloads
        const handlePageHide = () => {
            saveImmediately();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [saveImmediately]);

    // Auto-save when strokes change (debounced)
    useEffect(() => {
        if (!isLoaded) return;
        const timeout = setTimeout(() => {
            saveImmediately();
        }, 1000); // Save 1 second after last stroke
        return () => clearTimeout(timeout);
    }, [strokes, saveImmediately, isLoaded]);

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

        if (minutes < 1) return t.sidebar.today; // Approximated
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return new Date(date).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const renderWorkspaceItem = (ws: typeof workspaces[0]) => {
        const isActive = ws.id === activeWorkspaceId;
        const nodeCount = ws.nodes.length;
        const isRenaming = renamingWorkspaceId === ws.id;
        const isExternalSharedWorkspace = Boolean(ws.shareToken || ws.isExternalShare);
        const isSharedWorkspace = isExternalSharedWorkspace || ws.shareVisibility === 'link_view';

        return (
            <div
                className={`
                    px-3 py-2.5 rounded-xl cursor-pointer transition-colors mb-1 group relative
                    ${isActive
                        ? 'bg-blue-50 border border-blue-100'
                        : 'hover:bg-gray-100'
                    }
                `}
                onClick={() => activateWorkspaceFromSidebar(ws)}
            >
                <div className="flex items-center justify-between">
                    {isRenaming ? (
                        <input
                            ref={renameInputRef}
                            className="text-sm font-medium text-gray-700 bg-white border border-blue-300 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-400 w-full mr-2"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmRename();
                                if (e.key === 'Escape') cancelRename();
                            }}
                            onBlur={confirmRename}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div className="min-w-0 flex items-center gap-1.5">
                            <p className={`truncate text-sm font-medium ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                                {ws.name}
                            </p>
                            {isSharedWorkspace && (
                                <span
                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-slate-400'}`}
                                    title="Collaborative board"
                                >
                                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                        <path d="M7.5 9.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
                                        <path d="M2 16.35c0-2.55 2.45-4.6 5.5-4.6s5.5 2.05 5.5 4.6c0 .5-.4.9-.9.9H2.9a.9.9 0 0 1-.9-.9Z" />
                                        <path d="M13.15 10.2a2.75 2.75 0 1 0-.7-5.4 4.8 4.8 0 0 1 .05 4.9c.2.25.42.42.65.5Z" opacity="0.72" />
                                        <path d="M13.9 11.75c1.85.45 3.1 1.75 3.1 3.25 0 .42-.33.75-.75.75h-1.72a3.85 3.85 0 0 0-1.18-3.75c.18-.1.37-.18.55-.25Z" opacity="0.72" />
                                    </svg>
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        {/* Heart Favorite Button - always visible if favorited, toggle on hover */}
                        {!isExternalSharedWorkspace && (
                        <button
                            className={`
                                p-1 transition-opacity hover:bg-gray-200 rounded
                                ${ws.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                            `}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleWorkspaceFavorite(ws.id);
                            }}
                            title={ws.isFavorite ? t.sidebar.removeFromFavorites : t.sidebar.addToFavorites}
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
                        )}
                        {/* Three-dot menu button */}
                        {!isExternalSharedWorkspace && !isRenaming && (
                            <button
                                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-200 rounded"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(menuOpenId === ws.id ? null : ws.id);
                                }}
                                title="More options"
                            >
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
                <p className={`text-xs mt-0.5 ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                    {nodeCount} nodes • {formatTime(ws.updatedAt)}
                </p>

                {/* Dropdown Menu */}
                {!isExternalSharedWorkspace && menuOpenId === ws.id && (
                    <div
                        className="absolute right-2 top-full mt-1 bg-white shadow-lg border border-gray-200 rounded-lg py-1 z-50 min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            onClick={() => startRename(ws.id, ws.name)}
                        >
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Rename
                        </button>
                        {workspaces.length > 1 && (
                            <button
                                className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={() => {
                                    setMenuOpenId(null);
                                    setWorkspaceToDelete(ws.id);
                                }}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!isLoaded) return null;

    return (
        <>
            {/* Sidebar */}
            <div
                className={`
                    fixed top-0 left-0 h-full w-[280px] z-[110]
                    flex flex-col overflow-hidden bg-white
                    transform transition-transform duration-300 ease-out border-r border-gray-100 shadow-[4px_0_20px_rgba(0,0,0,0.04)]
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
                        {/* Close Sidebar Button (Replaces Logo) */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors group"
                                title="Close Sidebar"
                            >
                                <img
                                    src="/icons/sidebar/sidebar-close.svg"
                                    alt="Close Sidebar"
                                    width={22}
                                    height={22}
                                    className="opacity-80 transition-opacity duration-200 group-hover:opacity-100"
                                />
                            </button>
                            <Image
                                src="/brand/wordmark/paapan-wordmark.svg"
                                alt={t.sidebar.appName}
                                width={108}
                                height={26}
                                className="h-6 w-auto"
                                priority
                            />
                        </div>
                        <button
                            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                            title={t.sidebar.newBoard}
                            onClick={handleNewWorkspace}
                        >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Workspace List */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-4">
                            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                            <span className="ml-2 text-xs text-gray-400">Syncing...</span>
                        </div>
                    )}

                    {/* Today Section */}
                    {todayWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">{t.sidebar.today}</p>
                            {todayWs.map(ws => <React.Fragment key={ws.id}>{renderWorkspaceItem(ws)}</React.Fragment>)}
                        </div>
                    )}

                    {/* This Week Section */}
                    {thisWeekWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">{t.sidebar.thisWeek}</p>
                            {thisWeekWs.map(ws => <React.Fragment key={ws.id}>{renderWorkspaceItem(ws)}</React.Fragment>)}
                        </div>
                    )}

                    {/* Older Section */}
                    {olderWs.length > 0 && (
                        <div className="mb-4">
                            <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">{t.sidebar.older}</p>
                            {olderWs.map(ws => <React.Fragment key={ws.id}>{renderWorkspaceItem(ws)}</React.Fragment>)}
                        </div>
                    )}
                </div>

                {/* Workspace Limit Alert Toast */}
                {showLimitAlert && (
                    <div className="absolute bottom-16 left-3 right-3 bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg animate-in slide-in-from-bottom-2 z-50">
                        <p className="text-sm font-medium text-amber-800 mb-1">
                            ⚠️ Batas workspace tercapai ({getWorkspaceLimit()} maks)
                        </p>
                        <p className="text-xs text-amber-600 mb-2">
                            Upgrade paket untuk workspace lebih banyak.
                        </p>
                        <button
                            onClick={() => {
                                setSidebarOpen(false);
                                router.push('/pricing');
                            }}
                            className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                        >
                            Lihat Paket Upgrade
                        </button>
                    </div>
                )}

                {/* Confirm Delete Dialog */}
                <ConfirmDialog
                    isOpen={workspaceToDelete !== null}
                    title="Hapus Workspace"
                    message="Apakah Anda yakin ingin menghapus workspace ini? Tindakan ini tidak dapat dibatalkan."
                    confirmLabel="Ya, Hapus"
                    cancelLabel="Batal"
                    variant="danger"
                    onConfirm={() => {
                        if (workspaceToDelete) {
                            deleteWorkspace(workspaceToDelete);
                        }
                    }}
                    onCancel={() => setWorkspaceToDelete(null)}
                />

                {/* Guest Limit Modal via Zustand Store is handled centrally in app/ globals or canvas wrappers */}

                {/* Bottom Section - User Profile */}
                <ProfileSection sharedMode={sharedMode} />
            </div>
        </>
    );
}

interface ProfileSectionProps {
    sharedMode?: boolean;
}

/**
 * Profile Section Component - Shows user avatar, name, plan and popup menu
 */
function ProfileSection({ sharedMode = false }: ProfileSectionProps = {}) {
    const { t } = useTranslation();
    const router = useRouter();
    const isExperiment = isExperimentModeEnabled();
    const [user, setUser] = useState<User | null>(null);
    const [, setIsLoading] = useState(!isExperiment);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false);
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const { setUserId, setSidebarOpen } = useWorkspaceStore(); // Connect to store
    const clearCustomApiKey = useAISettingsStore(state => state.clearCustomApiKey);

    const getRestrictedRedirectPath = useCallback((restrictedUser: User | null) => {
        const scheduledDeletionDate = getScheduledDeletionDate(restrictedUser);
        if (scheduledDeletionDate) {
            return `/login?deletion_scheduled=1&delete_after=${encodeURIComponent(scheduledDeletionDate)}`;
        }

        return '/login?blocked=1';
    }, []);

    // Check auth state
    useEffect(() => {
        if (isExperiment) {
            if (!sharedMode) {
                setUserId(null);
            }
            return;
        }

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (isBlockedUser(user)) {
                clearCustomApiKey();
                await supabase.auth.signOut();
                setUser(null);
                if (!sharedMode) {
                    setUserId(null);
                }
                setIsLoading(false);
                router.replace(getRestrictedRedirectPath(user));
                return;
            }
            setUser(user);
            if (!sharedMode) {
                setUserId(user?.id || null); // Update store
            }
            setIsLoading(false);
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const newUser = session?.user || null;
            if (isBlockedUser(newUser)) {
                clearCustomApiKey();
                await supabase.auth.signOut();
                setUser(null);
                if (!sharedMode) {
                    setUserId(null);
                }
                router.replace(getRestrictedRedirectPath(newUser));
                return;
            }
            setUser(newUser);
            if (!sharedMode) {
                setUserId(newUser?.id || null); // Update store
            }
        });

        return () => subscription.unsubscribe();
    }, [clearCustomApiKey, getRestrictedRedirectPath, isExperiment, router, setUserId, sharedMode]);

    const handleSignOut = async () => {
        if (isExperiment) {
            setIsMenuOpen(false);
            return;
        }
        setIsMenuOpen(false);
        clearCustomApiKey();
        await supabase.auth.signOut();
        router.push('/login');
    };

    const isGuest = !user;
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t.profileMenu.userName;
    const displayName = isExperiment ? 'Eksperimen Lokal' : (isGuest ? 'Tamu' : userName);
    const userInitial = displayName.charAt(0).toUpperCase();
    const openWhatsApp = (message: string) => {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/62895360148909?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
    };

    const openFeedbackPage = () => {
        setIsMenuOpen(false);
        setSidebarOpen(false);
        router.push('/feedback');
    };

    return (
        <div className="border-t border-gray-100 px-3 py-3 relative">
            {/* Profile Button */}
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-medium">{userInitial}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-700 truncate leading-tight">
                        {displayName}
                    </p>
                    {/* Credit Display */}
                    {!isExperiment && <CreditDisplay />}
                </div>
                {/* 3-dot icon */}
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
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
                        {shouldHideExperimentAuthUi() ? (
                            <>
                                <div className="px-4 py-2">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                                        Sandbox
                                    </p>
                                    <p className="mt-1 text-sm text-gray-600">
                                        Board lokal tanpa login, limit, atau sinkronisasi cloud.
                                    </p>
                                </div>

                                <div className="my-1 border-t border-gray-100" />

                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsAISettingsModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.aiSettings}</span>
                                </button>

                                <button
                                    onClick={openFeedbackPage}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.feedback || 'Feedback'}</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push('/help');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.help || 'Bantuan'}</span>
                                </button>
                            </>
                        ) : isGuest ? (
                            <>
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push('/login');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">Masuk</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push('/register');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">Daftar</span>
                                </button>

                                {/* Divider */}
                                <div className="my-1 border-t border-gray-100" />

                                {/* Feedback */}
                                <button
                                    onClick={openFeedbackPage}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.feedback || 'Feedback'}</span>
                                </button>

                                {/* Help */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push('/help');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.help || 'Bantuan'}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Profile */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsProfileModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.profile}</span>
                                </button>

                                {/* AI Settings */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsAISettingsModalOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.aiSettings}</span>
                                </button>

                                {/* Subscription */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setSidebarOpen(false);
                                        router.push('/pricing');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.subscription}</span>
                                    <span className="ml-auto text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">⚡ {t.profileMenu.plusPlan.split(' ')[0]}</span>
                                </button>

                                {/* Divider */}
                                <div className="my-1 border-t border-gray-100" />

                                {/* Feedback */}
                                <button
                                    onClick={openFeedbackPage}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.feedback || 'Feedback'}</span>
                                </button>

                                {/* Help */}
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        router.push('/help');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.help || 'Bantuan'}</span>
                                </button>

                                {/* Divider */}
                                <div className="my-1 border-t border-gray-100" />

                                {/* Sign Out */}
                                <button
                                    onClick={handleSignOut}
                                    className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">{t.profileMenu.signOut}</span>
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Profile Modal */}
                            <ProfileModal
                                isOpen={isProfileModalOpen}
                                onClose={() => setIsProfileModalOpen(false)}
                            />

            {/* AI Settings Modal */}
            <AISettingsModal
                isOpen={isAISettingsModalOpen}
                onClose={() => setIsAISettingsModalOpen(false)}
            />

            {/* Credit Purchase Modal */}
            <CreditPurchaseModal
                isOpen={isCreditModalOpen}
                onClose={() => setIsCreditModalOpen(false)}
            />
        </div>
    );
}
