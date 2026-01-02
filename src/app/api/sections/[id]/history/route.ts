import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// GET: セクションの画像変更履歴を取得
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id);

    if (isNaN(sectionId)) {
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 履歴を取得（新しい順）
        const history = await prisma.sectionImageHistory.findMany({
            where: { sectionId },
            orderBy: { createdAt: 'desc' },
            take: 10, // 最新10件まで
        });

        // 各履歴エントリの画像情報を取得
        const historyWithImages = await Promise.all(
            history.map(async (h) => {
                const [previousImage, newImage] = await Promise.all([
                    prisma.mediaImage.findUnique({ where: { id: h.previousImageId } }),
                    prisma.mediaImage.findUnique({ where: { id: h.newImageId } }),
                ]);
                return {
                    ...h,
                    previousImage,
                    newImage,
                };
            })
        );

        return Response.json({ history: historyWithImages });
    } catch (error: any) {
        console.error('Failed to fetch history:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// POST: 指定した履歴の画像に戻す（復元）
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id);

    if (isNaN(sectionId)) {
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageId } = body;

    if (!imageId || typeof imageId !== 'number') {
        return Response.json({ error: 'imageId is required' }, { status: 400 });
    }

    try {
        // セクションを取得
        const section = await prisma.pageSection.findUnique({
            where: { id: sectionId },
            include: { image: true },
        });

        if (!section) {
            return Response.json({ error: 'Section not found' }, { status: 404 });
        }

        // 復元先の画像が存在するか確認
        const targetImage = await prisma.mediaImage.findUnique({
            where: { id: imageId },
        });

        if (!targetImage) {
            return Response.json({ error: 'Target image not found' }, { status: 404 });
        }

        // 現在の画像をIDを保存（履歴用）
        const currentImageId = section.imageId;

        // 履歴を保存（復元操作も記録）
        if (currentImageId) {
            await prisma.sectionImageHistory.create({
                data: {
                    sectionId: sectionId,
                    userId: user.id,
                    previousImageId: currentImageId,
                    newImageId: imageId,
                    actionType: 'revert',
                    prompt: null,
                },
            });
        }

        // セクションを更新
        await prisma.pageSection.update({
            where: { id: sectionId },
            data: { imageId: imageId },
        });

        return Response.json({
            success: true,
            sectionId,
            previousImageId: currentImageId,
            newImageId: imageId,
            newImageUrl: targetImage.filePath,
        });
    } catch (error: any) {
        console.error('Failed to revert:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
