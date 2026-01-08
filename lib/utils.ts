// Utility functions for the Spatial AI Workspace

import { PastelColor, PASTEL_COLORS } from '@/types';

/**
 * Generates a unique ID for nodes and edges
 * Uses a combination of timestamp and random string for uniqueness
 */
export function generateId(): string {
    return `n_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Returns a random pastel color from the available palette
 * Used when creating new root nodes
 */
export function getRandomPastelColor(): PastelColor {
    const colors: PastelColor[] = [
        'pastel-pink',
        'pastel-blue',
        'pastel-green',
        'pastel-lavender',
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
}

/**
 * Gets the hex color value for a given pastel color name
 */
export function getPastelColorHex(color: PastelColor): string {
    return PASTEL_COLORS[color];
}

/**
 * Generates a lighter shade of a given hex color for hover states
 */
export function lightenColor(hex: string, percent: number = 10): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + percent);
    const b = Math.min(255, (num & 0x0000ff) + percent);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
