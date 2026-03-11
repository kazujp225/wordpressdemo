import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function uploadWithRetry(
    filename: string,
    buffer: Buffer,
    contentType: string,
    retries = MAX_RETRIES
): Promise<{ data: any; error: any }> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const { data, error } = await supabaseAdmin
            .storage
            .from('images')
            .upload(filename, buffer, {
                contentType,
                cacheControl: '3600',
                upsert: false,
            });

        if (!error) return { data, error: null };

        console.warn(`Upload attempt ${attempt}/${retries} failed:`, error.message);

        if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
        } else {
            return { data: null, error };
        }
    }
    return { data: null, error: new Error('Upload failed after retries') };
}

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 画像サイズ制限 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'ファイルサイズは10MB以下にしてください' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage (リトライ付き)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = file.name.replace(/[^a-zA-Z0-9.]/g, '_'); // Sanitize
    const finalFilename = `${uniqueSuffix}-${filename}`;

    const { error: uploadError } = await uploadWithRetry(finalFilename, buffer, file.type);

    if (uploadError) {
        console.error('Supabase upload error after retries:', uploadError);
        return NextResponse.json({ error: 'アップロードに失敗しました。しばらくしてから再試行してください。' }, { status: 500 });
    }

    // Get Public URL
    const { data: { publicUrl } } = supabaseAdmin
        .storage
        .from('images')
        .getPublicUrl(finalFilename);

    // Create DB Record
    const media = await prisma.mediaImage.create({
        data: {
            userId: user.id,
            filePath: publicUrl,
            mime: file.type,
            width: 0,
            height: 0,
        },
    });

    return NextResponse.json(media);
}
