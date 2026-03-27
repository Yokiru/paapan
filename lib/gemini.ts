/**
 * Gemini AI Service (Client Proxy)
 * Provides AI response generation by communicating with our secure Next.js Backend API
 * Prevents API Key leakage and enforces Server-Side Credit deductions.
 */

import { AIResponseStyle, AIResponseLanguage } from '@/store/useAISettingsStore';

const AI_PROXY_SENTINELS = {
    guestLimit: '__GUEST_LIMIT_REACHED__',
    insufficientCredits: '__INSUFFICIENT_CREDITS__',
    rateLimited: '__RATE_LIMITED__',
    sessionExpired: '__SESSION_EXPIRED__',
    payloadTooLarge: '__PAYLOAD_TOO_LARGE__',
    unavailable: '__AI_UNAVAILABLE__',
    byokRequired: '__BYOK_REQUIRED__',
} as const;

/**
 * Detect urls in text to forward to server
 */
export function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    return text.match(urlRegex) || [];
}

/**
 * Generate an AI response based on user question and context
 * This now proxies the request to the secure backend endpoint.
 * 
 * @param question - The user's question (may contain URLs to scrape)
 * @param context - Optional text context from connected nodes
 * @param imageUrls - Optional array of image URLs to analyze
 * @param userId - Required to deduct credits on server
 * @param actionType - Determines the cost of the AI operation
 * @returns AI-generated response string
 */
export async function generateAIResponse(
    question: string,
    context?: string,
    imageUrls?: string[],
    userId?: string,
    actionType: 'chat_simple' | 'image_analysis' | 'chat_standard' | 'chat_advanced' = 'chat_simple',
    aiSettings?: {
        style: AIResponseStyle;
        language: AIResponseLanguage;
        userName: string;
        customInstructions: string;
    },
    selectedModelId?: string,
    webSearchEnabled?: boolean
): Promise<string> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // SECURITY: Send JWT token in Authorization header for server-side verification
        // instead of sending userId in the body (which could be spoofed)
        if (userId) {
            // Get the current Supabase session token
            const { supabase } = await import('@/lib/supabase');
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            } else {
                return AI_PROXY_SENTINELS.sessionExpired;
            }
        }
            
        // 2. CHECK CUSTOM API KEY (BYOK)
        // Only inject if it exists in local storage
        if (typeof window !== 'undefined') {
            const { useAISettingsStore } = await import('@/store/useAISettingsStore');
            const byokState = useAISettingsStore.getState();
            headers['X-AI-Mode'] = byokState.aiProviderMode;
            headers['X-AI-Provider'] = byokState.byokProvider;
            if (byokState.isByokModeEnabled() && byokState.byokProvider === 'gemini') {
                headers['X-Custom-API-Key'] = byokState.customApiKey.trim();
            }
        }

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                question,
                context,
                imageUrls,
                actionType,
                aiSettings,
                selectedModelId,
                webSearchEnabled
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            // Guest limit reached → caller handles sign-up CTA
            if (response.status === 401 && data.code === 'GUEST_LIMIT_REACHED') {
                return AI_PROXY_SENTINELS.guestLimit;
            }
            if (response.status === 401 && data.code === 'INVALID_TOKEN') {
                return AI_PROXY_SENTINELS.sessionExpired;
            }
            if (response.status === 403 && data.code === 'BYOK_REQUIRED') {
                return AI_PROXY_SENTINELS.byokRequired;
            }
            // Credit exhausted
            if (response.status === 402 && data.code === 'INSUFFICIENT_CREDITS') {
                return AI_PROXY_SENTINELS.insufficientCredits;
            }
            if (response.status === 413 && data.code === 'PAYLOAD_TOO_LARGE') {
                return AI_PROXY_SENTINELS.payloadTooLarge;
            }
            if (response.status === 429 && data.code === 'RATE_LIMITED') {
                return AI_PROXY_SENTINELS.rateLimited;
            }
            if (data.code === 'AI_UNAVAILABLE' || response.status >= 500) {
                return AI_PROXY_SENTINELS.unavailable;
            }

            console.error('Unexpected AI API error response:', data);
            return AI_PROXY_SENTINELS.unavailable;
        }

        return data.result || 'Tidak ada balasan yang didapat.';
    } catch (error) {
        console.error('Network/Server error calling AI:', error);
        return AI_PROXY_SENTINELS.unavailable;
    }
}
