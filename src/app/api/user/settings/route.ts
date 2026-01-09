import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

// プレミアムユーザーのユーザー名
const PREMIUM_USERS = ['ZettAI'];

// ユーザー設定を取得（なければ自動作成）
async function getOrCreateUserSettings(userId: string) {
    let settings = await prisma.userSettings.findUnique({
        where: { userId }
    });

    if (!settings) {
        // 新規ユーザー: プレミアムユーザーかどうかでプランを決定
        const plan = PREMIUM_USERS.includes(userId) ? 'premium' : 'normal';
        settings = await prisma.userSettings.create({
            data: {
                userId,
                email: null,
                plan
            }
        });
    } else if (PREMIUM_USERS.includes(userId) && settings.plan !== 'premium') {
        // 既存ユーザーでもプレミアムならプレミアムに
        settings = await prisma.userSettings.update({
            where: { userId },
            data: { plan: 'premium' }
        });
    }

    return settings;
}

// ユーザー設定を取得
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const settings = await getOrCreateUserSettings(userId);

    return NextResponse.json({
        plan: settings.plan,
        hasApiKey: !!settings.googleApiKey,
        username: userId
    });
}

// ユーザー設定を保存
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const { googleApiKey } = await request.json();

    await prisma.userSettings.upsert({
        where: { userId },
        update: {
            googleApiKey: googleApiKey || undefined
        },
        create: {
            userId,
            email: null,
            plan: PREMIUM_USERS.includes(userId) ? 'premium' : 'normal',
            googleApiKey: googleApiKey || null
        }
    });

    return NextResponse.json({ success: true });
}
