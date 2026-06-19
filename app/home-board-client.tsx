"use client";

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { useMindStore } from '@/store/useMindStore';
import { useTranslation } from '@/lib/i18n';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserOnboardingState } from '@/lib/userOnboarding';
import ShareBoardModal from '@/components/ui/ShareBoardModal';
import type { Edge } from 'reactflow';
import type { ArrowShape, CanvasNodeType, DrawingStroke, FrameRegion, Workspace, WorkspaceShareAccessRole } from '@/types';

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

const SHARED_ACCESS_REVOKED_ERROR = 'SHARED_ACCESS_REVOKED';

type SharedBoardPayload = {
  boardId: string;
  name: string;
  nodes: CanvasNodeType[];
  edges: Edge[];
  frames: FrameRegion[];
  strokes: DrawingStroke[];
  arrows: ArrowShape[];
  updatedAt: string;
  shareUpdatedAt?: string | null;
  accessRole: WorkspaceShareAccessRole;
  allowDuplicate: boolean;
};

interface HomeBoardClientProps {
  sharedToken?: string;
  workspaceId?: string;
}

function SharedAccessRevokedScreen() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-6">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(37, 99, 235, 0.12) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Board ini sudah privat</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Minta pemilik board untuk membuka akses lagi.
        </p>
      </div>
    </div>
  );
}

const normalizeSharedFrames = (frames: FrameRegion[] = []) => (
  frames.map((frame) => ({
    ...frame,
    createdAt: frame.createdAt ? new Date(frame.createdAt) : new Date(),
    updatedAt: frame.updatedAt ? new Date(frame.updatedAt) : new Date(),
  }))
);

const MOUNTED_SHARED_BOARDS_STORAGE_KEY = 'paapan:mounted-shared-boards';

const readMountedSharedWorkspaces = (): Workspace[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(MOUNTED_SHARED_BOARDS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((workspace): workspace is Workspace => (
        workspace &&
        typeof workspace === 'object' &&
        typeof workspace.id === 'string' &&
        workspace.shareVisibility === 'link_view'
      ))
      .map((workspace) => ({
        ...workspace,
        createdAt: workspace.createdAt ? new Date(workspace.createdAt) : new Date(),
        updatedAt: workspace.updatedAt ? new Date(workspace.updatedAt) : new Date(),
        frames: normalizeSharedFrames(workspace.frames || []),
        allowPublicDuplicate: workspace.allowPublicDuplicate === true,
        shareUpdatedAt: workspace.shareUpdatedAt ? new Date(workspace.shareUpdatedAt) : null,
      }));
  } catch {
    return [];
  }
};

const rememberMountedSharedWorkspace = (workspace: Workspace) => {
  if (typeof window === 'undefined') return;

  const existing = readMountedSharedWorkspaces();
  const next = [
    workspace,
    ...existing.filter((item) => item.id !== workspace.id),
  ].slice(0, 8);

  window.sessionStorage.setItem(MOUNTED_SHARED_BOARDS_STORAGE_KEY, JSON.stringify(next));
};

const mergeMountedSharedWorkspaces = () => {
  const mountedSharedWorkspaces = readMountedSharedWorkspaces();
  if (mountedSharedWorkspaces.length === 0) return;

  useWorkspaceStore.setState((state) => ({
    workspaces: [
      ...mountedSharedWorkspaces.filter((sharedWorkspace) => (
        !state.workspaces.some((workspace) => workspace.id === sharedWorkspace.id)
      )),
      ...state.workspaces,
    ],
  }));
};

const createMountedSharedWorkspace = (
  board: SharedBoardPayload,
  workspaceId: string,
  options: { shareToken?: string; isExternalShare?: boolean } = {}
): Workspace => {
  const frames = normalizeSharedFrames(board.frames || []);
  const updatedAt = board.updatedAt ? new Date(board.updatedAt) : new Date();

  return {
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
    shareToken: options.shareToken,
    isExternalShare: options.isExternalShare,
    allowPublicDuplicate: board.allowDuplicate === true,
    shareUpdatedAt: board.shareUpdatedAt ? new Date(board.shareUpdatedAt) : null,
  };
};

const fetchPublicBoardWithAuth = async (path: string) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(path, {
    cache: 'no-store',
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
};

const applySharedBoardToMindStore = (board: SharedBoardPayload) => {
  const frames = normalizeSharedFrames(board.frames || []);

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
};

export default function HomeBoardClient({ sharedToken, workspaceId: routeWorkspaceId }: HomeBoardClientProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { setSidebarOpen, isLoaded, loadWorkspaces, promoteLocalWorkspaceToCloud } = useWorkspaceStore();
  const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const isLegacySharedRoute = Boolean(sharedToken) || pathname.startsWith('/b/');
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [sharedAccessRole, setSharedAccessRole] = React.useState<WorkspaceShareAccessRole>('viewer');
  const [sharedBoardId, setSharedBoardId] = React.useState<string | null>(null);
  const [sharedLoadError, setSharedLoadError] = React.useState<string | null>(null);
  const [shareAnchorRect, setShareAnchorRect] = React.useState<DOMRect | null>(null);
  const [isDuplicatingSharedBoard, setIsDuplicatingSharedBoard] = React.useState(false);
  const shareButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const handleCloseShareModal = React.useCallback(() => {
    setIsShareModalOpen(false);
  }, []);
  const handleSharedAccessRevoked = React.useCallback(() => {
    setSharedLoadError(SHARED_ACCESS_REVOKED_ERROR);
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

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const signedInUserId = session?.user?.id ?? null;
          useWorkspaceStore.setState({ isLoaded: false, isLoading: !signedInUserId });

          const response = await fetchPublicBoardWithAuth(`/api/public/board/${sharedToken}`);
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(typeof payload?.error === 'string' ? payload.error : 'Board tidak tersedia');
          }

          if (cancelled) return;

          const board = payload.board as SharedBoardPayload;
          const workspaceId = board.boardId || `shared-${sharedToken.slice(0, 18)}`;
          const sharedWorkspace = createMountedSharedWorkspace(board, workspaceId, {
            shareToken: sharedToken,
            isExternalShare: true,
          });
          rememberMountedSharedWorkspace(sharedWorkspace);

          let userWorkspaces = useWorkspaceStore.getState().workspaces;
          if (signedInUserId) {
            useWorkspaceStore.setState({ userId: signedInUserId, isLoading: false });
            await loadWorkspaces();
            if (cancelled) return;
            userWorkspaces = useWorkspaceStore.getState().workspaces;
          }

          applySharedBoardToMindStore(board);

          useWorkspaceStore.setState({
            workspaces: [
              sharedWorkspace,
              ...userWorkspaces.filter((workspace) => workspace.id !== workspaceId),
            ],
            activeWorkspaceId: workspaceId,
            isLoaded: true,
            isLoading: false,
          });

          setSharedAccessRole('viewer');
          setSharedBoardId(board.boardId || workspaceId);
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

    const loadPublicBoardById = async (workspaceId: string, signedInUserId: string | null) => {
      try {
        useWorkspaceStore.setState({ isLoaded: false, isLoading: !signedInUserId });

        const response = await fetchPublicBoardWithAuth(`/api/public/board-by-id/${workspaceId}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          useWorkspaceStore.setState({ isLoaded: true, isLoading: false });
          return false;
        }

        if (cancelled) return true;

        const board = payload.board as SharedBoardPayload;
        const sharedWorkspace = createMountedSharedWorkspace(board, workspaceId, {
          isExternalShare: true,
        });
        rememberMountedSharedWorkspace(sharedWorkspace);

        let userWorkspaces = useWorkspaceStore.getState().workspaces;
        if (signedInUserId) {
          useWorkspaceStore.setState({ userId: signedInUserId, isLoading: false });
          await loadWorkspaces();
          if (cancelled) return true;
          userWorkspaces = useWorkspaceStore.getState().workspaces;
        }

        applySharedBoardToMindStore(board);

        useWorkspaceStore.setState({
          workspaces: [
            sharedWorkspace,
            ...userWorkspaces.filter((workspace) => workspace.id !== workspaceId),
          ],
          activeWorkspaceId: workspaceId,
          isLoaded: true,
          isLoading: false,
        });

        setSharedAccessRole('viewer');
        setSharedBoardId(board.boardId || workspaceId);
        return true;
      } catch (error) {
        console.error('Failed to load public board by id:', error);
        useWorkspaceStore.setState({ isLoaded: true, isLoading: false });
        return false;
      }
    };

    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const signedInUserId = session?.user?.id ?? null;
      let promotedWorkspaceId: string | null = null;

      if (session?.user) {
        useWorkspaceStore.setState({ userId: session.user.id });
        if (routeWorkspaceId || pathname === '/') {
          promotedWorkspaceId = await promoteLocalWorkspaceToCloud(routeWorkspaceId);
          if (cancelled) return;
        }

        const onboarding = await getUserOnboardingState(supabase);
        if (!cancelled && onboarding?.needsOnboarding) {
          router.replace('/welcome');
          return;
        }
      } else if (routeWorkspaceId) {
        await loadWorkspaces();
        if (cancelled) return;

        const targetLocalWorkspace = useWorkspaceStore.getState().workspaces.find((workspace) => workspace.id === routeWorkspaceId);
        if (targetLocalWorkspace && !targetLocalWorkspace.isExternalShare) {
          await useWorkspaceStore.getState().switchWorkspace(routeWorkspaceId);
          return;
        }

        const loadedPublicBoard = await loadPublicBoardById(routeWorkspaceId, null);
        if (!loadedPublicBoard && !cancelled) {
          router.replace(`/login?next=${encodeURIComponent(`/board/${routeWorkspaceId}`)}`);
        }
        return;
      }

      if (!cancelled) {
        await loadWorkspaces();
        mergeMountedSharedWorkspaces();
        const targetRouteWorkspaceId = promotedWorkspaceId || routeWorkspaceId;

        if (targetRouteWorkspaceId) {
          const targetWorkspace = useWorkspaceStore.getState().workspaces.find((workspace) => workspace.id === targetRouteWorkspaceId);
          if (targetWorkspace) {
            if (routeWorkspaceId && (targetWorkspace.shareToken || targetWorkspace.isExternalShare)) {
              const loadedPublicBoard = await loadPublicBoardById(routeWorkspaceId, signedInUserId);
              if (loadedPublicBoard || cancelled) return;
            }

            await useWorkspaceStore.getState().switchWorkspace(targetRouteWorkspaceId);
            if (promotedWorkspaceId && promotedWorkspaceId !== routeWorkspaceId) {
              router.replace(`/board/${promotedWorkspaceId}`);
            }
            if (targetWorkspace.shareToken || targetWorkspace.isExternalShare) {
              setSharedAccessRole('viewer');
              setSharedBoardId(targetWorkspace.id);
            } else {
              setSharedAccessRole('viewer');
              setSharedBoardId(null);
            }
          } else {
            const loadedPublicBoard = routeWorkspaceId
              ? await loadPublicBoardById(routeWorkspaceId, signedInUserId)
              : false;
            if (!loadedPublicBoard && !cancelled) {
              router.replace('/');
            }
          }
        } else if (pathname === '/') {
          const activeId = useWorkspaceStore.getState().activeWorkspaceId;
          if (signedInUserId && activeId) {
            router.replace(`/board/${activeId}`);
          }
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadWorkspaces, pathname, promoteLocalWorkspaceToCloud, routeWorkspaceId, router, sharedToken]);

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

  const activeWorkspaceIsShared = Boolean(
    activeWorkspace?.isExternalShare ||
    isLegacySharedRoute ||
    (routeWorkspaceId && sharedBoardId === routeWorkspaceId)
  );
  const isSharedBoard = activeWorkspaceIsShared;
  const shouldShowSidebar = !isSharedBoard || isAuthenticated === true;
  const isSharedSidebarMode = isSharedBoard && isAuthenticated === true;
  const canvasAccessMode = activeWorkspaceIsShared ? sharedAccessRole : 'owner';
  const canvasSharedToken = activeWorkspaceIsShared ? (activeWorkspace?.shareToken || sharedToken) : undefined;
  const canvasSharedBoardId = activeWorkspace?.isExternalShare ? activeWorkspace.id : undefined;
  const canDuplicateSharedBoard = isSharedBoard && activeWorkspace?.allowPublicDuplicate === true;
  const isSharedAccessRevoked = sharedLoadError === SHARED_ACCESS_REVOKED_ERROR;
  const shouldShowCanvasChrome = !isSharedAccessRevoked;
  const openDuplicateSignIn = React.useCallback(() => {
    const nextPath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : '/';
    window.open(
      `/login?next=${encodeURIComponent(nextPath)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, []);

  const handleDuplicateSharedBoard = React.useCallback(async () => {
    if (!activeWorkspace || !isSharedBoard || isDuplicatingSharedBoard) return;
    if (activeWorkspace.allowPublicDuplicate !== true) return;

    if (isAuthenticated === false) {
      openDuplicateSignIn();
      return;
    }

    if (isAuthenticated !== true) return;

    setIsDuplicatingSharedBoard(true);

    try {
      const source = JSON.parse(JSON.stringify(activeWorkspace)) as Workspace;
      const duplicateName = `${source.name || 'Shared board'} copy`;
      const newWorkspaceId = await useWorkspaceStore.getState().createWorkspace(duplicateName);
      if (!newWorkspaceId) {
        setSharedLoadError('Tidak bisa membuat board baru. Cek limit workspace paket Anda.');
        return;
      }

      const duplicatedWorkspace: Workspace = {
        ...source,
        id: newWorkspaceId,
        name: duplicateName,
        createdAt: new Date(),
        updatedAt: new Date(),
        shareVisibility: 'private',
        shareAccessRole: 'viewer',
        shareToken: undefined,
        isExternalShare: false,
        allowPublicDuplicate: true,
        sharedAt: null,
        shareUpdatedAt: null,
        frames: normalizeSharedFrames(source.frames || []),
      };

      useWorkspaceStore.setState((state) => ({
        workspaces: state.workspaces.map((workspace) => (
          workspace.id === newWorkspaceId ? duplicatedWorkspace : workspace
        )),
        activeWorkspaceId: newWorkspaceId,
      }));

      applySharedBoardToMindStore({
        boardId: newWorkspaceId,
        name: duplicatedWorkspace.name,
        nodes: duplicatedWorkspace.nodes,
        edges: duplicatedWorkspace.edges,
        frames: duplicatedWorkspace.frames,
        strokes: duplicatedWorkspace.strokes,
        arrows: duplicatedWorkspace.arrows,
        updatedAt: duplicatedWorkspace.updatedAt.toISOString(),
        accessRole: 'viewer',
        allowDuplicate: true,
      });

      setSharedAccessRole('viewer');
      setSharedBoardId(null);
      await useWorkspaceStore.getState().saveCurrentWorkspace(true);
      router.replace(`/board/${newWorkspaceId}`);
    } catch (error) {
      console.error('Failed to duplicate shared board:', error);
      setSharedLoadError('Gagal menduplikasi board. Coba lagi sebentar lagi.');
    } finally {
      setIsDuplicatingSharedBoard(false);
    }
  }, [activeWorkspace, isSharedBoard, isAuthenticated, isDuplicatingSharedBoard, openDuplicateSignIn, router]);

  if (isLoaded && isSharedAccessRevoked && isAuthenticated !== true) {
    return (
      <main className="h-screen w-screen overflow-hidden bg-white">
        <SharedAccessRevokedScreen />
      </main>
    );
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-white">
      {shouldShowSidebar && <Sidebar sharedMode={isSharedSidebarMode} />}

      {shouldShowSidebar && (
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

      {shouldShowCanvasChrome && <Toolbar accessMode={canvasAccessMode} />}

      {!isSharedBoard && (
        <ShareBoardModal
          isOpen={isShareModalOpen}
          onClose={handleCloseShareModal}
          workspaceId={activeWorkspaceId}
          workspaceName={activeWorkspace?.name}
          anchorRect={shareAnchorRect}
        />
      )}

      {shouldShowCanvasChrome && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          {activeWorkspaceIsShared && (
            <div className="rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm backdrop-blur-xl">
              View only
            </div>
          )}
          {isSharedBoard && canDuplicateSharedBoard ? (
            <button
              ref={shareButtonRef}
              type="button"
              onClick={() => {
                if (isAuthenticated === false) {
                  openDuplicateSignIn();
                  return;
                }

                void handleDuplicateSharedBoard();
              }}
              disabled={isDuplicatingSharedBoard}
              className="flex h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              title={isAuthenticated === false ? 'Sign in to duplicate' : 'Duplicate board'}
            >
              <span>
                {isAuthenticated === false
                  ? 'Sign in to duplicate'
                  : isDuplicatingSharedBoard
                    ? 'Duplicating...'
                    : 'Duplicate'}
              </span>
            </button>
          ) : !isSharedBoard ? (
            <button
              ref={shareButtonRef}
              type="button"
              onClick={() => {
                setShareAnchorRect(shareButtonRef.current?.getBoundingClientRect() ?? null);
                setIsShareModalOpen(true);
              }}
              disabled={!isSharedBoard && !activeWorkspaceId}
              className="flex h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              title={t.canvas.export}
            >
              <span>{t.canvas.export}</span>
            </button>
          ) : null}
          <FavoritesBubble />
          <SearchBar />
        </div>
      )}

      {shouldShowCanvasChrome && <PenSettings />}

      <div className="w-full h-full">
        {isLoaded ? (
          sharedLoadError ? (
            isSharedAccessRevoked ? (
              <SharedAccessRevokedScreen />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm text-rose-800">
                  {sharedLoadError}
                </div>
              </div>
            )
          ) : (
            <CanvasWrapper
              key={activeWorkspaceId || 'no-workspace'}
              initialViewport={initialViewport}
              accessMode={canvasAccessMode}
              sharedToken={canvasSharedToken}
              sharedBoardId={canvasSharedBoardId}
              onSharedAccessRevoked={handleSharedAccessRevoked}
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
