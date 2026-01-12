import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCreditSummary, getSubscription } from '@/lib/credits';
import { getPlan } from '@/lib/plans';
import { prisma } from '@/lib/db';

/**
 * GET: クレジット残高と取引履歴を取得
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // クレジットサマリーを取得
    const creditSummary = await getCreditSummary(user.id);

    // サブスクリプション情報を取得
    const subscription = await getSubscription(user.id);

    // UserSettingsからプラン情報を取得
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    const planId = subscription?.plan || userSettings?.plan || 'pro';
    const plan = getPlan(planId);

    return NextResponse.json({
      credits: {
        currentBalanceUsd: creditSummary.currentBalanceUsd,
        monthlyUsageUsd: creditSummary.monthlyUsageUsd,
        monthlyGrantUsd: creditSummary.monthlyGrantUsd,
        lastRefreshedAt: creditSummary.lastRefreshedAt,
      },
      plan: {
        id: planId,
        name: plan.name,
        includedCreditUsd: plan.includedCreditUsd,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      recentTransactions: creditSummary.recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amountUsd: t.amountUsd,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error('Failed to get credit summary:', error);
    return NextResponse.json(
      { error: 'Failed to get credit summary' },
      { status: 500 }
    );
  }
}
