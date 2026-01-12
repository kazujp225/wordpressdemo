import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createSubscriptionCheckout,
  cancelSubscription,
  resumeSubscription,
  changeSubscriptionPlan,
  getSubscriptionDetails,
} from '@/lib/stripe';
import {
  getSubscription,
  updateSubscription,
} from '@/lib/credits';
import { PLANS, type PlanType } from '@/lib/plans';

/**
 * GET: サブスクリプション情報を取得
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
    const subscription = await getSubscription(user.id);

    if (!subscription) {
      return NextResponse.json({
        hasSubscription: false,
        subscription: null,
      });
    }

    // Stripeから最新情報を取得
    let stripeDetails = null;
    if (subscription.stripeSubscriptionId) {
      stripeDetails = await getSubscriptionDetails(
        subscription.stripeSubscriptionId
      );
    }

    // TODO: Stripe本番実装時に型を確認
    const stripeData = stripeDetails as any;
    return NextResponse.json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      stripeDetails: stripeDetails
        ? {
            status: stripeData.status,
            cancelAtPeriodEnd: stripeData.cancel_at_period_end,
            currentPeriodEnd: stripeData.current_period_end
              ? new Date(stripeData.current_period_end * 1000).toISOString()
              : null,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error('Failed to get subscription:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}

/**
 * POST: サブスクリプションを開始（Checkout Sessionを作成）
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
    const { planId } = body as { planId: PlanType };

    if (!planId || !PLANS[planId]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // 既存のサブスクリプションをチェック
    const existingSubscription = await getSubscription(user.id);
    if (existingSubscription && existingSubscription.status === 'active') {
      return NextResponse.json(
        { error: 'Already has active subscription' },
        { status: 400 }
      );
    }

    // Checkout Sessionを作成
    const checkoutUrl = await createSubscriptionCheckout(
      user.id,
      user.email,
      planId,
      existingSubscription?.stripeCustomerId || undefined
    );

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: unknown) {
    console.error('Failed to create subscription checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: サブスクリプションを変更（プラン変更、キャンセル、再開）
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, newPlanId } = body as {
      action: 'cancel' | 'resume' | 'change_plan';
      newPlanId?: PlanType;
    };

    const subscription = await getSubscription(user.id);
    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'cancel':
        // 期間終了時にキャンセル
        result = await cancelSubscription(
          subscription.stripeSubscriptionId,
          true
        );
        await updateSubscription(user.id, {
          cancelAtPeriodEnd: true,
        });
        break;

      case 'resume':
        // キャンセルを取り消し
        result = await resumeSubscription(subscription.stripeSubscriptionId);
        await updateSubscription(user.id, {
          cancelAtPeriodEnd: false,
        });
        break;

      case 'change_plan':
        if (!newPlanId || !PLANS[newPlanId]) {
          return NextResponse.json(
            { error: 'Invalid plan' },
            { status: 400 }
          );
        }
        result = await changeSubscriptionPlan(
          subscription.stripeSubscriptionId,
          newPlanId
        );
        await updateSubscription(user.id, {
          plan: newPlanId,
          stripePriceId: PLANS[newPlanId].stripePriceId,
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      subscriptionId: result.id,
    });
  } catch (error: unknown) {
    console.error('Failed to update subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
