import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// 管理者かどうかをチェック（DBのroleフィールドで判定）
async function isAdmin(userId: string): Promise<{ isAdmin: boolean; email?: string }> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true, email: true }
    });
    return {
        isAdmin: userSettings?.role === 'admin',
        email: userSettings?.email || undefined
    };
}

// GET: 申請一覧を取得
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin: admin } = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const entries = await prisma.waitingRoomEntry.findMany({
            include: {
                replies: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: [
                { status: 'asc' }, // pending が先
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json(entries);
    } catch (error: any) {
        console.error('Failed to fetch waiting room entries:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: 返信を追加
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin: admin, email } = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { entryId, message } = await request.json();

        if (!entryId || !message) {
            return NextResponse.json({ error: 'entryId and message are required' }, { status: 400 });
        }

        // 返信を追加
        const reply = await prisma.waitingRoomReply.create({
            data: {
                entryId,
                message,
                adminId: user.id,
                adminName: email || 'Admin',
            }
        });

        return NextResponse.json({ success: true, reply });
    } catch (error: any) {
        console.error('Failed to add reply:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: ステータスを更新
export async function PATCH(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin: admin } = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { entryId, status, adminNotes } = await request.json();

        if (!entryId) {
            return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
        }

        const validStatuses = ['pending', 'approved', 'rejected', 'invited', 'registered'];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const updateData: any = {
            processedAt: new Date(),
            processedBy: user.id,
        };

        if (status) updateData.status = status;
        if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

        const entry = await prisma.waitingRoomEntry.update({
            where: { id: entryId },
            data: updateData,
            include: {
                replies: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        return NextResponse.json({ success: true, entry });
    } catch (error: any) {
        console.error('Failed to update entry:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: 申請を削除
export async function DELETE(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin: admin } = await isAdmin(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const entryId = searchParams.get('entryId');

        if (!entryId) {
            return NextResponse.json({ error: 'entryId is required' }, { status: 400 });
        }

        await prisma.waitingRoomEntry.delete({
            where: { id: parseInt(entryId) }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Failed to delete entry:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
