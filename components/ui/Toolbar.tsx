"use client";

import React from 'react';
import { useMindStore } from '@/store/useMindStore';
import { useTranslation } from '@/lib/i18n';
import { ToolMode } from '@/types';
import { useRouter } from 'next/navigation';
import { getImageNodeLimit } from '@/lib/creditCosts';
import { ImageUploadResult } from '@/types';

/**
 * Toolbar Component - Medium Size
 */
export default function Toolbar() {
    const router = useRouter();
    const { t } = useTranslation();
    const { tool, setTool, addRootNode, addImageNode, addTextNode, viewportCenter } = useMindStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Limit UI state
    const [showLimitAlert, setShowLimitAlert] = React.useState(false);
    const [uploadNotice, setUploadNotice] = React.useState<string | null>(null);

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

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {uploadNotice && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm whitespace-nowrap">
                    <p className="text-sm text-blue-900">{uploadNotice}</p>
                </div>
            )}
            {/* Main Toolbar */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">

                {/* Hand Tool */}
                <button
                    onClick={() => handleSetTool('hand')}
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

                {/* Pen Tool */}
                <button
                    onClick={() => handleSetTool('pen')}
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

                <div className="mx-0.5 h-5 w-px bg-slate-200" />

                {/* Add Image */}
                <button
                    onClick={() => fileInputRef.current?.click()}
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

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* AI Chat Button - Next to toolbar, same height */}
            <div className="flex items-center px-2.5 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">
                <button
                    onClick={handleAddNode}
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
