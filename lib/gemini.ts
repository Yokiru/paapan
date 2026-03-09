/**
 * Gemini AI Service (Client Proxy)
 * Provides AI response generation by communicating with our secure Next.js Backend API
 * Prevents API Key leakage and enforces Server-Side Credit deductions.
 */

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
    actionType: 'chat_simple' | 'image_analysis' | 'chat_standard' | 'chat_advanced' = 'chat_simple'
): Promise<string> {
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                context,
                imageUrls,
                userId,
                actionType
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            // Check if it's a credit error
            if (response.status === 402) {
                console.warn('AI generation blocked: Insufficient AI credits');
                return "Maaf, saldo kredit AI Anda tidak mencukupi untuk memproses permintaan ini.";
            }

            console.error('API Error Response:', data);
            return data.error || 'Server menolak memproses permintaan karena masalah internal.';
        }

        return data.result || 'Tidak ada balasan yang didapat.';
    } catch (error) {
        console.error('AI Proxy request error:', error);
        return 'Maaf, gagal menghubungi peladen internal Paapan. Silakan coba sesaat lagi.';
    }
}

