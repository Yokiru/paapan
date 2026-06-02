"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useMindStore } from '@/store/useMindStore';

type SearchMode = 'keyword' | 'tag';

/**
 * SearchBar Component - Top right search with keyword/tag modes
 * Matches cards focus and blurs non-matching ones
 */
export default function SearchBar() {
    const { nodes, setSearchQuery, setSearchMode, searchQuery, searchMode, getMatchingNodeIds } = useMindStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [localQuery, setLocalQuery] = useState('');
    const [activeResultIndex, setActiveResultIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const matchingNodeIds = React.useMemo(
        () => getMatchingNodeIds(),
        [getMatchingNodeIds, nodes, searchMode, searchQuery]
    );
    const resultCount = matchingNodeIds.length;
    const visibleResultIndex = resultCount > 0
        ? Math.min(activeResultIndex, resultCount - 1)
        : 0;

    // Get all unique tags from nodes for autocomplete
    const allTags = React.useMemo(() => {
        const tags = new Set<string>();
        nodes.forEach(node => {
            if (node.type === 'mindNode' && node.data && 'tags' in node.data) {
                (node.data as any).tags?.forEach((tag: any) => {
                    if (tag.label) tags.add(tag.label);
                });
            }
        });
        return Array.from(tags);
    }, [nodes]);

    // Focus input when expanded
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    useEffect(() => {
        setActiveResultIndex(0);
    }, [searchMode, searchQuery]);

    useEffect(() => {
        if (activeResultIndex >= resultCount) {
            setActiveResultIndex(Math.max(resultCount - 1, 0));
        }
    }, [activeResultIndex, resultCount]);

    // Handle search submit
    const handleSearch = (query: string) => {
        setLocalQuery(query);
        setSearchQuery(query);
    };

    // Clear search
    const handleClear = () => {
        setLocalQuery('');
        setSearchQuery('');
        setIsExpanded(false);
    };

    // Toggle mode
    const handleModeToggle = () => {
        const newMode: SearchMode = searchMode === 'keyword' ? 'tag' : 'keyword';
        setSearchMode(newMode);
        // Clear and re-search with new mode
        if (localQuery) {
            setSearchQuery(localQuery);
        }
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
                        {/* Mode Toggle Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleModeToggle();
                            }}
                            className={`
                                px-2 py-1 text-xs font-medium rounded-md transition-colors
                                ${searchMode === 'keyword'
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'bg-purple-100 text-purple-600'}
                            `}
                            title={`Search by ${searchMode}`}
                        >
                            {searchMode === 'keyword' ? 'Keyword' : 'Tag'}
                        </button>

                        {/* Input */}
                        <input
                            ref={inputRef}
                            type="text"
                            value={localQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={searchMode === 'keyword' ? 'Search content...' : 'Search tags...'}
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

                        {/* Clear Button */}
                        {localQuery && (
                            <button
                                onClick={handleClear}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
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
