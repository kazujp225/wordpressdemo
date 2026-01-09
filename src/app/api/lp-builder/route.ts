"use server";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// 既存LP一覧を取得
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const pages = await prisma.page.findMany({
            where: { userId: user.id },
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                updatedAt: true,
                sections: {
                    select: {
                        id: true,
                        order: true,
                        role: true,
                        config: true,
                        boundaryOffsetTop: true,
                        boundaryOffsetBottom: true,
                        image: {
                            select: {
                                id: true,
                                filePath: true,
                            }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json({ pages });
    } catch (error) {
        console.error("Error fetching pages:", error);
        return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
    }
}

// LPを保存/更新
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { pageId, title, sections } = body;

        // セクションデータを整形
        const sectionData = (sections || []).map((s: any, index: number) => ({
            order: index,
            role: s.type || s.role || 'section',
            imageId: s.imageId || null,
            config: JSON.stringify({
                type: s.type,
                name: s.name,
                properties: s.properties || {},
            }),
            boundaryOffsetTop: s.boundaryOffsetTop || 0,
            boundaryOffsetBottom: s.boundaryOffsetBottom || 0,
        }));

        if (pageId) {
            // 既存ページを更新
            await prisma.page.update({
                where: { id: pageId },
                data: {
                    title: title || 'Untitled',
                    updatedAt: new Date(),
                },
            });

            // 既存セクションを削除して再作成
            await prisma.pageSection.deleteMany({
                where: { pageId: pageId },
            });

            // 新しいセクションを作成
            if (sectionData.length > 0) {
                await prisma.pageSection.createMany({
                    data: sectionData.map((s: any) => ({
                        ...s,
                        pageId: pageId,
                    })),
                });
            }

            return NextResponse.json({ success: true, pageId });
        } else {
            // 新規ページを作成
            const slug = `lp-${Date.now()}`;
            const newPage = await prisma.page.create({
                data: {
                    userId: user.id,
                    title: title || 'Untitled Page',
                    slug: slug,
                    status: 'draft',
                    templateId: 'simple',
                    headerConfig: JSON.stringify({}),
                    formConfig: JSON.stringify({}),
                    sections: {
                        create: sectionData,
                    },
                },
            });

            return NextResponse.json({ success: true, pageId: newPage.id, slug: newPage.slug });
        }

    } catch (error) {
        console.error("Error saving LP:", error);
        return NextResponse.json({ error: "Failed to save page" }, { status: 500 });
    }
}
