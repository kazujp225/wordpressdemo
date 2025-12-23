import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';

// プレミアムユーザーのメールアドレス
const PREMIUM_EMAILS = ['renrenfujiwara@gmail.com'];

// ユーザー設定を取得（なければ自動作成）
async function getOrCreateUserSettings(userId: string, email: string | undefined) {
    let settings = await prisma.userSettings.findUnique({
        where: { userId }
    });

    if (!settings) {
        // 新規ユーザー: プレミアムメールかどうかでプランを決定
        const plan = email && PREMIUM_EMAILS.includes(email) ? 'premium' : 'normal';
        settings = await prisma.userSettings.create({
            data: {
                userId,
                email: email || null,
                plan
            }
        });
    } else if (email && PREMIUM_EMAILS.includes(email) && settings.plan !== 'premium') {
        // 既存ユーザーでもプレミアムメールならプレミアムに
        settings = await prisma.userSettings.update({
            where: { userId },
            data: { plan: 'premium', email }
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

    const settings = await getOrCreateUserSettings(user.id, user.email);

    return NextResponse.json({
        plan: settings.plan,
        hasApiKey: !!settings.googleApiKey,
        email: user.email
    });
}

// ユーザー設定を保存
export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { googleApiKey } = await request.json();

    await prisma.userSettings.upsert({
        where: { userId: user.id },
        update: {
            googleApiKey: googleApiKey || undefined,
            email: user.email || undefined
        },
        create: {
            userId: user.id,
            email: user.email || null,
            plan: user.email && PREMIUM_EMAILS.includes(user.email) ? 'premium' : 'normal',
            googleApiKey: googleApiKey || null
        }
    });

    return NextResponse.json({ success: true });
}
