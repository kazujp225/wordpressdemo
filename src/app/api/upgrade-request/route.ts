import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { PLAN_IDS } from '@/lib/plans';

// POST /api/upgrade-request — アップグレード申請送信
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { desiredPlan, reason, companyName } = body;

        if (!desiredPlan || !PLAN_IDS.includes(desiredPlan)) {
            return NextResponse.json({ error: '有効なプランを選択してください' }, { status: 400 });
        }

        // 現在のプラン取得
        const settings = await prisma.userSettings.findUnique({
            where: { userId: user.id },
            select: { plan: true },
        });
        const currentPlan = settings?.plan || 'free';

        if (currentPlan === desiredPlan) {
            return NextResponse.json({ error: '既に同じプランです' }, { status: 400 });
        }

        // 既にpending申請がないかチェック
        const existing = await prisma.upgradeRequest.findFirst({
            where: { userId: user.id, status: 'pending' },
        });
        if (existing) {
            return NextResponse.json({ error: '既にアップグレード申請があります。承認をお待ちください。' }, { status: 409 });
        }

        const upgradeRequest = await prisma.upgradeRequest.create({
            data: {
                userId: user.id,
                email: user.email || null,
                currentPlan,
                desiredPlan,
                reason: reason || null,
                companyName: companyName || null,
            },
        });

        return NextResponse.json(upgradeRequest);
    } catch (error: any) {
        console.error('Failed to create upgrade request:', error);
        return NextResponse.json({ error: '申請に失敗しました' }, { status: 500 });
    }
}

// GET /api/upgrade-request — 申請一覧取得（管理者）/ 自分の申請取得
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 管理者チェック
        const settings = await prisma.userSettings.findUnique({
            where: { userId: user.id },
            select: { role: true },
        });

        if (settings?.role === 'admin') {
            // 管理者: 全申請を取得
            const requests = await prisma.upgradeRequest.findMany({
                orderBy: { createdAt: 'desc' },
            });
            return NextResponse.json(requests);
        }

        // 一般ユーザー: 自分の申請のみ
        const requests = await prisma.upgradeRequest.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(requests);
    } catch (error: any) {
        console.error('Failed to fetch upgrade requests:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
