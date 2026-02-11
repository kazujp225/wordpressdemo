import { BannerEditor } from '@/components/admin/BannerEditor';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import type { Banner, BannerPlatform, BannerStatus } from '@/types/banner';

export default async function BannerEditorPage({ params }: { params: { id: string } }) {
    const isNew = params.id === 'new';

    if (isNew) {
        return <BannerEditor banner={null} />;
    }

    const bannerId = parseInt(params.id);
    if (isNaN(bannerId)) return notFound();

    // ユーザー認証 + 所有者確認
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/');

    const bannerRecord = await prisma.banner.findUnique({
        where: { id: bannerId },
        include: {
            image: {
                select: { id: true, filePath: true, width: true, height: true, mime: true },
            },
        },
    });

    if (!bannerRecord) return notFound();
    if (bannerRecord.userId !== user.id) return notFound();

    let metadata = null;
    try { if (bannerRecord.metadata) metadata = JSON.parse(bannerRecord.metadata); } catch {}

    const banner: Banner = {
        id: bannerRecord.id,
        userId: bannerRecord.userId,
        title: bannerRecord.title,
        platform: bannerRecord.platform as BannerPlatform,
        width: bannerRecord.width,
        height: bannerRecord.height,
        presetName: bannerRecord.presetName,
        prompt: bannerRecord.prompt,
        productInfo: bannerRecord.productInfo,
        imageId: bannerRecord.imageId,
        image: bannerRecord.image,
        referenceImageUrl: bannerRecord.referenceImageUrl,
        status: bannerRecord.status as BannerStatus,
        metadata,
        createdAt: bannerRecord.createdAt.toISOString(),
        updatedAt: bannerRecord.updatedAt.toISOString(),
    };

    return <BannerEditor banner={banner} />;
}
