/**
 * Gemini AI Service
 * Provides AI response generation using Google's Gemini API
 * Supports both text-only and multimodal (text + image) requests
 * Now supports URL scraping for web content
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini client with environment variable
// Create .env.local file with: NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Debug log (remove in production)
console.log('API Key loaded:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Detect URLs in text
 */
function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    return text.match(urlRegex) || [];
}

/**
 * Scrape URL content via our API route
 */
async function scrapeUrl(url: string): Promise<{ title: string; content: string } | null> {
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            console.warn(`Failed to scrape ${url}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return { title: data.title, content: data.content };
    } catch (error) {
        console.error('Scrape error:', error);
        return null;
    }
}

/**
 * Convert image URL to base64
 * Works for both data URLs and blob URLs
 */
async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        // If already a data URL, extract base64
        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                return { base64: matches[2], mimeType: matches[1] };
            }
        }

        // Fetch the image and convert to base64
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
                if (matches) {
                    resolve({ base64: matches[2], mimeType: matches[1] });
                } else {
                    resolve(null);
                }
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error converting image to base64:', error);
        return null;
    }
}

/**
 * Generate an AI response based on user question and context
 * @param question - The user's question (may contain URLs to scrape)
 * @param context - Optional text context from connected nodes
 * @param imageUrls - Optional array of image URLs to analyze
 * @returns AI-generated response string
 */
export async function generateAIResponse(
    question: string,
    context?: string,
    imageUrls?: string[]
): Promise<string> {
    if (!API_KEY) {
        console.warn('API key not configured');
        return 'AI response unavailable. Please configure your API key.';
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        // Build prompt parts
        const parts: any[] = [];

        // Detect and scrape URLs in the question
        const urls = extractUrls(question);
        let scrapedContent = '';

        if (urls.length > 0) {
            console.log('Detected URLs:', urls);
            for (const url of urls.slice(0, 3)) { // Limit to 3 URLs
                const scraped = await scrapeUrl(url);
                if (scraped) {
                    scrapedContent += `\n\n--- Content from ${scraped.title} (${url}) ---\n${scraped.content}\n`;
                }
            }
        }

        // Add images if provided
        if (imageUrls && imageUrls.length > 0) {
            for (const imageUrl of imageUrls) {
                const imageData = await imageUrlToBase64(imageUrl);
                if (imageData) {
                    parts.push({
                        inlineData: {
                            mimeType: imageData.mimeType,
                            data: imageData.base64
                        }
                    });
                }
            }
        }

        // Build text prompt
        let textPrompt = '';

        // System instruction for language matching
        const languageInstruction = '\n\nIMPORTANT: Always respond in the same language as the user\'s question. If the user asks in Indonesian, respond in Indonesian. If they ask in English, respond in English.';

        if (scrapedContent) {
            // URL was provided - include scraped content
            textPrompt = `The user is asking about web content. Here is the scraped content from the URL(s):\n${scrapedContent}\n\nUser question: ${question}\n\nPlease analyze the content and provide a helpful response based on what was found.${languageInstruction}`;
        } else if (context) {
            textPrompt = `Previous context:\n${context}\n\nUser: ${question}\n\nPlease provide a helpful response.${languageInstruction}`;
        } else if (imageUrls && imageUrls.length > 0) {
            textPrompt = `User is asking about the image(s): ${question}\n\nPlease analyze the image(s) and provide a helpful response.${languageInstruction}`;
        } else {
            textPrompt = `${question}${languageInstruction}`;
        }

        parts.push({ text: textPrompt });

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        return text || 'I couldn\'t generate a response. Please try again.';
    } catch (error) {
        console.error('AI API error:', error);
        return 'Sorry, I encountered an error. Please try again.';
    }
}

