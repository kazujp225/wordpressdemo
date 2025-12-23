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

        if (pageId) {
            // 既存ページを更新
            const existingPage = await prisma.page.findFirst({
                where: { id: pageId, userId: user.id }
            });

            if (!existingPage) {
                return NextResponse.json({ error: "Page not found" }, { status: 404 });
            }

            // セクションを削除して再作成
            await prisma.pageSection.deleteMany({
                where: { pageId }
            });

            // 新しいセクションを作成
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                await prisma.pageSection.create({
                    data: {
                        pageId,
                        order: i,
                        role: section.type || section.role || 'custom',
                        config: JSON.stringify({
                            type: section.type,
                            name: section.name,
                            properties: section.properties || section.data,
                        }),
                        imageId: section.imageId || null,
                    }
                });
            }

            // ページタイトルを更新
            await prisma.page.update({
                where: { id: pageId },
                data: { title: title || existingPage.title }
            });

            return NextResponse.json({ success: true, pageId });
        } else {
            // 新規ページを作成
            const slug = `lp-${Date.now()}`;
            const newPage = await prisma.page.create({
                data: {
                    userId: user.id,
                    title: title || '新規LP',
                    slug,
                    status: 'draft',
                }
            });

            // セクションを作成
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                await prisma.pageSection.create({
                    data: {
                        pageId: newPage.id,
                        order: i,
                        role: section.type || 'custom',
                        config: JSON.stringify({
                            type: section.type,
                            name: section.name,
                            properties: section.properties || section.data,
                        }),
                        imageId: section.imageId || null,
                    }
                });
            }

            return NextResponse.json({ success: true, pageId: newPage.id, slug });
        }
    } catch (error) {
        console.error("Error saving LP:", error);
        return NextResponse.json({ error: "Failed to save LP" }, { status: 500 });
    }
}
