import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { pageId, sectionId, videoData } = body;

        if (!pageId || !sectionId || !videoData) {
            return NextResponse.json(
                { error: 'pageId, sectionId, and videoData are required' },
                { status: 400 }
            );
        }

        console.log('[Video Insert API] pageId:', pageId, 'sectionId:', sectionId);

        // ページの所有権確認
        const parsedPageId = parseInt(pageId, 10);
        const parsedSectionId = parseInt(sectionId, 10);

        if (isNaN(parsedPageId) || isNaN(parsedSectionId)) {
            console.error('[Video Insert API] Invalid IDs - pageId:', pageId, 'sectionId:', sectionId);
            return NextResponse.json(
                { error: `Invalid IDs: pageId=${pageId}, sectionId=${sectionId}` },
                { status: 400 }
            );
        }

        const page = await prisma.page.findFirst({
            where: {
                id: parsedPageId,
                userId: user.id,
            },
        });

        if (!page) {
            console.error('[Video Insert API] Page not found - parsedPageId:', parsedPageId, 'userId:', user.id);
            return NextResponse.json({ error: `Page not found: id=${parsedPageId}` }, { status: 404 });
        }

        // セクションを取得
        const section = await prisma.pageSection.findFirst({
            where: {
                id: parsedSectionId,
                pageId: parsedPageId,
            },
        });

        if (!section) {
            console.error('[Video Insert API] Section not found - parsedSectionId:', parsedSectionId, 'pageId:', parsedPageId);
            return NextResponse.json({ error: `Section not found: id=${parsedSectionId}, pageId=${parsedPageId}` }, { status: 404 });
        }

        // 既存のconfigをパース
        let currentConfig: any = {};
        if (section.config) {
            try {
                currentConfig = JSON.parse(section.config);
            } catch (e) {
                currentConfig = {};
            }
        }

        // 動画情報をconfigに追加
        const updatedConfig = {
            ...currentConfig,
            video: {
                type: videoData.type, // 'upload' | 'youtube' | 'embed' | 'ai-generate'
                url: videoData.url,
                thumbnailUrl: videoData.thumbnailUrl || null,
                autoplay: videoData.autoplay || false,
                loop: videoData.loop || false,
                muted: videoData.muted || true,
                displayMode: videoData.displayMode || 'partial', // 'background' | 'inline' | 'partial'
                // 部分配置用
                x: videoData.x || 50,
                y: videoData.y || 50,
                width: videoData.width || 40,
            },
        };

        // セクションを更新
        const updatedSection = await prisma.pageSection.update({
            where: { id: parseInt(sectionId, 10) },
            data: {
                config: JSON.stringify(updatedConfig),
            },
        });

        return NextResponse.json({
            success: true,
            section: {
                id: updatedSection.id,
                config: updatedConfig,
            },
        });

    } catch (error: any) {
        console.error('Video insert error:', error);
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? '動画の挿入に失敗しました' : (error.message || 'Failed to insert video') },
            { status: 500 }
        );
    }
}

// 動画を削除
export async function DELETE(request: NextRequest) {
    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const pageId = searchParams.get('pageId');
        const sectionId = searchParams.get('sectionId');

        if (!pageId || !sectionId) {
            return NextResponse.json(
                { error: 'pageId and sectionId are required' },
                { status: 400 }
            );
        }

        // セクションを取得
        const section = await prisma.pageSection.findFirst({
            where: {
                id: parseInt(sectionId, 10),
                pageId: parseInt(pageId, 10),
            },
            include: {
                page: true,
            },
        });

        if (!section || section.page.userId !== user.id) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }

        // configから動画情報を削除
        let currentConfig: any = {};
        if (section.config) {
            try {
                currentConfig = JSON.parse(section.config);
            } catch (e) {
                currentConfig = {};
            }
        }

        delete currentConfig.video;

        // セクションを更新
        await prisma.pageSection.update({
            where: { id: parseInt(sectionId, 10) },
            data: {
                config: JSON.stringify(currentConfig),
            },
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Video delete error:', error);
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? '動画の削除に失敗しました' : (error.message || 'Failed to delete video') },
            { status: 500 }
        );
    }
}
