"use client";

export function sanitizeAiResponseText(value: string | undefined | null): string {
    if (!value) return '';

    return value
        // Strip null bytes and most control characters that can cause odd rendering.
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        // Remove bidi override/isolate chars to reduce text spoofing tricks in code/text.
        .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/\n{0,2}---\s*\n\*\[[^\]]*Debug Info:\s*Generated using[^\]]*\]\*/gi, '')
        .replace(/\n{0,2}\[[^\]]*Debug Info:\s*Generated using[^\]]*\]/gi, '')
        .trimEnd();
}
