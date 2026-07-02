"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useMindStore } from '@/store/useMindStore';

/**
 * SearchBar Component - Top right keyword search
 * Matches cards focus and blurs non-matching ones
 */
export default function SearchBar() {
    const { setSearchQuery, getMatchingNodeIds } = useMindStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [localQuery, setLocalQuery] = useState('');
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const matchingNodeIds = React.useMemo(
        () => getMatchingNodeIds(),
        [getMatchingNodeIds]
    );
    const resultCount = matchingNodeIds.length;
    const visibleResultIndex = resultCount > 0
        ? Math.min(activeResultIndex, resultCount - 1)
        : 0;

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    // Handle search submit
    const handleSearch = (query: string) => {
        setLocalQuery(query);
        setActiveResultIndex(0);
        setSearchQuery(query);
    };

    // Clear search
    const handleClear = () => {
        setLocalQuery('');
        setActiveResultIndex(0);
        setSearchQuery('');
        setIsExpanded(false);
    };

    const focusResult = (index: number) => {
        if (resultCount === 0) return;

        const nextIndex = (index + resultCount) % resultCount;
        const nodeId = matchingNodeIds[nextIndex];
        setActiveResultIndex(nextIndex);
        window.dispatchEvent(new CustomEvent('canvas:focus-search-node', {
            detail: { nodeId },
        }));
    };

    return (
        <div className="flex items-center gap-2">
            {/* Search Container */}
            <div
                className={`
                    flex items-center gap-2 
                    bg-white/98 backdrop-blur-xl border border-gray-100 rounded-xl
                    shadow-[0_4px_20px_rgb(0,0,0,0.08)]
                    transition-all duration-300 ease-out
                    ${isExpanded ? 'w-80 px-3 py-2' : 'w-10 h-10 justify-center cursor-pointer hover:bg-gray-50'}
                `}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {/* Search Icon */}
                <svg
                    className={`w-5 h-5 ${isExpanded ? 'text-gray-400' : 'text-gray-500'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>

                {/* Expanded Content */}
                {isExpanded && (
                    <>
                        {/* Input */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={localQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search content..."
                            className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    handleClear();
                                }
                                if (e.key === 'Enter') {
                                    focusResult(visibleResultIndex);
                                }
                            }}
                        />

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            title="Tutup pencarian"
                            aria-label="Tutup pencarian"
                        >
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Results Count - Show when searching */}
            {isExpanded && localQuery && (
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => focusResult(visibleResultIndex - 1)}
                        disabled={resultCount === 0}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white/98 text-gray-500 shadow-sm backdrop-blur-xl transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
                        title="Hasil sebelumnya"
                        aria-label="Hasil sebelumnya"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <div className="flex h-10 min-w-14 items-center justify-center rounded-xl border border-gray-100 bg-white/98 px-3 shadow-sm backdrop-blur-xl">
                        <span className="text-xs font-semibold text-gray-600">
                            {resultCount > 0 ? `${visibleResultIndex + 1}/${resultCount}` : '0/0'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => focusResult(visibleResultIndex + 1)}
                        disabled={resultCount === 0}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white/98 text-gray-500 shadow-sm backdrop-blur-xl transition-colors hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
                        title="Hasil berikutnya"
                        aria-label="Hasil berikutnya"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M9 18l6-6-6-6" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
}
