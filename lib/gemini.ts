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
    planType?: 'daily_free' | 'monthly',
    selectedModelId?: string,
    webSearchEnabled?: boolean
): Promise<string> {
    const GUEST_AI_KEY = 'paapan-guest-ai-used';

    // Read guest AI usage counter from localStorage (silent — not shown in UI)
    const guestUsed = typeof window !== 'undefined'
        ? parseInt(localStorage.getItem(GUEST_AI_KEY) || '0', 10)
        : 0;

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // If guest (no userId), attach counter so backend can enforce cap
        if (!userId) {
            headers['x-guest-ai-used'] = String(guestUsed);
        }

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                question,
                context,
                imageUrls,
                userId,
                actionType,
                aiSettings,
                planType,
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
                return "Maaf, saldo kredit AI Anda tidak mencukupi untuk memproses permintaan ini.";
            }

            console.error('API Error Response:', data);
            return data.error || 'Server menolak memproses permintaan karena masalah internal.';
        }

        // Success: increment guest counter silently
        if (!userId && typeof window !== 'undefined') {
            localStorage.setItem(GUEST_AI_KEY, String(guestUsed + 1));
        }

        return data.result || 'Tidak ada balasan yang didapat.';
    } catch (error) {
        console.error('AI Proxy request error:', error);
        return 'Maaf, gagal menghubungi peladen internal Paapan. Silakan coba sesaat lagi.';
    }
}

