import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

// GET: テンプレート一覧（管理者のみ）
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const templates = await prisma.lpTemplate.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    take: 1,
                    include: { image: true }
                }
            }
        });

        const result = templates.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            thumbnailUrl: t.thumbnailUrl || t.sections[0]?.image?.filePath || null,
            sourceUrl: t.sourceUrl,
            isPublished: t.isPublished,
            sectionsCount: t.sections.length,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Failed to fetch templates:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: テンプレート作成（管理者のみ）
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { title, description, category, sourceUrl, sections, headerConfig, formConfig, designDefinition } = body;

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        // サムネイルURLを最初のセクションの画像から取得
        let thumbnailUrl = null;
        if (sections && sections.length > 0 && sections[0].imageId) {
            const firstImage = await prisma.mediaImage.findUnique({
                where: { id: sections[0].imageId },
                select: { filePath: true }
            });
            thumbnailUrl = firstImage?.filePath || null;
        }

        const template = await prisma.lpTemplate.create({
            data: {
                title,
                description: description || null,
                category: category || 'general',
                sourceUrl: sourceUrl || null,
                thumbnailUrl,
                headerConfig: headerConfig ? JSON.stringify(headerConfig) : '{}',
                formConfig: formConfig ? JSON.stringify(formConfig) : '{}',
                designDefinition: designDefinition ? JSON.stringify(designDefinition) : null,
                createdBy: user.id,
                isPublished: false,
                sections: {
                    create: (sections || []).map((sec: any, index: number) => ({
                        role: sec.role || 'other',
                        order: index,
                        imageId: sec.imageId || null,
                        mobileImageId: sec.mobileImageId || null,
                        config: sec.config ? JSON.stringify(sec.config) : null,
                        boundaryOffsetTop: sec.boundaryOffsetTop || 0,
                        boundaryOffsetBottom: sec.boundaryOffsetBottom || 0,
                    })),
                },
            },
        });

        return NextResponse.json(template);
    } catch (error: any) {
        console.error('Failed to create template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
