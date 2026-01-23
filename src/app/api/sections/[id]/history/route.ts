import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

const log = (msg: string, data?: any) => {
    console.log(`[History API] ${msg}`, data ? JSON.stringify(data) : '');
};

// GET: セクションの画像変更履歴を取得
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id);

    log('GET request', { sectionId });

    if (isNaN(sectionId)) {
        log('Invalid section ID');
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        log('Unauthorized');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // セクション情報を取得
        const section = await prisma.pageSection.findUnique({
            where: { id: sectionId },
            include: { page: true }
        });

        log('Section lookup', { found: !!section, sectionId });

        if (!section) {
            return Response.json({ error: 'Section not found' }, { status: 404 });
        }

        // 所有者確認
        if (section.page.userId !== user.id) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 履歴を取得（新しい順）
        // セクションIDで検索 + 現在の画像IDに関連する履歴も検索
        const currentImageId = section.imageId;

        log('Looking for history', { sectionId, currentImageId });

        // 1. このセクションIDの履歴
        const historyBySectionId = await prisma.sectionImageHistory.findMany({
            where: { sectionId },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        // 2. 現在の画像に関連する履歴（セクションIDが変わっても追跡可能）
        let historyByImageId: any[] = [];
        if (currentImageId) {
            historyByImageId = await prisma.sectionImageHistory.findMany({
                where: {
                    userId: user.id,
                    OR: [
                        { previousImageId: currentImageId },
                        { newImageId: currentImageId },
                    ]
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            });
        }

        // 重複を除去してマージ
        const allHistoryIds = new Set<number>();
        const mergedHistory: any[] = [];
        for (const h of [...historyBySectionId, ...historyByImageId]) {
            if (!allHistoryIds.has(h.id)) {
                allHistoryIds.add(h.id);
                mergedHistory.push(h);
            }
        }

        // 日付順にソート
        mergedHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const history = mergedHistory.slice(0, 10);

        log('History found', { bySectionId: historyBySectionId.length, byImageId: historyByImageId.length, merged: history.length });

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

        // このセクションに対応する可能性のある元画像を探す
        // 同じページのセクションで使われている画像からタイムスタンプを抽出
        const pageSections = await prisma.pageSection.findMany({
            where: { pageId: section.pageId },
            include: { image: true }
        });

        const timestamps = new Set<string>();
        for (const s of pageSections) {
            if (s.image?.filePath) {
                // dual-desktop-1767417659743-seg-8.png のような形式からタイムスタンプを抽出
                const match = s.image.filePath.match(/(\d{13})/);
                if (match) timestamps.add(match[1]);
            }
        }

        // セクションのorder（0-indexed）に対応するseg番号
        const segNumber = section.order;

        // 同じタイムスタンプ（同じインポートセッション）のseg画像だけを探す
        const originalImages: any[] = [];
        for (const ts of timestamps) {
            const images = await prisma.mediaImage.findMany({
                where: {
                    userId: user.id,
                    filePath: { contains: `${ts}-seg-${segNumber}` }
                },
                orderBy: { createdAt: 'desc' },
                take: 3,
            });
            originalImages.push(...images);
        }

        // 重複を除去
        const uniqueOriginals = originalImages.filter((img, index, self) =>
            index === self.findIndex(i => i.id === img.id)
        );

        log('Response data', {
            historyCount: historyWithImages.length,
            originalImagesCount: uniqueOriginals.length,
            sectionOrder: section.order
        });

        return Response.json({
            history: historyWithImages,
            originalImages: uniqueOriginals,
            sectionOrder: section.order,
        });
    } catch (error: any) {
        log('Error', { error: error.message });
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

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
            include: { image: true, page: true },
        });

        if (!section) {
            return Response.json({ error: 'Section not found' }, { status: 404 });
        }

        // 所有者確認
        if (section.page.userId !== user.id) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
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

// PUT: 履歴を保存（セクション更新なし、履歴レコードのみ追加）
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const sectionId = parseInt(id);

    if (isNaN(sectionId)) {
        return Response.json({ error: 'Invalid section ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { previousImageId, newImageId, actionType, prompt } = body;

    if (!previousImageId || !newImageId) {
        return Response.json({ error: 'previousImageId and newImageId are required' }, { status: 400 });
    }

    try {
        // セクションを取得して所有者確認
        const section = await prisma.pageSection.findUnique({
            where: { id: sectionId },
            include: { page: true },
        });

        if (!section) {
            return Response.json({ error: 'Section not found' }, { status: 404 });
        }

        if (section.page.userId !== user.id) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 履歴を保存
        await prisma.sectionImageHistory.create({
            data: {
                sectionId: sectionId,
                userId: user.id,
                previousImageId,
                newImageId,
                actionType: actionType || 'manual',
                prompt: prompt || null,
            },
        });

        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Failed to save history:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
