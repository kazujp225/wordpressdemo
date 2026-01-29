import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { adjustCredit, getCreditSummary } from '@/lib/credits';

// 管理者かどうかをチェック（DBのroleフィールドで判定）
async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

// GET: ユーザーのクレジット情報を取得
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者チェック
    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');

        if (!targetUserId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const summary = await getCreditSummary(targetUserId);
        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('Failed to fetch credit summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: クレジットを付与/調整
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者チェック
    const admin = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { userId, amount, description } = await request.json();

        if (!userId || amount === undefined) {
            return NextResponse.json({ error: 'userId and amount are required' }, { status: 400 });
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum)) {
            return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
        }

        // クレジット調整を実行
        await adjustCredit(
            userId,
            amountNum,
            description || `管理者による${amountNum >= 0 ? '付与' : '減額'}`,
            user.id
        );

        // 更新後のサマリーを取得
        const summary = await getCreditSummary(userId);

        return NextResponse.json({
            success: true,
            userId,
            adjustedAmount: amountNum,
            newBalance: summary.currentBalanceUsd,
        });
    } catch (error: any) {
        console.error('Failed to adjust credit:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
