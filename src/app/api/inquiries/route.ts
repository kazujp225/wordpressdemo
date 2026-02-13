import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// POST /api/inquiries — お問い合わせ送信（全プラン対象）
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { subject, body: inquiryBody } = body;

        if (!subject || !subject.trim()) {
            return NextResponse.json({ error: '件名を入力してください' }, { status: 400 });
        }
        if (!inquiryBody || !inquiryBody.trim()) {
            return NextResponse.json({ error: '本文を入力してください' }, { status: 400 });
        }

        const inquiry = await prisma.contactInquiry.create({
            data: {
                userId: user.id,
                email: user.email || null,
                subject: subject.trim(),
                body: inquiryBody.trim(),
            },
        });

        return NextResponse.json(inquiry);
    } catch (error: any) {
        console.error('Failed to create inquiry:', error);
        return NextResponse.json({ error: 'お問い合わせの送信に失敗しました' }, { status: 500 });
    }
}

// GET /api/inquiries — 一覧取得（管理者=全件、一般=自分のみ）
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const settings = await prisma.userSettings.findUnique({
            where: { userId: user.id },
            select: { role: true },
        });

        if (settings?.role === 'admin') {
            const inquiries = await prisma.contactInquiry.findMany({
                orderBy: { createdAt: 'desc' },
            });
            return NextResponse.json(inquiries);
        }

        const inquiries = await prisma.contactInquiry.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(inquiries);
    } catch (error: any) {
        console.error('Failed to fetch inquiries:', error);
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
