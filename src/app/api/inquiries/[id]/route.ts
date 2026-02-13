import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/inquiries/[id] — 既読/ステータス更新（管理者のみ）
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
    const settings = await prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { role: true },
    });

    if (settings?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { isRead, status, adminNote } = body;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const updateData: any = {};
        if (typeof isRead === 'boolean') updateData.isRead = isRead;
        if (status === 'open' || status === 'closed') updateData.status = status;
        if (typeof adminNote === 'string') updateData.adminNote = adminNote;

        const inquiry = await prisma.contactInquiry.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(inquiry);
    } catch (error: any) {
        console.error('Failed to update inquiry:', error);
        return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
    }
}
