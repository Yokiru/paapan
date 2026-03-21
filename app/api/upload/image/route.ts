import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { IMAGE_UPLOAD_BUCKET, MAX_IMAGE_UPLOAD_BYTES } from '@/lib/creditCosts';
import { checkRateLimit, getClientIP, RATE_LIMITS } from '@/lib/rateLimit';

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
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
    });

    if (createBucketError && !createBucketError.message.toLowerCase().includes('already exists')) {
        throw createBucketError;
    }
}

export async function POST(request: NextRequest) {
    try {
        const clientIP = getClientIP(request);
        const rl = checkRateLimit(`upload-image:${clientIP}`, RATE_LIMITS.general);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }

        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const workspaceId = String(formData.get('workspaceId') || 'workspace');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'Missing file' }, { status: 400 });
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
        }

        if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File too large' }, { status: 400 });
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
