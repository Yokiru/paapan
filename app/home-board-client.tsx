"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserOnboardingState } from '@/lib/userOnboarding';
import ShareBoardModal from '@/components/ui/ShareBoardModal';

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

export default function HomeBoardClient() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setSidebarOpen, isLoaded, loadWorkspaces } = useWorkspaceStore();
  const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [shareAnchorRect, setShareAnchorRect] = React.useState<DOMRect | null>(null);
  const shareButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const activeWorkspace = useWorkspaceStore(state => {
    const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    return ws;
  });

  const initialViewport = activeWorkspace?.viewport || { x: 0, y: 0, zoom: 1 };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const next = params.get('next') || '/';
        window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
        return;
      }
    }

    let cancelled = false;

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const onboarding = await getUserOnboardingState(supabase);
        if (!cancelled && onboarding?.needsOnboarding) {
          router.replace('/welcome');
          return;
        }
      }

      if (!cancelled) {
        await loadWorkspaces();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadWorkspaces, router]);

  useEffect(() => {
    let active = true;

    const syncAuthState = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active) {
        setIsAuthenticated(Boolean(session?.user));
      }
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      <Sidebar />

      <button
        className="group fixed top-4 left-4 z-40 w-10 h-10 rounded-xl bg-white/98 backdrop-blur-xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.08)] flex items-center justify-center hover:bg-gray-50 transition-colors"
        onClick={() => setSidebarOpen(true)}
        title={t.mainPage.openSidebar}
      >
        <Image
          src="/icons/sidebar/sidebar-open.svg"
          alt="Open Sidebar"
          width={20}
          height={20}
          className="opacity-80 transition-opacity duration-200 group-hover:opacity-100"
        />
      </button>

      <Toolbar />

      <ShareBoardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        workspaceId={activeWorkspaceId}
        workspaceName={activeWorkspace?.name}
        anchorRect={shareAnchorRect}
      />

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          ref={shareButtonRef}
          type="button"
          onClick={() => {
            if (isAuthenticated === false) {
              router.push('/login');
              return;
            }

            setShareAnchorRect(shareButtonRef.current?.getBoundingClientRect() ?? null);
            setIsShareModalOpen(true);
          }}
          disabled={!activeWorkspaceId}
          className="flex h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          title={isAuthenticated === false ? 'Sign in to share' : t.canvas.export}
        >
          <span>{isAuthenticated === false ? 'Sign in to share' : t.canvas.export}</span>
        </button>
        <FavoritesBubble />
        <SearchBar />
      </div>

      <PenSettings />

      <div className="w-full h-full">
        {isLoaded ? (
          <CanvasWrapper key={activeWorkspaceId || 'no-workspace'} initialViewport={initialViewport} />
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
