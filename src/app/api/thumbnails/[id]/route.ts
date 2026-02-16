import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

async function authenticateAndAuthorize(thumbnailId: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', status: 401, user: null, thumbnail: null };
    }

    const thumbnail = await prisma.thumbnail.findUnique({
        where: { id: thumbnailId },
        include: {
            image: {
                select: { id: true, filePath: true, width: true, height: true, mime: true },
            },
        },
    });

    if (!thumbnail) {
        return { error: 'Thumbnail not found', status: 404, user, thumbnail: null };
    }

    if (thumbnail.userId !== user.id) {
        return { error: 'Forbidden', status: 403, user, thumbnail: null };
    }

    return { error: null, status: 200, user, thumbnail };
}

// GET /api/thumbnails/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid thumbnail ID' }, { status: 400 });
    }

    try {
        const auth = await authenticateAndAuthorize(id);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const thumbnail = auth.thumbnail!;
        let metadata = null;
        try { if (thumbnail.metadata) metadata = JSON.parse(thumbnail.metadata); } catch {}

        return NextResponse.json({
            ...thumbnail,
            metadata,
        });
    } catch (error) {
        console.error('Failed to fetch thumbnail:', error);
        return NextResponse.json({ error: 'Failed to fetch thumbnail' }, { status: 500 });
    }
}

// PUT /api/thumbnails/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid thumbnail ID' }, { status: 400 });
    }

    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const { title, category, platform, width, height, presetName, prompt, productInfo, imageId, referenceImageUrl, status, metadata } = body;
        const resolvedCategory = category || platform;

        const thumbnail = await prisma.thumbnail.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(resolvedCategory !== undefined && { category: resolvedCategory }),
                ...(width !== undefined && { width: parseInt(width) }),
                ...(height !== undefined && { height: parseInt(height) }),
                ...(presetName !== undefined && { presetName }),
                ...(prompt !== undefined && { prompt }),
                ...(productInfo !== undefined && { productInfo }),
                ...(imageId !== undefined && { imageId }),
                ...(referenceImageUrl !== undefined && { referenceImageUrl }),
                ...(status !== undefined && { status }),
                ...(metadata !== undefined && { metadata: metadata ? JSON.stringify(metadata) : null }),
            },
            include: {
                image: {
                    select: { id: true, filePath: true, width: true, height: true, mime: true },
                },
            },
        });

        return NextResponse.json({ success: true, thumbnail });
    } catch (error) {
        console.error('Failed to update thumbnail:', error);
        return NextResponse.json({ error: 'Failed to update thumbnail' }, { status: 500 });
    }
}

// DELETE /api/thumbnails/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid thumbnail ID' }, { status: 400 });
    }

    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        await prisma.thumbnail.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete thumbnail:', error);
        return NextResponse.json({ error: 'Failed to delete thumbnail' }, { status: 500 });
    }
}
