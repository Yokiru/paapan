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

    const btnBase = "p-2 rounded-lg transition-all duration-150";

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {uploadNotice && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-blue-100 px-4 py-2 shadow-sm whitespace-nowrap">
                    <p className="text-sm text-blue-900">{uploadNotice}</p>
                </div>
            )}
            {/* Main Toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">

                {/* Hand Tool */}
                <button
                    onClick={() => handleSetTool('hand')}
                    className={`${btnBase} group ${tool === 'hand' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    title={t.canvas.hand}
                >
                    <img
                        src={tool === 'hand'
                            ? '/icons/hand aktif.png'
                            : '/icons/hand mati.png'
                        }
                        alt="Hand"
                        width={22}
                        height={22}
                        className={`${tool !== 'hand' ? 'group-hover:hidden' : ''}`}
                    />
                    {tool !== 'hand' && (
                        <img
                            src="/icons/hand hover.png"
                            alt="Hand Hover"
                            width={22}
                            height={22}
                            className="hidden group-hover:block"
                        />
                    )}
                </button>

                {/* Select Tool */}
                <button
                    onClick={() => handleSetTool('select')}
                    className={`${btnBase} group ${tool === 'select' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    title={t.canvas.select}
                >
                    <img
                        src={tool === 'select'
                            ? '/icons/cursor normal aktif.png'
                            : '/icons/cursor normal mati.png'
                        }
                        alt="Select"
                        width={22}
                        height={22}
                        className={`${tool !== 'select' ? 'group-hover:hidden' : ''}`}
                    />
                    {tool !== 'select' && (
                        <img
                            src="/icons/cursor normal hover.png"
                            alt="Select Hover"
                            width={22}
                            height={22}
                            className="hidden group-hover:block"
                        />
                    )}
                </button>

                {/* Pen Tool */}
                <button
                    onClick={() => handleSetTool('pen')}
                    className={`${btnBase} group ${tool === 'pen' ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-gray-50'}`}
                    title={t.canvas.pen}
                >
                    <img
                        src={tool === 'pen'
                            ? '/icons/pen aktif.png'
                            : '/icons/pen mati.png'
                        }
                        alt="Pen"
                        width={22}
                        height={22}
                        className={`${tool !== 'pen' ? 'group-hover:hidden' : ''}`}
                    />
                    {tool !== 'pen' && (
                        <img
                            src="/icons/pen hover.png"
                            alt="Pen Hover"
                            width={22}
                            height={22}
                            className="hidden group-hover:block"
                        />
                    )}
                </button>

                {/* Arrow Tool */}
                <button
                    onClick={() => handleSetTool('arrow')}
                    className={`${btnBase} group ${tool === 'arrow' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    title="Arrow"
                >
                    <img
                        src={tool === 'arrow'
                            ? '/icons/arrow aktif.png'
                            : '/icons/arrow mati.png'
                        }
                        alt="Arrow"
                        width={22}
                        height={22}
                        className={`${tool !== 'arrow' ? 'group-hover:hidden' : ''}`}
                    />
                    {tool !== 'arrow' && (
                        <img
                            src="/icons/arrow aktif.png" // Menggunakan gambar aktif saat di-hover, karena user belum membuat arrow hover.png
                            alt="Arrow Hover"
                            width={22}
                            height={22}
                            className="hidden group-hover:block"
                        />
                    )}
                </button>

                {/* Frame Tool */}
                <button
                    onClick={() => handleSetTool('frame')}
                    className={`${btnBase} ${tool === 'frame' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    title="Frame"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 22 22"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className={`${tool === 'frame' ? 'text-blue-600' : 'text-gray-500'}`}
                    >
                        <rect
                            x="4"
                            y="4"
                            width="14"
                            height="14"
                            rx="3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray="3 3"
                        />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                {/* Add Image */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`${btnBase} group hover:bg-blue-50 active:scale-95`}
                    title={t.canvas.addImage}
                >
                    <img
                        src="/icons/image mati.png"
                        alt="Add Image"
                        width={22}
                        height={22}
                        className="group-hover:hidden"
                    />
                    <img
                        src="/icons/image hover.png"
                        alt="Add Image Hover"
                        width={22}
                        height={22}
                        className="hidden group-hover:block"
                    />
                </button>

                {/* Add Text */}
                <button
                    onClick={() => addTextNode(viewportCenter)}
                    className={`${btnBase} group hover:bg-blue-50 active:scale-95`}
                    title={t.canvas.addText}
                >
                    <img
                        src="/icons/text mati.png"
                        alt="Add Text"
                        width={22}
                        height={22}
                        className="group-hover:hidden"
                    />
                    <img
                        src="/icons/text hover.png"
                        alt="Add Text Hover"
                        width={22}
                        height={22}
                        className="hidden group-hover:block"
                    />
                </button>

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>

            {/* AI Chat Button - Next to toolbar, same height */}
            <div className="flex items-center px-2 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">
                <button
                    onClick={handleAddNode}
                    className="group p-2 rounded-lg hover:bg-blue-50 active:scale-95 transition-all"
                    title={t.canvas.addAIChat}
                >
                    <img
                        src="/icons/chat mati.png"
                        alt="Add AI Chat"
                        width={22}
                        height={22}
                        className="group-hover:hidden"
                    />
                    <img
                        src="/icons/chat hover.png"
                        alt="Add AI Chat Hover"
                        width={22}
                        height={22}
                        className="hidden group-hover:block"
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
