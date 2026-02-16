import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// GET /api/thumbnails (List)
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json([]);
        }

        const thumbnails = await prisma.thumbnail.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            include: {
                image: {
                    select: { id: true, filePath: true, width: true, height: true, mime: true },
                },
            },
        });

        return NextResponse.json(thumbnails);
    } catch (error) {
        console.error('Thumbnails fetch error:', error);
        return NextResponse.json([]);
    }
}

// POST /api/thumbnails (Create)
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { title, category, width, height, presetName, prompt, productInfo, imageId, referenceImageUrl, status, metadata } = body;

        if (!category || !width || !height) {
            return NextResponse.json({ error: 'category, width, height are required' }, { status: 400 });
        }

        const parsedWidth = parseInt(width);
        const parsedHeight = parseInt(height);
        if (parsedWidth < 1 || parsedHeight < 1 || parsedWidth > 4096 || parsedHeight > 4096) {
            return NextResponse.json({ error: 'width/height must be between 1 and 4096' }, { status: 400 });
        }

        const thumbnail = await prisma.thumbnail.create({
            data: {
                userId: user.id,
                title: title || `サムネイル ${new Date().toLocaleDateString('ja-JP')}`,
                category,
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

        return NextResponse.json(thumbnail);
    } catch (error: any) {
        console.error('Failed to create thumbnail:', error);
        return NextResponse.json({ error: 'Failed to create thumbnail' }, { status: 500 });
    }
}
