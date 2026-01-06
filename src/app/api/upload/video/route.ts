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

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

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

        // Supabase Storageにアップロード（videosバケット）
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('videos')
            .upload(finalFilename, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase video upload error:', uploadError);

            // バケットが存在しない場合のエラーハンドリング
            if (uploadError.message?.includes('Bucket not found')) {
                return NextResponse.json(
                    { error: 'videos バケットが存在しません。Supabaseダッシュボードで作成してください' },
                    { status: 500 }
                );
            }

            return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
        }

        // Public URLを取得
        const { data: { publicUrl } } = supabase
            .storage
            .from('videos')
            .getPublicUrl(finalFilename);

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
