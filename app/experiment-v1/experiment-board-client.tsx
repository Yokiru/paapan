"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { setExperimentMode } from '@/lib/experimentMode';

const CanvasWrapper = dynamic(
    () => import('@/components/canvas/CanvasWrapper'),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                    <span className="text-sm text-gray-500">Loading experiment...</span>
                </div>
            </div>
        ),
    }
);

const Toolbar = dynamic(() => import('@/components/ui/Toolbar'), { ssr: false });
const SearchBar = dynamic(() => import('@/components/ui/SearchBar'), { ssr: false });
const FavoritesBubble = dynamic(() => import('@/components/ui/FavoritesBubble'), { ssr: false });
const Sidebar = dynamic(() => import('@/components/ui/Sidebar'), { ssr: false });
const PenSettings = dynamic(() => import('@/components/ui/PenSettings'), { ssr: false });

export default function ExperimentBoardClient() {
    const { t } = useTranslation();
    const [isReady, setIsReady] = useState(false);
    const { setSidebarOpen, isLoaded, loadWorkspaces } = useWorkspaceStore();
    const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

    const activeWorkspace = useWorkspaceStore((state) => {
        const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
        return workspace;
    });

    const initialViewport = activeWorkspace?.viewport || { x: 0, y: 0, zoom: 1 };

    useEffect(() => {
        let cancelled = false;

        setExperimentMode({
            enabled: true,
            storageNamespace: 'experiment-v1',
            localOnly: true,
            unlimitedBoards: true,
            unlimitedCanvas: true,
            unlimitedAI: true,
            hideAuthUi: true,
        });

        const bootstrap = async () => {
            useWorkspaceStore.setState({
                userId: null,
                isLoaded: false,
            });

            await loadWorkspaces();

            if (!cancelled) {
                setIsReady(true);
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
            setExperimentMode(null);
        };
    }, [loadWorkspaces]);

    return (
        <main className="h-screen w-screen overflow-hidden bg-white">
            {isReady && <Sidebar />}

            <button
                className="group fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white/98 shadow-[0_4px_20px_rgb(0,0,0,0.08)] backdrop-blur-xl transition-colors hover:bg-gray-50"
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

            {isReady && <Toolbar />}

            {isReady && (
                <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (typeof window === 'undefined') return;
                            window.dispatchEvent(new Event('toolbar:toggle-export-panel'));
                        }}
                        className="flex h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                        title={t.canvas.export}
                    >
                        <span>{t.canvas.export}</span>
                    </button>
                    <FavoritesBubble />
                    <SearchBar />
                </div>
            )}

            {isReady && <PenSettings />}

            <div className="h-full w-full">
                {isReady && isLoaded ? (
                    <CanvasWrapper key={activeWorkspaceId || 'experiment-workspace'} initialViewport={initialViewport} />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
                            <span className="text-sm text-gray-500">Loading experiment board...</span>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
