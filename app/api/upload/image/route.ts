import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IMAGE_UPLOAD_BUCKET, MAX_IMAGE_UPLOAD_BYTES, MAX_TOTAL_IMAGE_STORAGE_BYTES, SUBSCRIPTION_PLANS } from '@/lib/creditCosts';
import { isSafeUploadImageMimeType, SAFE_BROWSER_IMAGE_MIME_TYPES } from '@/lib/imageSecurity';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
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
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const rl = checkRateLimit(`upload-image:user:${user.id}`, RATE_LIMITS.general);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('tier')
            .eq('user_id', user.id)
            .single();

        const userTier = ((subscription?.tier as SubscriptionTier | undefined) ?? 'free');
        const imageNodeLimit = getImageNodeLimitForTier(userTier);

        const formData = await request.formData();
        const file = formData.get('file');
        const workspaceId = String(formData.get('workspaceId') || 'workspace');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }

        if (!isSafeUploadImageMimeType(file.type)) {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File too large', code: 'FILE_TOO_LARGE' }, { status: 400 });
        }

        const { data: workspace, error: workspaceError } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (workspaceError || !workspace) {
            return NextResponse.json({ error: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' }, { status: 404 });
        }

        const { totalBytes, totalFiles } = await getUserImageStorageStats(user.id);

        if (imageNodeLimit !== -1 && totalFiles >= imageNodeLimit) {
            return NextResponse.json(
                { error: 'Image limit reached', code: 'IMAGE_LIMIT_REACHED' },
                { status: 409 }
            );
        }

        if (totalBytes + file.size > MAX_TOTAL_IMAGE_STORAGE_BYTES) {
            return NextResponse.json(
                { error: 'Storage limit reached', code: 'STORAGE_LIMIT_REACHED' },
                { status: 409 }
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

        return NextResponse.json({
            url: publicUrlData.publicUrl,
            bucket: IMAGE_UPLOAD_BUCKET,
            path: storagePath,
            sizeBytes: file.size,
        });
    } catch (error) {
        console.error('Image upload route error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
