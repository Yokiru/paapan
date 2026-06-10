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
  boardId: string;
  name: string;
  nodes: CanvasNodeType[];
  edges: any[];
  frames: FrameRegion[];
  strokes: DrawingStroke[];
  arrows: ArrowShape[];
  updatedAt: string;
  accessRole: WorkspaceShareAccessRole;
};

type PresenceUser = {
  id: string;
  name: string;
  initials: string;
  color: string;
  isCurrentUser?: boolean;
  role?: WorkspaceShareAccessRole | 'owner';
};

interface HomeBoardClientProps {
  sharedToken?: string;
}

const presenceColors = ['bg-pink-500', 'bg-red-500', 'bg-slate-400', 'bg-blue-500', 'bg-emerald-500', 'bg-violet-500'];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getPresenceColor = (value: string, offset = 0) => {
  const seed = value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return presenceColors[(seed + offset) % presenceColors.length];
};

function PresenceMenu({ users }: { users: PresenceUser[] }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const visibleUsers = users.slice(0, 3);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (users.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex h-10 items-center -space-x-2 rounded-xl px-1 transition-colors hover:bg-white/70"
        aria-label="Board participants"
      >
        {visibleUsers.map((user) => (
          <span
            key={user.id}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm ${user.color}`}
            title={user.name}
          >
            {user.initials}
          </span>
        ))}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.18)]">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <span className={`h-5 w-5 rounded-full ${user.color}`} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                {user.name}
                {user.isCurrentUser ? <span className="ml-1 text-slate-500">(Anda)</span> : null}
              </p>
              {!user.isCurrentUser && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-500">
                  {user.role === 'editor' ? 'Editor' : user.role === 'viewer' ? 'Viewer' : 'Owner'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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

export default function HomeBoardClient({ sharedToken }: HomeBoardClientProps = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { setSidebarOpen, isLoaded, loadWorkspaces } = useWorkspaceStore();
  const activeWorkspaceId = useWorkspaceStore(state => state.activeWorkspaceId);
  const isSharedBoard = Boolean(sharedToken) || pathname.startsWith('/b/');
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const [currentUserName, setCurrentUserName] = React.useState('Pengguna baru');
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [clientPresenceId] = React.useState(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
  const [sharedAccessRole, setSharedAccessRole] = React.useState<WorkspaceShareAccessRole>('viewer');
  const [sharedBoardId, setSharedBoardId] = React.useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = React.useState<PresenceUser[]>([]);
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

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const signedInUserId = session?.user?.id ?? null;
          useWorkspaceStore.setState({ isLoaded: false, isLoading: !signedInUserId });

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
          const sharedWorkspace = {
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
            shareVisibility: 'link_view' as const,
            shareAccessRole: board.accessRole === 'editor' ? 'editor' as const : 'viewer' as const,
          };

          let userWorkspaces = useWorkspaceStore.getState().workspaces;
          if (signedInUserId) {
            useWorkspaceStore.setState({ userId: signedInUserId, isLoading: false });
            await loadWorkspaces();
            if (cancelled) return;
            userWorkspaces = useWorkspaceStore.getState().workspaces;
          }

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
            workspaces: [
              sharedWorkspace,
              ...userWorkspaces.filter((workspace) => workspace.id !== workspaceId),
            ],
            activeWorkspaceId: workspaceId,
            isLoaded: true,
            isLoading: false,
          });

          setSharedAccessRole(board.accessRole === 'editor' ? 'editor' : 'viewer');
          setSharedBoardId(board.boardId || null);
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
        setCurrentUserId(session?.user?.id ?? null);
        setCurrentUserName(
          session?.user?.user_metadata?.full_name
          || session?.user?.email?.split('@')[0]
          || 'Pengguna baru'
        );
      }
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      setCurrentUserId(session?.user?.id ?? null);
      setCurrentUserName(
        session?.user?.user_metadata?.full_name
        || session?.user?.email?.split('@')[0]
        || 'Pengguna baru'
      );
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const presenceChannelId = isSharedBoard ? sharedBoardId : activeWorkspaceId;
  const selfPresenceUser = React.useMemo<PresenceUser>(() => {
    const selfName = isAuthenticated ? currentUserName : 'Pengguna baru';
    const role = isSharedBoard ? sharedAccessRole : 'owner';
    return {
      id: currentUserId || clientPresenceId,
      name: selfName,
      initials: getInitials(selfName),
      color: isSharedBoard ? 'bg-pink-500' : getPresenceColor(selfName, 0),
      isCurrentUser: true,
      role,
    };
  }, [clientPresenceId, currentUserId, currentUserName, isAuthenticated, isSharedBoard, sharedAccessRole]);

  React.useEffect(() => {
    if (!presenceChannelId) {
      setOnlineUsers([]);
      return;
    }

    const channel = supabase.channel(`board-presence-${presenceChannelId}`, {
      config: {
        presence: {
          key: selfPresenceUser.id,
        },
      },
    });

    const readPresenceUsers = () => {
      const presenceState = channel.presenceState<PresenceUser>();
      const nextUsers = Object.values(presenceState)
        .flat()
        .map((presenceUser) => ({
          ...presenceUser,
          isCurrentUser: presenceUser.id === selfPresenceUser.id,
        }))
        .filter((presenceUser, index, array) => (
          array.findIndex((item) => item.id === presenceUser.id) === index
        ))
        .sort((left, right) => {
          if (left.isCurrentUser) return -1;
          if (right.isCurrentUser) return 1;
          if (left.role === 'owner') return -1;
          if (right.role === 'owner') return 1;
          return left.name.localeCompare(right.name);
        });

      setOnlineUsers(nextUsers);
    };

    channel
      .on('presence', { event: 'sync' }, readPresenceUsers)
      .on('presence', { event: 'join' }, readPresenceUsers)
      .on('presence', { event: 'leave' }, readPresenceUsers)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        await channel.track(selfPresenceUser);
      });

    return () => {
      setOnlineUsers([]);
      supabase.removeChannel(channel);
    };
  }, [presenceChannelId, selfPresenceUser]);

  const presenceUsers = React.useMemo<PresenceUser[]>(() => {
    if (onlineUsers.length > 0) {
      return onlineUsers;
    }

    return [selfPresenceUser];
  }, [onlineUsers, selfPresenceUser]);
  const hasCollaborators = presenceUsers.some((user) => !user.isCurrentUser);
  const shouldShowSidebar = !isSharedBoard || isAuthenticated === true;
  const isSharedSidebarMode = isSharedBoard && isAuthenticated === true;

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
        {isSharedBoard && (
          <div className="rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-500 shadow-sm backdrop-blur-xl">
            {sharedAccessRole === 'editor' ? 'Editor' : 'View only'}
          </div>
        )}
        {hasCollaborators && <PresenceMenu users={presenceUsers} />}
        {(!isSharedBoard || isAuthenticated === false) && (
          <button
            ref={shareButtonRef}
            type="button"
            onClick={() => {
              if (isAuthenticated === false) {
                const nextPath = typeof window !== 'undefined'
                  ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                  : '/';
                router.push(`/login?next=${encodeURIComponent(nextPath)}`);
                return;
              }

              setShareAnchorRect(shareButtonRef.current?.getBoundingClientRect() ?? null);
              setIsShareModalOpen(true);
            }}
            disabled={!isSharedBoard && !activeWorkspaceId}
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
