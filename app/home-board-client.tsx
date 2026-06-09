"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useMindStore } from '@/store/useMindStore';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserOnboardingState } from '@/lib/userOnboarding';
import ShareBoardModal from '@/components/ui/ShareBoardModal';
import type { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion, WorkspaceShareAccessRole } from '@/types';

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

type SharedBoardPayload = {
  name: string;
  nodes: CanvasNodeType[];
  edges: any[];
  frames: FrameRegion[];
  strokes: DrawingStroke[];
  arrows: ArrowShape[];
  updatedAt: string;
  accessRole: WorkspaceShareAccessRole;
};

interface HomeBoardClientProps {
  sharedToken?: string;
}

const normalizeSharedFrames = (frames: FrameRegion[] = []) => (
  frames.map((frame) => ({
    ...frame,
    createdAt: frame.createdAt ? new Date(frame.createdAt) : new Date(),
    updatedAt: frame.updatedAt ? new Date(frame.updatedAt) : new Date(),
  }))
);

export default function HomeBoardClient({ sharedToken }: HomeBoardClientProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { setSidebarOpen, isLoaded, loadWorkspaces } = useWorkspaceStore();
  const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const isSharedBoard = Boolean(sharedToken);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [sharedAccessRole, setSharedAccessRole] = React.useState<WorkspaceShareAccessRole>('viewer');
  const [sharedLoadError, setSharedLoadError] = React.useState<string | null>(null);
  const [shareAnchorRect, setShareAnchorRect] = React.useState<DOMRect | null>(null);
  const shareButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const handleCloseShareModal = React.useCallback(() => {
    setIsShareModalOpen(false);
  }, []);

  const activeWorkspace = useWorkspaceStore(state => {
    const ws = state.workspaces.find(w => w.id === state.activeWorkspaceId);
    return ws;
  });

  const initialViewport = activeWorkspace?.viewport || { x: 0, y: 0, zoom: 1 };

  useEffect(() => {
    if (sharedToken) {
      let cancelled = false;

      const loadSharedBoard = async () => {
        setSharedLoadError(null);
        useWorkspaceStore.setState({ isLoaded: false, isLoading: true });

        try {
          const response = await fetch(`/api/public/board/${sharedToken}`);
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(typeof payload?.error === 'string' ? payload.error : 'Board tidak tersedia');
          }

          if (cancelled) return;

          const board = payload.board as SharedBoardPayload;
          const workspaceId = `shared-${sharedToken.slice(0, 18)}`;
          const frames = normalizeSharedFrames(board.frames || []);
          const updatedAt = board.updatedAt ? new Date(board.updatedAt) : new Date();

          useMindStore.setState({
            nodes: board.nodes || [],
            edges: board.edges || [],
            frames,
            selectedFrameId: null,
            strokes: board.strokes || [],
            arrows: board.arrows || [],
            strokeHistory: [],
            strokeFuture: [],
            pendingViewport: { x: 0, y: 0, zoom: 1 },
          });

          useWorkspaceStore.setState({
            workspaces: [{
              id: workspaceId,
              name: board.name || 'Shared board',
              nodes: board.nodes || [],
              edges: board.edges || [],
              frames,
              strokes: board.strokes || [],
              arrows: board.arrows || [],
              viewport: { x: 0, y: 0, zoom: 1 },
              createdAt: updatedAt,
              updatedAt,
              shareVisibility: 'link_view',
              shareAccessRole: board.accessRole === 'editor' ? 'editor' : 'viewer',
            }],
            activeWorkspaceId: workspaceId,
            isLoaded: true,
            isLoading: false,
          });

          setSharedAccessRole(board.accessRole === 'editor' ? 'editor' : 'viewer');
        } catch (error) {
          if (cancelled) return;
          setSharedLoadError(error instanceof Error ? error.message : 'Board tidak tersedia');
          useWorkspaceStore.setState({ isLoaded: true, isLoading: false });
        }
      };

      void loadSharedBoard();

      return () => {
        cancelled = true;
      };
    }

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
  }, [loadWorkspaces, router, sharedToken]);

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
      {!isSharedBoard && <Sidebar />}

      {!isSharedBoard && (
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
      )}

      <Toolbar accessMode={isSharedBoard ? sharedAccessRole : 'owner'} />

      {!isSharedBoard && (
        <ShareBoardModal
          isOpen={isShareModalOpen}
          onClose={handleCloseShareModal}
          workspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace?.name}
          anchorRect={shareAnchorRect}
        />
      )}

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {!isSharedBoard && (
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
        )}
        <FavoritesBubble />
        <SearchBar />
      </div>

      <PenSettings />

      <div className="w-full h-full">
        {isLoaded ? (
          sharedLoadError ? (
            <div className="flex h-full w-full items-center justify-center bg-white">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm text-rose-800">
                {sharedLoadError}
              </div>
            </div>
          ) : (
            <CanvasWrapper
              key={activeWorkspaceId || 'no-workspace'}
              initialViewport={initialViewport}
              accessMode={isSharedBoard ? sharedAccessRole : 'owner'}
              sharedToken={sharedToken}
            />
          )
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
