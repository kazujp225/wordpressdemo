import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { getPlan } from '@/lib/plans';

/**
 * GET /api/user/status
 * ユーザーのBAN状態とサブスクリプション状態を取得
 *
 * クライアント側でこのAPIを呼び出し、BAN/planに応じてリダイレクト処理を行う
 * これにより、Edge RuntimeでのSUPABASE_SERVICE_ROLE_KEY使用を回避
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Node.js Runtime (Prisma使用可能) でUserSettingsとクレジット残高を取得
        const [settings, creditBalance] = await Promise.all([
            prisma.userSettings.findUnique({
                where: { userId: user.id },
                select: {
                    isBanned: true,
                    banReason: true,
                    plan: true,
                    freeBannerEditsUsed: true,
                },
            }),
            prisma.creditBalance.findUnique({
                where: { userId: user.id },
                select: { balanceUsd: true },
            }),
        ]);

        const isBanned = settings?.isBanned === true;
        const plan = settings?.plan || 'free';
        const hasActiveSubscription = plan !== 'free';
        const planObj = getPlan(plan);

        // バナー数を取得
        const bannerCount = await prisma.banner.count({
            where: { userId: user.id },
        });

        return NextResponse.json({
            userId: user.id,
            isBanned,
            banReason: isBanned ? settings?.banReason : null,
            plan,
            hasActiveSubscription,
            creditBalanceUsd: creditBalance?.balanceUsd ? Number(creditBalance.balanceUsd) : 0,
            planLimits: planObj.limits,
            bannerCount,
            freeBannerEditsUsed: settings?.freeBannerEditsUsed ?? 0,
            freeBannerEditLimit: planObj.limits.freeBannerEditLimit ?? 0,
        });
    } catch (error: any) {
        console.error('Failed to get user status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
