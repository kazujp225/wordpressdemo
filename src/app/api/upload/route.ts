import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase as supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';
import { validateFileUpload, checkBanStatus } from '@/lib/security';

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

    // BANチェック
    const banResponse = await checkBanStatus(user.id);
    if (banResponse) return banResponse;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // 画像サイズ制限 (50MB)
    if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'ファイルサイズは50MB以下にしてください' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ファイルタイプ検証（MIMEタイプ + マジックバイト）
    const fileValidationError = validateFileUpload(file, buffer, 'image');
    if (fileValidationError) {
        return NextResponse.json({ error: fileValidationError }, { status: 400 });
    }

    // Upload to Supabase Storage (リトライ付き)
    // セキュリティ: クライアント提供のファイル名を使わず、ランダム生成
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 拡張子はMIMEタイプから安全に導出
    const MIME_TO_EXT: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
      'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
      'image/heic': '.heic', 'image/heif': '.heif',
    };
    const ext = MIME_TO_EXT[file.type] || '.bin';
    const finalFilename = `${uniqueSuffix}${ext}`;

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
