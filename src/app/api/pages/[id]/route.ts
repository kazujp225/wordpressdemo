import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pageUpdateSchema, pageSectionsUpdateSchema, validateRequest } from '@/lib/validations';
import { createClient } from '@/lib/supabase/server';

// 認証とページ所有者確認のヘルパー関数
async function authenticateAndAuthorize(pageId: number) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Unauthorized', status: 401, user: null, page: null };
    }

    const page = await prisma.page.findUnique({
        where: { id: pageId },
        include: {
            sections: {
                include: { image: true, mobileImage: true },
                orderBy: { order: 'asc' },
            },
        },
    });

    if (!page) {
        return { error: 'Page not found', status: 404, user, page: null };
    }

    // 所有者確認
    if (page.userId !== user.id) {
        return { error: 'Forbidden', status: 403, user, page: null };
    }

    return { error: null, status: 200, user, page };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    try {
        const auth = await authenticateAndAuthorize(id);
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const page = auth.page!;

        // Parse headerConfig if exists
        let headerConfig = null;
        try {
            if (page.headerConfig) {
                headerConfig = JSON.parse(page.headerConfig);
            }
        } catch { }

        return NextResponse.json({
            id: page.id,
            title: page.title,
            slug: page.slug,
            headerConfig,
            sections: page.sections.map(s => {
                let config = null;
                try { if (s.config) config = JSON.parse(s.config); } catch { }
                return {
                    id: s.id.toString(),
                    role: s.role,
                    order: s.order,
                    imageId: s.imageId,
                    mobileImageId: s.mobileImageId,
                    image: s.image,
                    mobileImage: s.mobileImage,
                    config,
                    boundaryOffsetTop: s.boundaryOffsetTop || 0,
                    boundaryOffsetBottom: s.boundaryOffsetBottom || 0,
                };
            })
        });
    } catch (error) {
        console.error('Failed to fetch page:', error);
        return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    // 認証・所有者確認
    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(pageSectionsUpdateSchema, body);
    if (!validation.success) {
        console.error('[PUT /api/pages] Validation failed:', JSON.stringify(validation.details, null, 2));
        console.error('[PUT /api/pages] Request body sections sample:', JSON.stringify(body.sections?.slice(0, 2), null, 2));
        return NextResponse.json({
            error: validation.error,
            details: validation.details
        }, { status: 400 });
    }

    const { sections, headerConfig, status, designDefinition } = validation.data;

    try {
        await prisma.$transaction([
            prisma.pageSection.deleteMany({ where: { pageId: id } }),
            prisma.page.update({
                where: { id },
                data: {
                    updatedAt: new Date(),
                    headerConfig: headerConfig ? JSON.stringify(headerConfig) : undefined,
                    status: status || undefined,
                    designDefinition: designDefinition ? JSON.stringify(designDefinition) : undefined,
                    sections: {
                        create: sections.map((sec, index: number) => ({
                            role: sec.role,
                            order: index,
                            imageId: sec.imageId,
                            mobileImageId: sec.mobileImageId,
                            config: sec.config ? JSON.stringify(sec.config) : null,
                            boundaryOffsetTop: sec.boundaryOffsetTop || 0,
                            boundaryOffsetBottom: sec.boundaryOffsetBottom || 0,
                        }))
                    }
                }
            })
        ]);

        // 新しいセクションIDを取得して返す
        const updatedSections = await prisma.pageSection.findMany({
            where: { pageId: id },
            orderBy: { order: 'asc' },
            include: { image: true, mobileImage: true }
        });

        return NextResponse.json({
            success: true,
            sections: updatedSections.map(s => ({
                id: s.id,
                order: s.order,
                role: s.role,
                imageId: s.imageId,
                mobileImageId: s.mobileImageId,
                image: s.image,
                mobileImage: s.mobileImage,
                config: s.config ? JSON.parse(s.config as string) : null,
                boundaryOffsetTop: s.boundaryOffsetTop || 0,
                boundaryOffsetBottom: s.boundaryOffsetBottom || 0,
            }))
        });
    } catch (error) {
        console.error('Failed to update page sections:', error);
        return NextResponse.json({ error: 'Failed to update page sections' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    // 認証・所有者確認
    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        await prisma.page.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete page:', error);
        return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    // 認証・所有者確認
    const auth = await authenticateAndAuthorize(id);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(pageUpdateSchema, body);
    if (!validation.success) {
        return NextResponse.json({
            error: validation.error,
            details: validation.details
        }, { status: 400 });
    }

    try {
        const page = await prisma.page.update({
            where: { id },
            data: validation.data
        });
        return NextResponse.json({ success: true, page });
    } catch (error) {
        console.error('Failed to update page:', error);
        return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
    }
}
