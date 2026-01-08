"use client";

import React from 'react';
import { useMindStore } from '@/store/useMindStore';
import { ToolMode } from '@/types';

/**
 * High-Elevation White Toolbar Component
 * A floating toolbar with glass-like appearance for mode selection
 * Connected to Zustand store for global tool state
 */
export default function Toolbar() {
    const { tool, setTool, addRootNode, addImageNode, addTextNode, tidyUpNodes, viewportCenter } = useMindStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Handle adding a new node at center of viewport
    const handleAddNode = () => {
        // Add node at center of visible viewport (synced from ReactFlow)
        addRootNode(viewportCenter);
        // After adding, switch back to select mode
        setTool('select');
    };

    // Handle Image Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addImageNode(e.target.files[0], viewportCenter);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle tool selection
    const handleSetTool = (newTool: ToolMode) => {
        setTool(newTool);
    };

    return (
        <div
            className="
                fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                flex items-center gap-1 px-2 py-1.5
                bg-white/98 backdrop-blur-xl
                border border-gray-100
                rounded-xl
                shadow-[0_4px_20px_rgb(0,0,0,0.08),0_12px_40px_rgb(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.03)]
            "
        >
            {/* Hand Tool (Pan) */}
            <button
                onClick={() => handleSetTool('hand')}
                className={`
                    relative p-2 rounded-lg transition-all duration-150
                    ${tool === 'hand'
                        ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }
                `}
                title="Hand Tool (Pan) - Drag to move canvas"
            >
                {/* Hand Icon (SVG) */}
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Select Tool */}
            <button
                onClick={() => handleSetTool('select')}
                className={`
                    relative p-2 rounded-lg transition-all duration-150
                    ${tool === 'select'
                        ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }
                `}
                title="Select Tool - Click and drag nodes"
            >
                {/* Cursor/Select Icon (SVG) */}
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    <path d="M13 13l6 6" />
                </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Plus Tool (Add Node) - Trigger action, not persistent mode */}
            <button
                onClick={handleAddNode}
                className="
                    relative p-3 rounded-xl transition-all duration-150
                    text-gray-400 hover:bg-blue-50 hover:text-blue-600
                    active:scale-95
                "
                title="Add New Node"
            >
                {/* Plus Icon */}
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 5v14M5 12h14" />
                </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Image Node Button */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="
                    relative p-3 rounded-xl transition-all duration-150
                    text-gray-400 hover:bg-blue-50 hover:text-blue-600
                    active:scale-95
                "
                title="Add Image"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                </svg>
            </button>


            {/* Add Text */}
            <button
                onClick={() => addTextNode(viewportCenter)}
                className="
                    relative p-3 rounded-xl transition-all duration-150
                    text-gray-400 hover:bg-blue-50 hover:text-blue-600
                    active:scale-95
                "
                title="Add Text"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="4 7 4 4 20 4 20 7" />
                    <line x1="9" y1="20" x2="15" y2="20" />
                    <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-gray-200" />

            {/* Tidy Up Button */}
            <button
                onClick={() => tidyUpNodes()}
                className="
                    relative p-3 rounded-xl transition-all duration-150
                    text-gray-400 hover:bg-blue-50 hover:text-blue-600
                    active:scale-95
                "
                title="Tidy Up - Auto-arrange nodes"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
            </button>

            {/* Hidden Input for Images */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
        </div>
    );
}
