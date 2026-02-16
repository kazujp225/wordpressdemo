import { ThumbnailEditor } from '@/components/admin/ThumbnailEditor';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import type { Thumbnail, ThumbnailCategory, ThumbnailStatus } from '@/types/thumbnail';

export default async function ThumbnailEditorPage({ params }: { params: { id: string } }) {
    const isNew = params.id === 'new';

    if (isNew) {
        return <ThumbnailEditor thumbnail={null} />;
    }

    const thumbnailId = parseInt(params.id);
    if (isNaN(thumbnailId)) return notFound();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/');

    const thumbnailRecord = await prisma.thumbnail.findUnique({
        where: { id: thumbnailId },
        include: {
            image: {
                select: { id: true, filePath: true, width: true, height: true, mime: true },
            },
        },
    });

    if (!thumbnailRecord) return notFound();
    if (thumbnailRecord.userId !== user.id) return notFound();

    let metadata = null;
    try { if (thumbnailRecord.metadata) metadata = JSON.parse(thumbnailRecord.metadata); } catch {}

    const thumbnail: Thumbnail = {
        id: thumbnailRecord.id,
        userId: thumbnailRecord.userId,
        title: thumbnailRecord.title,
        category: thumbnailRecord.category as ThumbnailCategory,
        width: thumbnailRecord.width,
        height: thumbnailRecord.height,
        presetName: thumbnailRecord.presetName,
        prompt: thumbnailRecord.prompt,
        productInfo: thumbnailRecord.productInfo,
        imageId: thumbnailRecord.imageId,
        image: thumbnailRecord.image,
        referenceImageUrl: thumbnailRecord.referenceImageUrl,
        status: thumbnailRecord.status as ThumbnailStatus,
        metadata,
        createdAt: thumbnailRecord.createdAt.toISOString(),
        updatedAt: thumbnailRecord.updatedAt.toISOString(),
    };

    return <ThumbnailEditor thumbnail={thumbnail} />;
}
