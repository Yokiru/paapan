import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Init Supabase Service Role (Admin) client untuk mem-bypass RLS
// Kita perlukan Service Role Key untuk mengatur balance User tanpa login NextAuth
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Init Gemini 
const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Define Cost Constants (harus sinkron dengan lib/creditCosts.ts)
const COST_TEXT = 5;
const COST_IMAGE = 10;
const COST_SCRAPE = 7;

/**
 * Detect urls in text
 */
function extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    return text.match(urlRegex) || [];
}

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
            if (matches) return { base64: matches[2], mimeType: matches[1] };
        }

        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        return { base64, mimeType };
    } catch (error) {
        console.error('API Error converting image to base64:', error);
        return null;
    }
}

export async function POST(req: Request) {
    if (!API_KEY) {
        return NextResponse.json(
            { error: 'Kunci API Gemini belum dipasang di Server (.env.local). Silakan periksa pengaturan Vercel atau file lokal Anda.' },
            { status: 400 }
        );
    }

    try {
        const body = await req.json();
        const { question, context, imageUrls, userId, actionType } = body;

        // 1. EVALUATE COST FIRST!
        let calculatedCost = COST_TEXT;
        if (imageUrls && imageUrls.length > 0) calculatedCost = COST_IMAGE;

        const urls = extractUrls(question);
        if (urls.length > 0) calculatedCost = COST_SCRAPE;

        // 2. SERVER-SIDE DEDUCTION (RPC)
        // Jika userId disediakan, lindungi saldo sebelum panggil AI
        if (userId && supabaseServiceKey) {
            // Kita coba deduct Plan Credit (daily/monthly). Jika gagal, coba deduct Bonus Credit.
            // (RPC boolean bernilai false jika saldo kurang)
            const { data: deductPlan, error: err1 } = await supabaseAdmin.rpc('deduct_credits', {
                p_user_id: userId,
                p_cost: calculatedCost,
                p_credit_type: 'daily_free' // Simplified assuming daily plan as default
            });

            if (!deductPlan) {
                // Plan credit empty, try bonus
                const { data: deductBonus, error: err2 } = await supabaseAdmin.rpc('deduct_credits', {
                    p_user_id: userId,
                    p_cost: calculatedCost,
                    p_credit_type: 'bonus'
                });

                if (!deductBonus) {
                    return NextResponse.json(
                        { error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' },
                        { status: 402 }
                    );
                }
            }
        } else if (!userId) {
            // For guest/anonymous local dev, we might allow it (or block it in prod)
            console.log("Warning: Proceeding AI generation without User ID (No deduction)");
        }

        // 3. EXECUTE AI (Since Deducted Successfully)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
        const parts: any[] = [];
        let scrapedContent = '';

        // Scrape logical URLs (using host protocol)
        if (urls.length > 0) {
            // Because we are on the server, we can fetch directly avoiding our own /api/scrape route loops
            // BUT for simplicity, we mock or fetch relative to req endpoint if needed.
            // Best approach: Use native node-fetch here if we merge scrape logic.
            // For now, since scrape might be complex, we just warn or implement basic fetch:
            for (const url of urls.slice(0, 2)) {
                try {
                    const scraperResponse = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const text = await scraperResponse.text();
                    // Just take a snippet of HTML directly to summarize
                    scrapedContent += `\n\n--- Content from (${url}) ---\n${text.substring(0, 3000)}\n`;
                } catch (e) {
                    console.log("Failed embedded scrape", e);
                }
            }
        }

        // Add images
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

        // Build System Instructions
        const languageInstruction = '\n\nIMPORTANT: Always respond in the same language as the user\'s question. If the user asks in Indonesian, respond in Indonesian. If they ask in English, respond in English.';
        let textPrompt = '';

        if (scrapedContent) {
            textPrompt = `The user is asking about web content. Here is the raw HTML/text from the URL(s):\n${scrapedContent}\n\nUser question: ${question}\n\nPlease analyze the content and provide a helpful response based on what was found.${languageInstruction}`;
        } else if (context) {
            textPrompt = `Previous context:\n${context}\n\nUser: ${question}\n\nPlease provide a helpful response.${languageInstruction}`;
        } else if (imageUrls && imageUrls.length > 0) {
            textPrompt = `User is asking about the image(s): ${question}\n\nPlease analyze the image(s) and provide a helpful response.${languageInstruction}`;
        } else {
            textPrompt = `${question}${languageInstruction}`;
        }

        parts.push({ text: textPrompt });

        // Call Gemini
        const result = await model.generateContent(parts);
        const text = result.response.text();

        return NextResponse.json({ result: text });

    } catch (error: any) {
        console.error('API Error Generate Route:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
