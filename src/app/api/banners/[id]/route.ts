import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

async function authenticateAndAuthorize(bannerId: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', status: 401, user: null, banner: null };
    }

    const banner = await prisma.banner.findUnique({
        where: { id: bannerId },
        include: {
            image: {
                select: { id: true, filePath: true, width: true, height: true, mime: true },
            },
        },
    });

    if (!banner) {
        return { error: 'Banner not found', status: 404, user, banner: null };
    }

    if (banner.userId !== user.id) {
        return { error: 'Forbidden', status: 403, user, banner: null };
    }

    return { error: null, status: 200, user, banner };
}

// GET /api/banners/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid banner ID' }, { status: 400 });
    }

    try {
        const auth = await authenticateAndAuthorize(id);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const banner = auth.banner!;
        let metadata = null;
        try { if (banner.metadata) metadata = JSON.parse(banner.metadata); } catch {}

        return NextResponse.json({
            ...banner,
            metadata,
        });
    } catch (error) {
        console.error('Failed to fetch banner:', error);
        return NextResponse.json({ error: 'Failed to fetch banner' }, { status: 500 });
    }
}

// PUT /api/banners/[id]
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid banner ID' }, { status: 400 });
    }

    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const body = await request.json();
        const { title, platform, width, height, presetName, prompt, productInfo, imageId, referenceImageUrl, status, metadata } = body;

        const banner = await prisma.banner.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(platform !== undefined && { platform }),
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

        return NextResponse.json({ success: true, banner });
    } catch (error) {
        console.error('Failed to update banner:', error);
        return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 });
    }
}

// DELETE /api/banners/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid banner ID' }, { status: 400 });
    }

    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        await prisma.banner.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete banner:', error);
        return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 });
    }
}
