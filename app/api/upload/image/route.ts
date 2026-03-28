import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IMAGE_UPLOAD_BUCKET, MAX_IMAGE_UPLOAD_BYTES, MAX_TOTAL_IMAGE_STORAGE_BYTES, SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { isSafeUploadImageMimeType, SAFE_BROWSER_IMAGE_MIME_TYPES } from '@/lib/imageSecurity';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import { createAIRequestId, logAIEvent, persistAIEvent } from '@/lib/aiTelemetry';
import { isBlockedUser } from '@/lib/authState';
import { SubscriptionTier } from '@/types/credit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const sanitizeFileName = (fileName: string) => (
    fileName
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'image'
);

async function ensureImageBucket() {
    const { data: buckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    if (bucketsError) {
        throw bucketsError;
    }

    const hasBucket = buckets?.some((bucket) => bucket.name === IMAGE_UPLOAD_BUCKET);
    if (hasBucket) return;

    const { error: createBucketError } = await supabaseAdmin.storage.createBucket(IMAGE_UPLOAD_BUCKET, {
        public: true,
        fileSizeLimit: MAX_IMAGE_UPLOAD_BYTES,
        allowedMimeTypes: [...SAFE_BROWSER_IMAGE_MIME_TYPES],
    });

    if (createBucketError && !createBucketError.message.toLowerCase().includes('already exists')) {
        throw createBucketError;
    }
}

const getImageNodeLimitForTier = (tier: SubscriptionTier) => (
    SUBSCRIPTION_PLANS.find((plan) => plan.id === tier)?.maxImageNodes ?? 5
);

const getStorageObjectSize = (item: { metadata?: { size?: unknown } }) => {
    const size = item.metadata?.size;
    return typeof size === 'number' && Number.isFinite(size) ? size : null;
};

async function getUserImageStorageStats(userId: string): Promise<{ totalBytes: number; totalFiles: number }> {
    const storage = supabaseAdmin.storage.from(IMAGE_UPLOAD_BUCKET);

    const walk = async (prefix: string): Promise<{ totalBytes: number; totalFiles: number }> => {
        let totalBytes = 0;
        let totalFiles = 0;
        let offset = 0;

        while (true) {
            const { data, error } = await storage.list(prefix, {
                limit: 1000,
                offset,
                sortBy: { column: 'name', order: 'asc' },
            });

            if (error) {
                throw error;
            }

            const items = data ?? [];

            for (const item of items) {
                const fileSize = getStorageObjectSize(item);

                if (fileSize !== null) {
                    totalBytes += fileSize;
                    totalFiles += 1;
                    continue;
                }

                if (item.name) {
                    const nested = await walk(`${prefix}/${item.name}`);
                    totalBytes += nested.totalBytes;
                    totalFiles += nested.totalFiles;
                }
            }

            if (items.length < 1000) {
                break;
            }

            offset += items.length;
        }

        return { totalBytes, totalFiles };
    };

    return walk(userId);
}

export async function POST(request: NextRequest) {
    const requestId = createAIRequestId();
    const startedAt = Date.now();
    let userId: string | null = null;
    let subscriptionTier: SubscriptionTier = 'free';

    const respond = async (
        level: 'info' | 'warn' | 'error',
        event: string,
        payload: Record<string, unknown>,
        status: number,
        extra?: Record<string, unknown>
    ) => {
        const telemetryPayload = {
            requestId,
            event,
            route: 'api.upload.image' as const,
            status,
            durationMs: Date.now() - startedAt,
            userId,
            subscriptionTier,
            requestedAiMode: 'paapan' as const,
            requestedAiProvider: 'gemini',
            ...(extra || {}),
        };

        logAIEvent(level, telemetryPayload);
        await persistAIEvent(supabaseAdmin, telemetryPayload);

        return NextResponse.json(payload, { status });
    };

    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return respond('warn', 'auth_missing', { error: 'Unauthorized' }, 401, {
                code: 'AUTH_REQUIRED',
                reason: 'missing_bearer_token',
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return respond('warn', 'auth_invalid', { error: 'Invalid token' }, 401, {
                code: 'INVALID_TOKEN',
                reason: 'supabase_auth_failed',
            });
        }

        if (isBlockedUser(user)) {
            return respond('warn', 'auth_blocked', { error: 'Account blocked', code: 'ACCOUNT_BLOCKED' }, 403, {
                code: 'ACCOUNT_BLOCKED',
                reason: 'user_banned',
                userId: user.id,
            });
        }
        userId = user.id;

        const rl = checkRateLimit(`upload-image:user:${user.id}`, RATE_LIMITS.general);
        if (!rl.allowed) {
            return respond('warn', 'rate_limited', { error: 'Rate limited' }, 429, {
                code: 'RATE_LIMITED',
                reason: 'user_limit',
            });
        }

        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .single();

        const userTier = ((subscription?.tier as SubscriptionTier | undefined) ?? 'free');
        subscriptionTier = userTier;
        const imageNodeLimit = getImageNodeLimitForTier(userTier);

        const formData = await request.formData();
        const file = formData.get('file');
        const workspaceId = String(formData.get('workspaceId') || 'workspace');

        if (!(file instanceof File)) {
            return respond('warn', 'upload_rejected', { error: 'Missing file' }, 400, {
                code: 'MISSING_FILE',
                reason: 'form_file_missing',
            });
        }

        if (!isSafeUploadImageMimeType(file.type)) {
            return respond('warn', 'upload_rejected', { error: 'Unsupported file type' }, 400, {
                code: 'UNSUPPORTED_FILE_TYPE',
                reason: 'mime_type_blocked',
            });
        }

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
            return respond('warn', 'upload_rejected', { error: 'File too large', code: 'FILE_TOO_LARGE' }, 400, {
                code: 'FILE_TOO_LARGE',
                reason: 'file_size_limit',
            });
        }

        const { data: workspace, error: workspaceError } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (workspaceError || !workspace) {
            return respond('warn', 'upload_rejected', { error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' }, 404, {
                code: 'WORKSPACE_NOT_FOUND',
                reason: 'workspace_not_owned_or_missing',
            });
        }

        const { totalBytes, totalFiles } = await getUserImageStorageStats(user.id);

        if (imageNodeLimit !== -1 && totalFiles >= imageNodeLimit) {
            return respond(
                'warn',
                'upload_rejected',
                { error: 'Image limit reached', code: 'IMAGE_LIMIT_REACHED' },
                409,
                { code: 'IMAGE_LIMIT_REACHED', reason: 'image_node_limit_reached' }
            );
        }

        if (totalBytes + file.size > MAX_TOTAL_IMAGE_STORAGE_BYTES) {
            return respond(
                'warn',
                'upload_rejected',
                { error: 'Storage limit reached', code: 'STORAGE_LIMIT_REACHED' },
                409,
                { code: 'STORAGE_LIMIT_REACHED', reason: 'storage_limit_reached' }
            );
        }

        await ensureImageBucket();

        const safeFileName = sanitizeFileName(file.name);
        const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const storagePath = `${user.id}/${workspaceId}/${uniquePrefix}-${safeFileName}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from(IMAGE_UPLOAD_BUCKET)
            .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from(IMAGE_UPLOAD_BUCKET)
            .getPublicUrl(storagePath);

        return respond(
            'info',
            'upload_success',
            {
                url: publicUrlData.publicUrl,
                bucket: IMAGE_UPLOAD_BUCKET,
                path: storagePath,
                sizeBytes: file.size,
            },
            200,
            {
                imageCount: 1,
            }
        );
    } catch (error) {
        console.error('Image upload route error:', error);
        return respond('error', 'upload_failed', { error: 'Upload failed' }, 500, {
            code: 'UPLOAD_FAILED',
            reason: 'route_exception',
            error: error instanceof Error ? error.message : String(error || ''),
        });
    }
}
