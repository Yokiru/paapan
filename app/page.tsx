"use client";

import dynamic from 'next/dynamic';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

// Dynamically import components with no SSR to avoid hydration issues
const CanvasWrapper = dynamic(
  () => import('@/components/canvas/CanvasWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading workspace...</span>
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

/**
 * Main Page Component
 * Renders the Spatial AI Workspace with:
 * - Sidebar for workspace history
 * - Toolbar for mode selection (Hand/Select/Add)
 * - SearchBar for finding nodes
 * - FavoritesBubble for filtering favorites
 * - Infinite canvas with React Flow
 */
export default function Home() {
  const { setSidebarOpen } = useWorkspaceStore();

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Sidebar Toggle Button */}
      <button
        className="fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-white/98 backdrop-blur-xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center hover:bg-gray-50 transition-colors"
        onClick={() => setSidebarOpen(true)}
        title="Open sidebar"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Floating toolbar at bottom */}
      <Toolbar />

      {/* Top right UI: Favorites + Search */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <FavoritesBubble />
        <SearchBar />
      </div>

      {/* Main canvas area */}
      <div className="w-full h-full">
        <CanvasWrapper />
      </div>
    </main>
  );
}
