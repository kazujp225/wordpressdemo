import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { checkPageLimit } from '@/lib/usage';
import { z } from 'zod';

// ページ作成時のセクション設定スキーマ
const createSectionSchema = z.object({
    role: z.string().max(100).default('other'),
    imageId: z.number().nullable().optional(),
    mobileImageId: z.number().nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    boundaryOffsetTop: z.number().optional().default(0),
    boundaryOffsetBottom: z.number().optional().default(0),
});

const createPageBodySchema = z.object({
    title: z.string().max(500).optional(),
    slug: z.string().max(200).regex(/^[a-z0-9-]+$/).optional(),
    sections: z.array(createSectionSchema).max(100).default([]),
    headerConfig: z.record(z.string(), z.unknown()).optional(),
});

// GET /api/pages (List)
export async function GET() {
    try {
        // ユーザー認証
        const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

        // 未認証の場合は401を返す
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ログインユーザーのページのみ取得（ページネーション付き）
        const MAX_PAGES = 200;
        const pages = await prisma.page.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: 'desc' },
            take: MAX_PAGES,
        });

        return NextResponse.json(pages);
    } catch (error) {
        console.error('Pages fetch error:', error);
        return NextResponse.json([]);
    }
}

// カラーログ
const log = {
    info: (msg: string) => console.log(`\x1b[36m[PAGES API]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[PAGES API]\x1b[0m ✓ ${msg}`),
    warn: (msg: string) => console.log(`\x1b[33m[PAGES API]\x1b[0m ⚠ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[PAGES API]\x1b[0m ✗ ${msg}`),
};

// POST /api/pages (Create)
export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // ページ数制限チェック
        const limitCheck = await checkPageLimit(user.id);
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: limitCheck.reason || 'ページ数の上限に達しました' },
                { status: 403 }
            );
        }

        const rawBody = await request.json();
        const parseResult = createPageBodySchema.safeParse(rawBody);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Invalid request body', details: parseResult.error.issues },
                { status: 400 }
            );
        }
        const { sections, headerConfig, ...rest } = parseResult.data;

        log.info(`========== Creating New Page ==========`);
        log.info(`Title: ${rest.title}`);
        log.info(`Sections count: ${sections?.length || 0}`);

        // セクションごとのimageId確認
        if (sections && sections.length > 0) {
            sections.forEach((sec: any, idx: number) => {
                if (sec.imageId) {
                    log.success(`Section ${idx}: role=${sec.role}, imageId=${sec.imageId}`);
                } else {
                    log.warn(`Section ${idx}: role=${sec.role}, imageId=NULL (画像なし)`);
                }
            });
        }

        const page = await prisma.page.create({
            data: {
                userId: user.id,
                title: rest.title || 'New Page ' + new Date().toLocaleDateString(),
                slug: rest.slug || 'page-' + Date.now(),
                status: 'draft',
                headerConfig: headerConfig ? JSON.stringify(headerConfig) : '{}',
                formConfig: '{}',
                sections: {
                    create: sections.map((sec: any, index: number) => ({
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

        log.success(`Page created with ID: ${page.id}`);
        log.info(`========== Page Creation Complete ==========`);

        return NextResponse.json(page);
    } catch (error: any) {
        console.error('Failed to create page:', error);
        return NextResponse.json(
            { error: 'Failed to create page' },
            { status: 500 }
        );
    }
}
