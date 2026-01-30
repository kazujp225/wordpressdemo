import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { PLANS } from '@/lib/plans';
import { getUserUsage } from '@/lib/usage';

// 管理者かどうかをチェック（DBのroleフィールドで判定）
async function isAdmin(userId: string): Promise<boolean> {
    const userSettings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { role: true }
    });
    return userSettings?.role === 'admin';
}

// GET: ユーザー一覧を取得
export async function GET() {
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
        // Supabase Admin APIでユーザー一覧を取得
        const supabaseAdmin = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;

        // UserSettingsとSubscriptionを取得
        const userSettings = await prisma.userSettings.findMany();
        const subscriptions = await prisma.subscription.findMany();

        const settingsMap = new Map(userSettings.map(s => [s.userId, s]));
        const subscriptionMap = new Map(subscriptions.map(s => [s.userId, s]));

        // 使用量情報を取得
        const usagePromises = users.map(u => getUserUsage(u.id).catch(() => null));
        const usageResults = await Promise.all(usagePromises);
        const usageMap = new Map(users.map((u, i) => [u.id, usageResults[i]]));

        const usersWithInfo = users.map(u => {
            const settings = settingsMap.get(u.id);
            const subscription = subscriptionMap.get(u.id);
            const usage = usageMap.get(u.id);

            return {
                id: u.id,
                email: u.email,
                createdAt: u.created_at,
                lastSignInAt: u.last_sign_in_at,
                isBanned: settings?.isBanned || false,
                bannedAt: settings?.bannedAt || null,
                banReason: settings?.banReason || null,
                plan: settings?.plan || 'free',
                subscriptionStatus: subscription?.status || null,
                // stripeSubscriptionId は管理画面に不要（課金情報はStripeダッシュボードで確認）
                hasSubscription: !!subscription?.stripeSubscriptionId,
                usage: usage || { monthlyGenerations: 0, monthlyUploads: 0, totalPages: 0, totalStorageMB: 0 },
            };
        });

        // BANユーザーを最後に、作成日時で降順ソート
        usersWithInfo.sort((a, b) => {
            // BANされているユーザーは最後
            if (a.isBanned !== b.isBanned) {
                return a.isBanned ? 1 : -1;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return NextResponse.json(usersWithInfo);
    } catch (error: any) {
        console.error('Failed to fetch users:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: プラン変更は削除（ユーザー自身がサブスクリプション購入で変更）

// DELETE: ユーザーをBANまたはBAN解除
export async function DELETE(request: NextRequest) {
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
        const { userId, action, reason } = await request.json();

        if (!userId || !['ban', 'unban'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const isBanned = action === 'ban';

        await prisma.userSettings.upsert({
            where: { userId },
            update: {
                isBanned,
                bannedAt: isBanned ? new Date() : null,
                bannedBy: isBanned ? user.id : null,
                banReason: isBanned ? reason || null : null,
            },
            create: {
                userId,
                isBanned,
                bannedAt: isBanned ? new Date() : null,
                bannedBy: isBanned ? user.id : null,
                banReason: isBanned ? reason || null : null,
            },
        });

        return NextResponse.json({ success: true, userId, isBanned });
    } catch (error: any) {
        console.error('Failed to update user ban status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
