import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCreditPurchaseCheckout } from '@/lib/stripe';
import { getSubscription } from '@/lib/credits';
import { CREDIT_PACKAGES, getCreditPackageForPlan } from '@/lib/plans';
import { prisma } from '@/lib/db';

/**
 * GET: 購入可能なクレジットパッケージ一覧
 */
export async function GET() {
  return NextResponse.json({
    packages: CREDIT_PACKAGES,
  });
}

/**
 * POST: クレジット購入のCheckout Sessionを作成
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { packageId } = body as { packageId: number };

    // パッケージの存在確認
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    // ユーザーの現在のプランを取得
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { plan: true },
    });

    const currentPlan = userSettings?.plan || 'free';

    // プランに対応するパッケージかチェック
    const allowedPackage = getCreditPackageForPlan(currentPlan);
    if (!allowedPackage || allowedPackage.id !== packageId) {
      return NextResponse.json(
        { error: 'このプランでは選択されたパッケージを購入できません' },
        { status: 400 }
      );
    }

    // サブスクリプション情報を取得（CustomerIDを再利用）
    const subscription = await getSubscription(user.id);

    // Checkout Sessionを作成
    const checkoutUrl = await createCreditPurchaseCheckout(
      user.id,
      user.email,
      packageId,
      subscription?.stripeCustomerId || undefined
    );

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: unknown) {
    console.error('Failed to create credit purchase checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
