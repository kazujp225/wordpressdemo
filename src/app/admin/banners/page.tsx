import { prisma } from '@/lib/db';
import { BannersContainer } from '@/components/admin/BannersContainer';
import { createClient } from '@/lib/supabase/server';
import type { BannerListItem, BannerPlatform, BannerStatus } from '@/types/banner';

export default async function BannersPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let banners: any[] = [];
    try {
        banners = await prisma.banner.findMany({
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

    const bannersData: BannerListItem[] = banners.map((b) => ({
        id: b.id,
        title: b.title,
        platform: b.platform as BannerPlatform,
        width: b.width,
        height: b.height,
        presetName: b.presetName,
        status: b.status as BannerStatus,
        updatedAt: b.updatedAt.toISOString(),
        image: b.image ? { filePath: b.image.filePath } : null,
    }));

    return (
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto">
            <BannersContainer initialBanners={bannersData} />
        </div>
    );
}
