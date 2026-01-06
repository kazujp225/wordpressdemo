import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

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

        // ページの所有権確認
        const page = await prisma.page.findFirst({
            where: {
                id: parseInt(pageId, 10),
                userId: user.id,
            },
        });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        // セクションを取得
        const section = await prisma.pageSection.findFirst({
            where: {
                id: parseInt(sectionId, 10),
                pageId: parseInt(pageId, 10),
            },
        });

        if (!section) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
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
                displayMode: videoData.displayMode || 'inline', // 'background' | 'inline' | 'modal'
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
            { error: error.message || 'Failed to insert video' },
            { status: 500 }
        );
    }
}

// 動画を削除
export async function DELETE(request: NextRequest) {
    // ユーザー認証
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

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
            { error: error.message || 'Failed to delete video' },
            { status: 500 }
        );
    }
}
