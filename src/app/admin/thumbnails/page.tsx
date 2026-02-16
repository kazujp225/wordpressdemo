import { prisma } from '@/lib/db';
import { ThumbnailsContainer } from '@/components/admin/ThumbnailsContainer';
import { createClient } from '@/lib/supabase/server';
import type { ThumbnailListItem, ThumbnailCategory, ThumbnailStatus } from '@/types/thumbnail';

export default async function ThumbnailsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let thumbnails: any[] = [];
    try {
        thumbnails = await prisma.thumbnail.findMany({
            where: user ? { userId: user.id } : { id: -1 },
            orderBy: { updatedAt: 'desc' },
            include: {
                image: {
                    select: { filePath: true },
                },
            },
        });
    } catch (e) {
        console.error('DB connection failed', e);
    }

    const thumbnailsData: ThumbnailListItem[] = thumbnails.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category as ThumbnailCategory,
        width: t.width,
        height: t.height,
        presetName: t.presetName,
        status: t.status as ThumbnailStatus,
        updatedAt: t.updatedAt.toISOString(),
        image: t.image ? { filePath: t.image.filePath } : null,
    }));

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto">
            <ThumbnailsContainer initialThumbnails={thumbnailsData} />
        </div>
    );
}
