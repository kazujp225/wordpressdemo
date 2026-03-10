import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseStorage = createServiceClient(supabaseUrl, supabaseServiceKey);

interface CropData {
    startY: number;
    endY: number;
    action: 'crop' | 'split';
}

export async function POST(request: NextRequest) {
    // JWT認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let pageId: string;
        let sectionId: string;
        let cropData: CropData;
        let buffer: Buffer;
        let mimeType: string;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            // FormData形式（高速：バイナリ送信）
            const formData = await request.formData();
            const imageFile = formData.get('image') as File;
            pageId = formData.get('pageId') as string;
            sectionId = formData.get('sectionId') as string;
            cropData = JSON.parse(formData.get('cropData') as string);

            if (!imageFile || !pageId || !sectionId) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            buffer = Buffer.from(await imageFile.arrayBuffer());
            mimeType = imageFile.type || 'image/jpeg';
        } else {
            // JSON形式（後方互換）
            const body = await request.json();
            pageId = body.pageId;
            sectionId = body.sectionId;
            cropData = body.cropData;
            const croppedImage = body.croppedImage as string;

            if (!pageId || !sectionId || !croppedImage) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
            buffer = Buffer.from(base64Data, 'base64');
            mimeType = 'image/png';
        }

        const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';

        // ファイル名を生成
        const timestamp = Date.now();
        const fileName = `cropped_${sectionId}_${timestamp}.${ext}`;
        const filePath = `sections/${pageId}/${fileName}`;

        // 数値IDに変換（先にチェック）
        const numericSectionId = parseInt(sectionId);
        const isTempSection = isNaN(numericSectionId);

        // アップロードとDB検索を並列実行
        const [uploadResult, section] = await Promise.all([
            supabaseStorage.storage
                .from('images')
                .upload(filePath, buffer, {
                    contentType: mimeType,
                    upsert: true
                }),
            isTempSection
                ? Promise.resolve(null)
                : prisma.pageSection.findUnique({
                    where: { id: numericSectionId },
                    include: { image: true, page: true }
                }),
        ]);

        if (uploadResult.error) {
            console.error('Supabase upload error:', uploadResult.error);
            return NextResponse.json({ error: 'Failed to upload cropped image' }, { status: 500 });
        }

        // 公開URLを取得
        const { data: urlData } = supabaseStorage.storage
            .from('images')
            .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        if (isTempSection) {
            // temp-で始まるセクションの場合はDBを更新しない
            return NextResponse.json({
                success: true,
                image: { filePath: publicUrl },
                message: 'Cropped image saved (temp section)'
            });
        }

        if (!section) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }

        // 所有者確認
        if (section.page.userId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 新しいメディアレコードを作成
        const newMedia = await prisma.mediaImage.create({
            data: {
                filePath: publicUrl,
                mime: mimeType,
                sourceType: 'cropped',
            }
        });

        // 履歴保存 + セクション更新を並列実行
        await Promise.all([
            // 履歴を保存（復元用）
            section.imageId
                ? prisma.sectionImageHistory.create({
                    data: {
                        sectionId: numericSectionId,
                        userId: user.id,
                        previousImageId: section.imageId,
                        newImageId: newMedia.id,
                        actionType: 'crop',
                    }
                })
                : Promise.resolve(),
            // セクションを更新
            prisma.pageSection.update({
                where: { id: numericSectionId },
                data: { imageId: newMedia.id }
            }),
        ]);

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
