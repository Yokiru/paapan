"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useTranslation } from '@/lib/i18n';

// Dynamically import components with no SSR to avoid hydration issues
const CanvasWrapper = dynamic(
  () => import('@/components/canvas/CanvasWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading board...</span>
        </div>
      </div>
    )
  }
);

const Toolbar = dynamic(
  () => import('@/components/ui/Toolbar'),
  { ssr: false }
);

const SearchBar = dynamic(
  () => import('@/components/ui/SearchBar'),
  { ssr: false }
);

const FavoritesBubble = dynamic(
  () => import('@/components/ui/FavoritesBubble'),
  { ssr: false }
);

const Sidebar = dynamic(
  () => import('@/components/ui/Sidebar'),
  { ssr: false }
);

const PenSettings = dynamic(
  () => import('@/components/ui/PenSettings'),
  { ssr: false }
);

/**
 * Main Page Component
 */
export default function Home() {
  const { t } = useTranslation();
  const { setSidebarOpen, isLoaded, loadWorkspaces } = useWorkspaceStore();

  // Get active workspace from store (will have correct viewport after loadWorkspaces completes)
  const activeWorkspace = useWorkspaceStore(state => {
    const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    return ws;
  });

  // Compute initialViewport from loaded workspace data
  // This is the correct viewport from Supabase (for cloud users) or localStorage (for guests)
  const initialViewport = activeWorkspace?.viewport || { x: 0, y: 0, zoom: 1 };

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      <Sidebar />

      <button
        className="group fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-white/98 backdrop-blur-xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center hover:bg-gray-50 transition-colors"
        onClick={() => setSidebarOpen(true)}
        title={t.mainPage.openSidebar}
      >
        <img
          src="/icons/sidebar/sidebar-open.svg"
          alt="Open Sidebar"
          width={20}
          height={20}
          className="opacity-80 transition-opacity duration-200 group-hover:opacity-100"
        />
      </button>

      <Toolbar />

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <FavoritesBubble />
        <SearchBar />
      </div>

      <PenSettings />

      <div className="w-full h-full">
        {isLoaded ? (
          <CanvasWrapper initialViewport={initialViewport} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm text-gray-500">{t.mainPage.loadingBoard}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
