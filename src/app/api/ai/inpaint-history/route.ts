import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { checkBanStatus } from '@/lib/security';

export async function GET(request: NextRequest) {
    try {
        // ユーザー認証（必須）
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 認証必須: 未ログインユーザーはアクセス不可
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // BANチェック
        const banResponse = await checkBanStatus(user.id);
        if (banResponse) return banResponse;

        const searchParams = request.nextUrl.searchParams;
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 100);
        const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
        const originalImage = searchParams.get('originalImage'); // 特定画像の履歴を取得

        // 必ずログインユーザーのデータのみを取得
        const where: { userId: string; originalImage?: string } = {
            userId: user.id,
        };

        // 特定の元画像の履歴を取得する場合
        if (originalImage) {
            where.originalImage = originalImage;
        }

        const [histories, total] = await Promise.all([
            prisma.inpaintHistory.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.inpaintHistory.count({ where }),
        ]);

        // masksをパースして返す
        const parsedHistories = histories.map(h => ({
            ...h,
            masks: JSON.parse(h.masks),
        }));

        return NextResponse.json({
            success: true,
            histories: parsedHistories,
            total,
            hasMore: offset + limit < total,
        });

    } catch (error: any) {
        console.error('Inpaint history fetch error:', error);
        return NextResponse.json(
            { error: process.env.NODE_ENV === 'production' ? 'インペイント履歴の取得に失敗しました' : (error.message || 'Internal Server Error') },
            { status: 500 }
        );
    }
}
