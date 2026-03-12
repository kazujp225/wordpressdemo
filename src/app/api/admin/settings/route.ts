import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

// 管理者チェック
async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

export async function GET() {
    // 認証チェック
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者チェック
    if (!await isAdmin(user.id)) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const configs = await prisma.globalConfig.findMany();
        const configMap = configs.reduce((acc: any, curr) => {
            acc[curr.key] = JSON.parse(curr.value);
            return acc;
        }, {});
        return NextResponse.json(configMap);
    } catch (error: any) {
        return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? '設定の処理に失敗しました' : error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    // 認証チェック
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者チェック
    if (!await isAdmin(user.id)) {
        return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    try {
        const data = await request.json();

        const upserts = Object.entries(data).map(([key, value]) => {
            return prisma.globalConfig.upsert({
                where: { key },
                update: { value: JSON.stringify(value) },
                create: { key, value: JSON.stringify(value) }
            });
        });

        await Promise.all(upserts);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: process.env.NODE_ENV === 'production' ? '設定の処理に失敗しました' : error.message }, { status: 500 });
    }
}
