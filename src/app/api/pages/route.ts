import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// GET /api/pages (List)
export async function GET() {
    try {
        // ユーザー認証
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        // 未認証の場合は空配列を返す
        if (!user) {
            return NextResponse.json([]);
        }

        // ログインユーザーのページのみ取得
        const pages = await prisma.page.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' }
        });

        return NextResponse.json(pages);
    } catch (error) {
        console.error('Pages fetch error:', error);
        return NextResponse.json([]);
    }
}

// POST /api/pages (Create)
export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const body = await request.json();
    const { sections, headerConfig, ...rest } = body;

    const page = await prisma.page.create({
        data: {
            userId: user?.id || null,
            title: rest.title || 'New Page ' + new Date().toLocaleDateString(),
            slug: rest.slug || 'page-' + Date.now(),
            status: 'draft',
            headerConfig: headerConfig ? JSON.stringify(headerConfig) : '{}',
            formConfig: '{}',
            sections: {
                create: sections.map((sec: any, index: number) => ({
                    role: sec.role || 'other',
                    order: index,
                    imageId: sec.imageId,
                    config: sec.config ? JSON.stringify(sec.config) : null,
                })),
            },
        },
    });

    return NextResponse.json(page);
}
