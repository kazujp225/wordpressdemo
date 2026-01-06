import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSupabaseAuth } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CropData {
    startY: number;
    endY: number;
    action: 'crop' | 'split';
}

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createSupabaseAuth();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { pageId, sectionId, croppedImage, cropData } = body as {
            pageId: string;
            sectionId: string;
            croppedImage: string;
            cropData: CropData;
        };

        if (!pageId || !sectionId || !croppedImage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Base64からバッファに変換
        const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // ファイル名を生成
        const timestamp = Date.now();
        const fileName = `cropped_${sectionId}_${timestamp}.png`;
        const filePath = `sections/${pageId}/${fileName}`;

        // Supabaseにアップロード
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, buffer, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload cropped image' }, { status: 500 });
        }

        // 公開URLを取得
        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        // 数値IDに変換
        const numericSectionId = parseInt(sectionId);
        if (isNaN(numericSectionId)) {
            // temp-で始まるセクションの場合はDBを更新しない
            return NextResponse.json({
                success: true,
                image: { filePath: publicUrl },
                message: 'Cropped image saved (temp section)'
            });
        }

        // データベースでセクションのimageIdを更新
        const section = await prisma.pageSection.findUnique({
            where: { id: numericSectionId },
            include: { image: true }
        });

        if (!section) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }

        // 新しいメディアレコードを作成
        const newMedia = await prisma.mediaImage.create({
            data: {
                filePath: publicUrl,
                mime: 'image/png',
                sourceType: 'cropped',
            }
        });

        // 履歴を保存（復元用）
        if (section.imageId) {
            await prisma.sectionImageHistory.create({
                data: {
                    sectionId: numericSectionId,
                    userId: user.id,
                    previousImageId: section.imageId,
                    newImageId: newMedia.id,
                    actionType: 'crop',
                }
            });
        }

        // セクションを更新
        await prisma.pageSection.update({
            where: { id: numericSectionId },
            data: { imageId: newMedia.id }
        });

        return NextResponse.json({
            success: true,
            image: newMedia,
            message: cropData.action === 'crop' ? 'Image cropped successfully' : 'Section split successfully'
        });

    } catch (error: any) {
        console.error('Crop API error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
