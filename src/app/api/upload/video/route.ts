import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime', // MOV
    'video/x-msvideo', // AVI
];

// 使用するバケット（videosがなければimagesにフォールバック）
const VIDEO_BUCKET = 'videos';
const FALLBACK_BUCKET = 'images';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // ファイルサイズチェック
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `ファイルサイズは${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください` },
                { status: 400 }
            );
        }

        // MIMEタイプチェック
        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: '対応していない動画形式です。MP4, WebM, MOVをアップロードしてください' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // ファイル名をサニタイズ
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.name.split('.').pop() || 'mp4';
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const finalFilename = `${uniqueSuffix}-${sanitizedName}`;

        // Supabase Storageにアップロード（videosバケット、なければimagesにフォールバック）
        let usedBucket = VIDEO_BUCKET;
        let uploadData: any;
        let uploadError: any;

        // まずvideosバケットを試す
        const result1 = await supabase
            .storage
            .from(VIDEO_BUCKET)
            .upload(finalFilename, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        uploadData = result1.data;
        uploadError = result1.error;

        // videosバケットがない場合、imagesバケットにフォールバック
        if (uploadError?.message?.includes('Bucket not found') || uploadError?.message?.includes('not found')) {
            console.log('[Video Upload] videos bucket not found, falling back to images bucket');
            usedBucket = FALLBACK_BUCKET;

            const result2 = await supabase
                .storage
                .from(FALLBACK_BUCKET)
                .upload(`videos/${finalFilename}`, buffer, {
                    contentType: file.type,
                    cacheControl: '3600',
                    upsert: false
                });

            uploadData = result2.data;
            uploadError = result2.error;
        }

        if (uploadError) {
            console.error('Supabase video upload error:', uploadError);
            return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
        }

        // Public URLを取得
        const filePath = usedBucket === FALLBACK_BUCKET ? `videos/${finalFilename}` : finalFilename;
        const { data: { publicUrl } } = supabase
            .storage
            .from(usedBucket)
            .getPublicUrl(filePath);

        // DBレコード作成
        const video = await prisma.mediaVideo.create({
            data: {
                userId: user.id,
                filePath: publicUrl,
                mime: file.type,
                fileSize: file.size,
                sourceType: 'upload',
            },
        });

        return NextResponse.json({
            success: true,
            video: {
                id: video.id,
                url: video.filePath,
                mime: video.mime,
                fileSize: video.fileSize,
            }
        });

    } catch (error: any) {
        console.error('Video upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Video upload failed' },
            { status: 500 }
        );
    }
}
