import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        // ユーザー認証
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        // 未認証の場合は空配列を返す
        if (!user) {
            return NextResponse.json([]);
        }

        // userIdがnullのメディアを現在のユーザーに紐づける（自動マイグレーション）
        await prisma.mediaImage.updateMany({
            where: { userId: null },
            data: { userId: user.id }
        });

        // ログインユーザーの画像を取得
        const media = await prisma.mediaImage.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(media);
    } catch (error) {
        console.error('Media fetch error:', error);
        // エラー時も空配列を返す（フロントエンドの.filter()エラー防止）
        return NextResponse.json([]);
    }
}
