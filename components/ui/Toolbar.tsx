"use client";

import React from 'react';
import { useMindStore } from '@/store/useMindStore';
import { useTranslation } from '@/lib/i18n';
import { ToolMode } from '@/types';
import { useRouter } from 'next/navigation';
import { getImageNodeLimit } from '@/lib/creditCosts';
import { ImageUploadResult } from '@/types';
import { supabase } from '@/lib/supabase';
import { getToolbarTourCompleted, setToolbarTourCompleted, TOOLBAR_TOUR_STORAGE_KEY } from '@/lib/userOnboarding';

/**
 * Toolbar Component - Medium Size
 */
export default function Toolbar() {
    const router = useRouter();
    const { t } = useTranslation();
    const { tool, setTool, addRootNode, addImageNode, addTextNode, viewportCenter, nodes, edges, frames, strokes, arrows } = useMindStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);
    const [tourReady, setTourReady] = React.useState(false);
    const [tourDismissed, setTourDismissed] = React.useState(false);
    const [tourStep, setTourStep] = React.useState(0);
    const [activeMicroHelp, setActiveMicroHelp] = React.useState<{
        id: string;
        label: string;
        description: string;
        left: number;
        top: number;
    } | null>(null);

    const isWorkspaceEmpty = nodes.length === 0 && edges.length === 0 && frames.length === 0 && strokes.length === 0 && arrows.length === 0;

    const tourSteps = React.useMemo(() => ([
        {
            id: 'ai',
            title: 'Mulai dari AI',
            description: 'Klik tombol chat untuk membuat AI node pertama dan mulai mengembangkan ide dari sana.',
        },
        {
            id: 'media',
            title: 'Tambahkan isi',
            description: 'Gunakan gambar atau teks untuk mulai menuangkan isi board dengan cepat.',
        },
        {
            id: 'structure',
            title: 'Hubungkan dan kelompokkan',
            description: 'Pen, panah, dan frame membantu kamu menandai, menghubungkan, dan menyusun area canvas.',
        },
        {
            id: 'navigation',
            title: 'Pindah dan pilih',
            description: 'Hand untuk geser canvas, Select untuk memilih lalu mengatur elemen yang sudah ada.',
        },
    ]), []);

    const currentTourStep = tourSteps[tourStep] ?? null;
    const isTourVisible = tourReady && !tourDismissed && isWorkspaceEmpty && currentTourStep !== null;
    const shouldShowMicroHelp = tourReady && tourDismissed && !isTourVisible;

    const toolHints = React.useMemo(() => ({
        hand: {
            label: t.canvas.hand,
            description: 'Geser canvas dengan lebih bebas.',
        },
        select: {
            label: t.canvas.select,
            description: 'Pilih dan atur elemen di board.',
        },
        pen: {
            label: t.canvas.pen,
            description: 'Coret cepat untuk menandai ide.',
        },
        arrow: {
            label: 'Panah',
            description: 'Hubungkan node atau area penting.',
        },
        frame: {
            label: 'Frame',
            description: 'Kelompokkan area canvas jadi satu blok.',
        },
        image: {
            label: t.canvas.addImage,
            description: 'Tambah gambar ke board.',
        },
        text: {
            label: t.canvas.addText,
            description: 'Buat catatan teks biasa.',
        },
        ai: {
            label: t.canvas.addAIChat,
            description: 'Mulai chat AI baru dari sini.',
        },
    }), [t]);

    React.useEffect(() => {
        let cancelled = false;

        const loadTourState = async () => {
            if (typeof window === 'undefined') return;

            const localCompleted = window.localStorage.getItem(TOOLBAR_TOUR_STORAGE_KEY) === 'true';
            let completed = localCompleted;

            try {
                const remoteCompleted = await getToolbarTourCompleted(supabase);
                completed = localCompleted || remoteCompleted;

                if (remoteCompleted && !localCompleted) {
                    window.localStorage.setItem(TOOLBAR_TOUR_STORAGE_KEY, 'true');
                }
            } catch (error) {
                console.warn('[ToolbarTour] Failed to load remote state:', error);
            }

            if (!cancelled) {
                setTourDismissed(completed);
                setTourReady(true);
            }
        };

        void loadTourState();

        return () => {
            cancelled = true;
        };
    }, []);

    const showImageUploadFeedback = React.useCallback((result: ImageUploadResult) => {
        if (result === 'limit-reached') {
            setShowLimitAlert(true);
            setTimeout(() => setShowLimitAlert(false), 4000);
            return;
        }

        if (result === 'file-too-large') {
            setUploadNotice('Gambar terlalu besar. Maksimal 2 MB.');
            setTimeout(() => setUploadNotice(null), 4000);
            return;
        }

        if (result === 'storage-full') {
            setUploadNotice('Storage upload Anda sudah penuh. Hapus beberapa gambar untuk lanjut upload.');
            setTimeout(() => setUploadNotice(null), 4000);
            return;
        }

        if (result === 'upload-failed') {
            setUploadNotice('Gagal upload gambar. Coba lagi.');
            setTimeout(() => setUploadNotice(null), 4000);
        }
    }, []);

    const handleAddNode = () => {
        addRootNode(viewportCenter);
        setTool('select');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            void addImageNode(e.target.files[0], viewportCenter).then((result) => {
                if (result !== 'success') {
                    showImageUploadFeedback(result);
                }
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSetTool = (newTool: ToolMode) => setTool(newTool);

    const completeTour = React.useCallback(() => {
        setTourDismissed(true);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(TOOLBAR_TOUR_STORAGE_KEY, 'true');
        }

        void setToolbarTourCompleted(supabase, true).catch((error) => {
            console.warn('[ToolbarTour] Failed to save remote state:', error);
        });
    }, []);

    const nextTourStep = React.useCallback(() => {
        if (tourStep >= tourSteps.length - 1) {
            completeTour();
            return;
        }

        setTourStep((prev) => prev + 1);
    }, [completeTour, tourStep, tourSteps.length]);

    const btnBase = "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 ease-out active:scale-95";
    const toolbarIconBaseClass = "h-[21px] w-[21px] transition-all duration-200 ease-out";
    const activeIconFilter = "brightness(0) saturate(100%) invert(42%) sepia(95%) saturate(2121%) hue-rotate(210deg) brightness(101%) contrast(96%)";
    const idleIconFilter = "brightness(0) saturate(100%) opacity(0.82)";
    const hoverIconFilter = "brightness(0) saturate(100%) opacity(1)";

    const getToolButtonClass = (isActive: boolean, accent: 'blue' | 'indigo' = 'blue') => {
        if (isActive) {
            return `${btnBase} ${
                accent === 'indigo'
                    ? 'bg-indigo-50 ring-1 ring-indigo-200 shadow-[0_6px_18px_rgba(99,102,241,0.16)] -translate-y-[1px]'
                    : 'bg-blue-50 ring-1 ring-blue-200 shadow-[0_6px_18px_rgba(59,130,246,0.16)] -translate-y-[1px]'
            }`;
        }

        return `${btnBase} hover:bg-slate-50 hover:shadow-sm`;
    };

    const getIconStyle = (isActive: boolean): React.CSSProperties => ({
        filter: isActive ? activeIconFilter : idleIconFilter,
    });

    const getTourGroupClass = (groupId: string) => (
        isTourVisible && currentTourStep?.id === groupId
            ? 'rounded-xl bg-blue-50 ring-2 ring-blue-300 shadow-[0_14px_34px_rgba(59,130,246,0.18)]'
            : ''
    );

    const getTourMutedClass = (groupId: string) => (
        isTourVisible && currentTourStep?.id !== groupId
            ? 'opacity-60'
            : 'opacity-100 blur-0'
    );

    const openMicroHelp = React.useCallback((
        event: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>,
        hint: { label: string; description: string },
        id: string,
    ) => {
        if (!shouldShowMicroHelp) return;

        const rect = event.currentTarget.getBoundingClientRect();
        setActiveMicroHelp({
            id,
            label: hint.label,
            description: hint.description,
            left: rect.left + rect.width / 2,
            top: rect.top - 14,
        });
    }, [shouldShowMicroHelp]);

    const closeMicroHelp = React.useCallback(() => {
        setActiveMicroHelp(null);
    }, []);

    const bindMicroHelp = React.useCallback((key: keyof typeof toolHints) => ({
        onMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => openMicroHelp(event, toolHints[key], key),
        onMouseLeave: closeMicroHelp,
        onFocus: (event: React.FocusEvent<HTMLButtonElement>) => openMicroHelp(event, toolHints[key], key),
        onBlur: closeMicroHelp,
    }), [closeMicroHelp, openMicroHelp, toolHints]);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {uploadNotice && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm whitespace-nowrap">
                    <p className="text-sm text-blue-900">{uploadNotice}</p>
                </div>
            )}
            {isTourVisible && (
                <div className="absolute bottom-[calc(100%+16px)] left-1/2 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                                Toolbar Tour
                            </p>
                            <h3 className="mt-1 text-lg font-semibold text-slate-900">
                                {currentTourStep.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                {currentTourStep.description}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={completeTour}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                            Lewati
                        </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                            {tourSteps.map((step, index) => (
                                <span
                                    key={step.id}
                                    className={`h-1.5 rounded-full transition-all ${
                                        index === tourStep ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'
                                    }`}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={nextTourStep}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                        >
                            {tourStep === tourSteps.length - 1 ? 'Selesai' : 'Lanjut'}
                        </button>
                    </div>
                </div>
            )}
            {activeMicroHelp && (
                <div
                    className="pointer-events-none fixed z-[70] w-[220px] -translate-x-1/2 -translate-y-full rounded-2xl border border-slate-200/90 bg-white/96 px-3 py-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                    style={{
                        left: activeMicroHelp.left,
                        top: activeMicroHelp.top,
                    }}
                >
                    <p className="text-sm font-semibold text-slate-900">
                        {activeMicroHelp.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                        {activeMicroHelp.description}
                    </p>
                </div>
            )}
            {/* Main Toolbar */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">
                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('navigation')} ${getTourMutedClass('navigation')}`}>
                    {/* Hand Tool */}
                    <button
                        onClick={() => handleSetTool('hand')}
                        {...bindMicroHelp('hand')}
                        className={`${getToolButtonClass(tool === 'hand')} group`}
                        title={t.canvas.hand}
                    >
                        <img
                            src="/icons/toolbar/toolbar-hand.svg"
                            alt="Hand"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'hand' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'hand')}
                            onMouseEnter={(event) => {
                                if (tool !== 'hand') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'hand') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Select Tool */}
                    <button
                        onClick={() => handleSetTool('select')}
                        {...bindMicroHelp('select')}
                        className={`${getToolButtonClass(tool === 'select')} group`}
                        title={t.canvas.select}
                    >
                        <img
                            src="/icons/toolbar/toolbar-select.svg"
                            alt="Select"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'select' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'select')}
                            onMouseEnter={(event) => {
                                if (tool !== 'select') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'select') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>
                </div>

                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('structure')} ${getTourMutedClass('structure')}`}>
                    {/* Pen Tool */}
                    <button
                        onClick={() => handleSetTool('pen')}
                        {...bindMicroHelp('pen')}
                        className={`${getToolButtonClass(tool === 'pen', 'indigo')} group`}
                        title={t.canvas.pen}
                    >
                        <img
                            src="/icons/toolbar/toolbar-pen.svg"
                            alt="Pen"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'pen' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'pen')}
                            onMouseEnter={(event) => {
                                if (tool !== 'pen') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'pen') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Arrow Tool */}
                    <button
                        onClick={() => handleSetTool('arrow')}
                        {...bindMicroHelp('arrow')}
                        className={`${getToolButtonClass(tool === 'arrow')} group`}
                        title="Arrow"
                    >
                        <img
                            src="/icons/toolbar/toolbar-arrow.svg"
                            alt="Arrow"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'arrow' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'arrow')}
                            onMouseEnter={(event) => {
                                if (tool !== 'arrow') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'arrow') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Frame Tool */}
                    <button
                        onClick={() => handleSetTool('frame')}
                        {...bindMicroHelp('frame')}
                        className={`${getToolButtonClass(tool === 'frame')} group`}
                        title="Frame"
                    >
                        <img
                            src="/icons/toolbar/toolbar-frame.svg"
                            alt="Frame"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} ${tool === 'frame' ? 'scale-[1.02]' : 'group-hover:scale-[1.04]'}`}
                            style={getIconStyle(tool === 'frame')}
                            onMouseEnter={(event) => {
                                if (tool !== 'frame') event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                if (tool !== 'frame') event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>
                </div>

                <div className="mx-0.5 h-5 w-px bg-slate-200" />

                <div className={`flex items-center gap-1 transition-all duration-200 ease-out ${getTourGroupClass('media')} ${getTourMutedClass('media')}`}>
                    {/* Add Image */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        {...bindMicroHelp('image')}
                        className={`${btnBase} group hover:bg-blue-50 hover:shadow-sm`}
                        title={t.canvas.addImage}
                    >
                        <img
                            src="/icons/toolbar/toolbar-image.svg"
                            alt="Add Image"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} group-hover:scale-[1.04]`}
                            style={{ filter: idleIconFilter }}
                            onMouseEnter={(event) => {
                                event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>

                    {/* Add Text */}
                    <button
                        onClick={() => addTextNode(viewportCenter)}
                        {...bindMicroHelp('text')}
                        className={`${btnBase} group hover:bg-blue-50 hover:shadow-sm`}
                        title={t.canvas.addText}
                    >
                        <img
                            src="/icons/toolbar/toolbar-text.svg"
                            alt="Add Text"
                            width={22}
                            height={22}
                            className={`${toolbarIconBaseClass} group-hover:scale-[1.04]`}
                            style={{ filter: idleIconFilter }}
                            onMouseEnter={(event) => {
                                event.currentTarget.style.filter = hoverIconFilter;
                            }}
                            onMouseLeave={(event) => {
                                event.currentTarget.style.filter = idleIconFilter;
                            }}
                        />
                    </button>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* AI Chat Button - Next to toolbar, same height */}
            <div className={`flex items-center rounded-xl border border-gray-100 bg-white/98 px-2.5 py-1.5 backdrop-blur-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)] transition-all duration-200 ease-out ${getTourGroupClass('ai')} ${getTourMutedClass('ai')}`}>
                <button
                    onClick={handleAddNode}
                    {...bindMicroHelp('ai')}
                    className={`${btnBase} group hover:bg-blue-50 hover:shadow-sm`}
                    title={t.canvas.addAIChat}
                >
                    <img
                        src="/icons/toolbar/toolbar-chat.svg"
                        alt="Add AI Chat"
                        width={22}
                        height={22}
                        className={`${toolbarIconBaseClass} group-hover:scale-[1.04]`}
                        style={{ filter: idleIconFilter }}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.filter = hoverIconFilter;
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.filter = idleIconFilter;
                        }}
                    />
                </button>
            </div>

            {/* Image Limit Alert Toast */}
            {showLimitAlert && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-lg animate-in slide-in-from-bottom-2 z-[100] pointer-events-auto whitespace-nowrap">
                    <p className="text-sm font-medium text-amber-800 mb-1">
                        ⚠️ Batas gambar tercapai ({getImageNodeLimit()} maks)
                    </p>
                    <p className="text-xs text-amber-600 mb-2">
                        Upgrade paket untuk tambah gambar sepuasnya.
                    </p>
                    <button
                        onClick={() => {
                            setShowLimitAlert(false);
                            router.push('/pricing');
                        }}
                        className="w-full py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        Lihat Paket Upgrade
                    </button>
                </div>
            )}
        </div>
    );
}
