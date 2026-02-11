import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/upgrade-request/[id] — 承認/却下（管理者専用）
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者チェック
    const adminSettings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { role: true },
    });

    if (adminSettings?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await request.json();
        const { status, reviewNote } = body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
        }

        const upgradeRequest = await prisma.upgradeRequest.findUnique({
            where: { id },
        });

        if (!upgradeRequest) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        if (upgradeRequest.status !== 'pending') {
            return NextResponse.json({ error: '既に処理済みの申請です' }, { status: 400 });
        }

        // 申請を更新
        const updated = await prisma.upgradeRequest.update({
            where: { id },
            data: {
                status,
                reviewedBy: user.id,
                reviewNote: reviewNote || null,
            },
        });

        // 承認の場合、ユーザーのプランを更新
        if (status === 'approved') {
            await prisma.userSettings.update({
                where: { userId: upgradeRequest.userId },
                data: { plan: upgradeRequest.desiredPlan },
            });
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Failed to update upgrade request:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
