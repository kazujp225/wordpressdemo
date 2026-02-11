import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { checkBannerLimit } from '@/lib/usage';

// GET /api/banners (List)
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json([]);
        }

        const banners = await prisma.banner.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            include: {
                image: {
                    select: { id: true, filePath: true, width: true, height: true, mime: true },
                },
            },
        });

        return NextResponse.json(banners);
    } catch (error) {
        console.error('Banners fetch error:', error);
        return NextResponse.json([]);
    }
}

// POST /api/banners (Create)
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // バナー上限チェック
        const limitCheck = await checkBannerLimit(user.id);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: limitCheck.reason || 'バナー数の上限に達しました' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { title, platform, width, height, presetName, prompt, productInfo, imageId, referenceImageUrl, status, metadata } = body;

        if (!platform || !width || !height) {
            return NextResponse.json({ error: 'platform, width, height are required' }, { status: 400 });
        }

        const parsedWidth = parseInt(width);
        const parsedHeight = parseInt(height);
        if (parsedWidth < 1 || parsedHeight < 1 || parsedWidth > 4096 || parsedHeight > 4096) {
            return NextResponse.json({ error: 'width/height must be between 1 and 4096' }, { status: 400 });
        }

        const banner = await prisma.banner.create({
            data: {
                userId: user.id,
                title: title || `バナー ${new Date().toLocaleDateString('ja-JP')}`,
                platform,
                width: parsedWidth,
                height: parsedHeight,
                presetName: presetName || null,
                prompt: prompt || null,
                productInfo: productInfo || null,
                imageId: imageId ? parseInt(imageId) : null,
                referenceImageUrl: referenceImageUrl || null,
                status: status === 'saved' || status === 'generated' ? status : 'draft',
                metadata: metadata ? JSON.stringify(metadata) : null,
            },
            include: {
                image: {
                    select: { id: true, filePath: true, width: true, height: true, mime: true },
                },
            },
        });

        return NextResponse.json(banner);
    } catch (error: any) {
        console.error('Failed to create banner:', error);
        return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
    }
}
