import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { checkPersistentRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const feedbackInbox = process.env.FEEDBACK_INBOX || 'hello@paapan.com';
const feedbackSenderName = process.env.FEEDBACK_SENDER_NAME || 'Paapan Feedback';
const zohoSmtpHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
const zohoSmtpPort = Number.parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
const zohoSmtpUser = process.env.ZOHO_SMTP_USER || '';
const zohoSmtpPass = process.env.ZOHO_SMTP_PASS || '';
const isZohoConfigured = Boolean(zohoSmtpUser && zohoSmtpPass);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

type FeedbackCategory = 'bug' | 'suggestion' | 'question';

const categoryLabels: Record<FeedbackCategory, string> = {
    bug: 'Bug',
    suggestion: 'Saran',
    question: 'Pertanyaan',
};

const isProduction = process.env.NODE_ENV === 'production';

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

const buildFeedbackHeadline = (args: {
    subject?: string;
    category: FeedbackCategory;
    message: string;
}) => {
    const provided = args.subject?.trim();
    if (provided) return provided.slice(0, 180);

    const firstLine = args.message.split('\n')[0]?.trim() || '';
    if (firstLine) return firstLine.slice(0, 180);

    return `${categoryLabels[args.category]} dari pengguna`;
};

const getErrorMessage = (error: unknown) => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object') {
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string') return maybeMessage;
        try {
            return JSON.stringify(error);
        } catch {
            return 'Unknown error';
        }
    }
    return 'Unknown error';
};

const isMissingFeedbackTableError = (error: unknown) => {
    if (!error || typeof error !== 'object') return false;

    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === 'string' && maybeCode === 'PGRST205') return true;

    const message = getErrorMessage(error).toLowerCase();
    return message.includes('feedback_submissions') && message.includes('could not find the table');
};

async function saveFeedbackDevFallbackLog(payload: unknown) {
    const logsDir = path.join(process.cwd(), '.tmp');
    const fallbackFile = path.join(logsDir, 'feedback-dev.ndjson');

    await mkdir(logsDir, { recursive: true });
    await appendFile(fallbackFile, `${JSON.stringify(payload)}\n`, 'utf8');

    return fallbackFile;
}

async function getAuthenticatedUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '');
    const {
        data: { user },
        error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) return null;
    return user;
}

async function sendFeedbackNotificationEmail(args: {
    category: FeedbackCategory;
    headline: string;
    message: string;
    email: string | null;
    fullName: string | null;
    pageUrl: string | null;
    userId: string | null;
}) {
    if (!isZohoConfigured) {
        throw new Error('ZOHO_SMTP_USER atau ZOHO_SMTP_PASS belum diatur.');
    }

    const categoryLabel = categoryLabels[args.category];
    const mailSubject = `[Feedback ${categoryLabel}] ${args.headline}`;
    const safeHeadline = escapeHtml(args.headline);
    const safeMessage = escapeHtml(args.message);

    const text = [
        `Subjek: ${args.headline}`,
        `Kategori: ${categoryLabel}`,
        `Pengirim: ${args.fullName || '-'}`,
        `Email: ${args.email || '-'}`,
        `User ID: ${args.userId || '-'}`,
        `Halaman: ${args.pageUrl || '-'}`,
        '',
        'Pesan:',
        args.message,
    ].join('\n');

    const html = `
        <p><strong>Subjek:</strong> ${safeHeadline}</p>
        <p><strong>Kategori:</strong> ${categoryLabel}</p>
        <p><strong>Pengirim:</strong> ${escapeHtml(args.fullName || '-')}</p>
        <p><strong>Email:</strong> ${escapeHtml(args.email || '-')}</p>
        <p><strong>User ID:</strong> ${escapeHtml(args.userId || '-')}</p>
        <p><strong>Halaman:</strong> ${escapeHtml(args.pageUrl || '-')}</p>
        <hr />
        <p><strong>Pesan:</strong></p>
        <pre style="white-space:pre-wrap;font-family:inherit;">${safeMessage}</pre>
    `;

    const safePort = Number.isFinite(zohoSmtpPort) && zohoSmtpPort > 0 ? zohoSmtpPort : 465;
    const transporter = nodemailer.createTransport({
        host: zohoSmtpHost,
        port: safePort,
        secure: safePort === 465,
        auth: {
            user: zohoSmtpUser,
            pass: zohoSmtpPass,
        },
    });

    await transporter.sendMail({
        from: `${feedbackSenderName} <${zohoSmtpUser}>`,
        to: [feedbackInbox],
        subject: mailSubject,
        text,
        html,
        replyTo: args.email || undefined,
    });
}

export async function POST(request: NextRequest) {
    try {
        const clientIp = getClientIP(request);
        const clientFingerprint = `${clientIp}:${request.headers.get('user-agent')?.slice(0, 80) || 'unknown'}`;
        const preAuthRateLimit = await checkPersistentRateLimit(
            `feedback:client:${clientFingerprint}`,
            RATE_LIMITS.feedbackClient,
            supabaseAdmin
        );

        if (!preAuthRateLimit.allowed) {
            return NextResponse.json(
                { error: 'Terlalu banyak feedback dalam waktu singkat. Coba lagi sebentar lagi.', code: 'RATE_LIMITED' },
                { status: 429 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const category = body?.category as FeedbackCategory;
        const message =
            typeof body?.message === 'string'
                ? body.message.trim().slice(0, 5000)
                : '';
        const providedEmail =
            typeof body?.email === 'string'
                ? body.email.trim().slice(0, 255)
                : '';
        const providedSubject =
            typeof body?.subject === 'string'
                ? body.subject.trim().slice(0, 180)
                : '';
        const pageUrl =
            typeof body?.pageUrl === 'string'
                ? body.pageUrl.trim().slice(0, 1000)
                : '';

        if (!['bug', 'suggestion', 'question'].includes(category)) {
            return NextResponse.json({ error: 'Kategori feedback tidak valid.' }, { status: 400 });
        }

        if (!message) {
            return NextResponse.json({ error: 'Pesan feedback tidak boleh kosong.' }, { status: 400 });
        }
        const feedbackHeadline = buildFeedbackHeadline({
            subject: providedSubject,
            category,
            message,
        });

        const user = await getAuthenticatedUser(request);
        if (user?.id) {
            const userRateLimit = await checkPersistentRateLimit(
                `feedback:user:${user.id}`,
                RATE_LIMITS.feedbackUser,
                supabaseAdmin
            );

            if (!userRateLimit.allowed) {
                return NextResponse.json(
                    { error: 'Terlalu banyak feedback dalam waktu singkat. Coba lagi sebentar lagi.', code: 'RATE_LIMITED' },
                    { status: 429 }
                );
            }
        }

        const fallbackName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;
        const fallbackEmail = user?.email || null;

        let fullName = fallbackName;
        if (user?.id) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .maybeSingle();

            if (typeof profile?.full_name === 'string' && profile.full_name.trim()) {
                fullName = profile.full_name.trim();
            }
        }

        const feedbackEmail = providedEmail || fallbackEmail;
        const feedbackRow = {
            user_id: user?.id ?? null,
            full_name: fullName,
            email: feedbackEmail,
            category,
            message,
            source_page: pageUrl || null,
            user_agent: request.headers.get('user-agent'),
            status: 'new',
        };

        let databaseSaved = false;
        let databaseSaveError: unknown = null;
        try {
            const { error } = await supabaseAdmin.from('feedback_submissions').insert(feedbackRow);
            if (error) {
                throw error;
            }
            databaseSaved = true;
        } catch (databaseError) {
            databaseSaveError = databaseError;
            console.warn('Feedback save to Supabase skipped/failed:', databaseError);
        }

        let emailSent = false;
        let emailSendError: unknown = null;
        try {
            await sendFeedbackNotificationEmail({
                category,
                headline: feedbackHeadline,
                message,
                email: feedbackEmail,
                fullName,
                pageUrl: pageUrl || null,
                userId: user?.id ?? null,
            });
            emailSent = true;
        } catch (emailError) {
            emailSendError = emailError;
            console.warn('Feedback email notification failed:', emailError);
        }

        if (!databaseSaved && !emailSent) {
            if (!isProduction) {
                try {
                    const fallbackFile = await saveFeedbackDevFallbackLog({
                        createdAt: new Date().toISOString(),
                        feedback: {
                            ...feedbackRow,
                            subject: feedbackHeadline,
                        },
                        reasons: {
                            database: getErrorMessage(databaseSaveError),
                            email: getErrorMessage(emailSendError),
                        },
                    });

                    console.warn(
                        `Feedback disimpan ke fallback local (dev): ${fallbackFile}. Database/email belum aktif.`
                    );

                    return NextResponse.json({
                        ok: true,
                        databaseSaved: false,
                        emailSent: false,
                        fallbackSaved: true,
                    });
                } catch (fallbackError) {
                    console.warn('Feedback fallback local save failed:', fallbackError);
                }
            }

            const detailHints: string[] = [];
            if (isMissingFeedbackTableError(databaseSaveError)) {
                detailHints.push('Tabel feedback_submissions belum dibuat.');
            }
            if (!isZohoConfigured) {
                detailHints.push('ZOHO_SMTP_USER/ZOHO_SMTP_PASS belum diatur.');
            }

            return NextResponse.json(
                {
                    error:
                        detailHints.length > 0
                            ? `Feedback belum aktif penuh. ${detailHints.join(' ')}`
                            : 'Feedback belum berhasil dikirim. Coba lagi sebentar lagi.',
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            databaseSaved,
            emailSent,
        });
    } catch (error) {
        console.error('Feedback route error:', error);
        return NextResponse.json(
            { error: 'Feedback belum berhasil dikirim. Coba lagi sebentar lagi.' },
            { status: 500 }
        );
    }
}
