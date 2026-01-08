'use client';

import React from 'react';
import { useMindStore } from '@/store/useMindStore';

/**
 * FavoritesBubble - Floating bubble showing favorites count
 * Click to toggle favorites filter mode (blur non-favorites)
 */
export default function FavoritesBubble() {
    const { isFavoritesFilterActive, setFavoritesFilterActive, getFavoriteCount } = useMindStore();

    const favoriteCount = getFavoriteCount();

    // Don't show bubble if no favorites
    if (favoriteCount === 0 && !isFavoritesFilterActive) {
        return null;
    }

    return (
        <button
            onClick={() => setFavoritesFilterActive(!isFavoritesFilterActive)}
            className={`
                flex items-center gap-1.5 px-3 py-2 rounded-full
                text-sm font-medium transition-all duration-200
                shadow-sm border
                ${isFavoritesFilterActive
                    ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }
            `}
            title={isFavoritesFilterActive ? "Show all cards" : "Show only favorites"}
        >
            <svg
                className={`w-4 h-4 ${isFavoritesFilterActive ? 'text-white' : 'text-rose-400'}`}
                fill={isFavoritesFilterActive ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={isFavoritesFilterActive ? 0 : 2}
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{favoriteCount}</span>
        </button>
    );
}
