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

// GET: テンプレート詳細（管理者のみ）
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        const { id } = await params;
        const template = await prisma.lpTemplate.findUnique({
            where: { id: parseInt(id) },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    include: { image: true, mobileImage: true }
                }
            }
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        return NextResponse.json(template);
    } catch (error: any) {
        console.error('Failed to fetch template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT: テンプレート更新（管理者のみ）
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        const { id } = await params;
        const templateId = parseInt(id);
        const body = await request.json();
        const { title, description, category, isPublished, headerConfig, sections, designDefinition } = body;

        // セクション更新がある場合はトランザクションで処理
        if (sections && Array.isArray(sections)) {
            const result = await prisma.$transaction(async (tx) => {
                // 既存セクションを削除
                await tx.lpTemplateSection.deleteMany({ where: { templateId } });

                // テンプレート本体を更新
                await tx.lpTemplate.update({
                    where: { id: templateId },
                    data: {
                        ...(headerConfig !== undefined && { headerConfig: typeof headerConfig === 'string' ? headerConfig : JSON.stringify(headerConfig) }),
                        ...(designDefinition !== undefined && { designDefinition: designDefinition ? JSON.stringify(designDefinition) : null }),
                    }
                });

                // 新しいセクションを作成
                const createdSections = [];
                for (let i = 0; i < sections.length; i++) {
                    const s = sections[i];
                    const created = await tx.lpTemplateSection.create({
                        data: {
                            templateId,
                            order: i,
                            role: s.role || 'other',
                            imageId: s.imageId ? parseInt(String(s.imageId)) : null,
                            mobileImageId: s.mobileImageId ? parseInt(String(s.mobileImageId)) : null,
                            config: s.config ? (typeof s.config === 'string' ? s.config : JSON.stringify(s.config)) : null,
                            boundaryOffsetTop: s.boundaryOffsetTop || 0,
                            boundaryOffsetBottom: s.boundaryOffsetBottom || 0,
                        },
                        include: { image: true, mobileImage: true }
                    });
                    createdSections.push(created);
                }

                return createdSections;
            });

            // Editorが期待する形式で返す
            const formattedSections = result.map((sec) => {
                let config = {};
                try { if (sec.config) config = JSON.parse(sec.config); } catch {}
                return {
                    id: sec.id.toString(),
                    role: sec.role,
                    order: sec.order,
                    imageId: sec.imageId,
                    image: sec.image,
                    mobileImageId: sec.mobileImageId,
                    mobileImage: sec.mobileImage,
                    config,
                    boundaryOffsetTop: sec.boundaryOffsetTop || 0,
                    boundaryOffsetBottom: sec.boundaryOffsetBottom || 0,
                };
            });

            return NextResponse.json({ sections: formattedSections });
        }

        // セクションなしの場合はメタデータのみ更新
        const template = await prisma.lpTemplate.update({
            where: { id: templateId },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(category !== undefined && { category }),
                ...(isPublished !== undefined && { isPublished }),
                ...(headerConfig !== undefined && { headerConfig: typeof headerConfig === 'string' ? headerConfig : JSON.stringify(headerConfig) }),
                ...(designDefinition !== undefined && { designDefinition: designDefinition ? JSON.stringify(designDefinition) : null }),
            }
        });

        return NextResponse.json(template);
    } catch (error: any) {
        console.error('Failed to update template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: テンプレート削除（管理者のみ）
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
        const { id } = await params;
        await prisma.lpTemplate.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete template:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
