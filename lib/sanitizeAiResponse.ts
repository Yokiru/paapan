"use client";

export function sanitizeAiResponseText(value: string | undefined | null): string {
    if (!value) return '';

    return value
        .replace(/\n{0,2}---\s*\n\*\[[^\]]*Debug Info:\s*Generated using[^\]]*\]\*/gi, '')
        .replace(/\n{0,2}\[[^\]]*Debug Info:\s*Generated using[^\]]*\]/gi, '')
        .trimEnd();
}
