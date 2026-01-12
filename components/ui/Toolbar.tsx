"use client";

import React from 'react';
import { useMindStore } from '@/store/useMindStore';
import { ToolMode } from '@/types';

/**
 * Toolbar Component - Medium Size
 */
export default function Toolbar() {
    const { tool, setTool, addRootNode, addImageNode, addTextNode, tidyUpNodes, viewportCenter } = useMindStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAddNode = () => {
        addRootNode(viewportCenter);
        setTool('select');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addImageNode(e.target.files[0], viewportCenter);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSetTool = (newTool: ToolMode) => setTool(newTool);

    const btnBase = "p-2 rounded-lg transition-all duration-150";

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
            {/* Main Toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12)]">

                {/* Hand Tool */}
                <button
                    onClick={() => handleSetTool('hand')}
                    className={`${btnBase} group ${tool === 'hand' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}
                    title="Hand Tool"
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
                    title="Select Tool"
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
                    title="Pen Tool"
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

                <div className="w-px h-5 bg-gray-200 mx-0.5" />

                {/* Add Image */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`${btnBase} group hover:bg-blue-50 active:scale-95`}
                    title="Add Image"
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
                    title="Add Text"
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
                    title="Add AI Chat"
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
        </div>
    );
}
