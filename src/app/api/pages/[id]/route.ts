import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pageUpdateSchema, pageSectionsUpdateSchema, validateRequest } from '@/lib/validations';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const id = parseInt(params.id);

    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid page ID' }, { status: 400 });
    }

    try {
        const page = await prisma.page.findUnique({
            where: { id },
            include: {
                sections: {
                    include: { image: true, mobileImage: true },
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        return NextResponse.json({
            id: page.id,
            title: page.title,
            slug: page.slug,
            sections: page.sections.map(s => ({
                id: s.id.toString(),
                role: s.role,
                order: s.order,
                imageId: s.imageId,
                mobileImageId: s.mobileImageId,
                image: s.image,
                mobileImage: s.mobileImage,
                config: s.config,
                boundaryOffsetTop: s.boundaryOffsetTop || 0,
                boundaryOffsetBottom: s.boundaryOffsetBottom || 0,
            }))
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

    const body = await request.json();

    // Validate input
    const validation = validateRequest(pageSectionsUpdateSchema, body);
    if (!validation.success) {
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
