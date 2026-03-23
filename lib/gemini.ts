/**
 * Gemini AI Service (Client Proxy)
 * Provides AI response generation by communicating with our secure Next.js Backend API
 * Prevents API Key leakage and enforces Server-Side Credit deductions.
 */

import { AIResponseStyle, AIResponseLanguage } from '@/store/useAISettingsStore';

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
            }
        }
            
        // 2. CHECK CUSTOM API KEY (BYOK)
        // Only inject if it exists in local storage
        if (typeof window !== 'undefined') {
            const customApiKey = localStorage.getItem('paapan-api-key');
            if (customApiKey && customApiKey.trim() !== '') {
                headers['X-Custom-API-Key'] = customApiKey.trim();
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
                return '__GUEST_LIMIT_REACHED__';
            }
            // Credit exhausted
            if (response.status === 402) {
                console.warn('AI generation blocked: Insufficient AI credits');
                return '__INSUFFICIENT_CREDITS__';
            }

            console.error('API Error Response:', data);
            return data.error || 'Server menolak memproses permintaan karena masalah internal.';
        }

        return data.result || 'Tidak ada balasan yang didapat.';
    } catch (error) {
        console.error('Network/Server error calling AI:', error);
        return 'Gagal terhubung ke AI. Mohon coba lagi nanti.';
    }
}
