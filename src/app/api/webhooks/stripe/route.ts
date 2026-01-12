import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { constructWebhookEvent, getPlanIdFromPriceId } from '@/lib/stripe';
import {
  grantPlanCredit,
  addPurchasedCredit,
  updateSubscription,
} from '@/lib/credits';
import { PLANS } from '@/lib/plans';
import { prisma } from '@/lib/db';

/**
 * Stripe Webhook処理
 *
 * 処理するイベント:
 * - checkout.session.completed: サブスク開始 / クレジット購入完了
 * - invoice.paid: 月次サブスク更新（クレジット付与）
 * - customer.subscription.updated: サブスク更新
 * - customer.subscription.deleted: サブスクキャンセル完了
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (error: unknown) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Checkout Session完了時の処理
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const userId = metadata.userId;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // サブスクリプションの場合
  if (session.mode === 'subscription' && session.subscription) {
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id || '';

    const planId = metadata.planId || 'pro';
    const plan = PLANS[planId as keyof typeof PLANS];

    // サブスクリプション情報を保存
    await updateSubscription(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: plan?.stripePriceId,
      plan: planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 仮の30日後
    });

    // UserSettingsのプランも更新
    await prisma.userSettings.upsert({
      where: { userId },
      update: { plan: planId },
      create: {
        userId,
        plan: planId,
      },
    });

    // 初回クレジット付与
    if (plan) {
      await grantPlanCredit(userId, plan.includedCreditUsd, plan.name);
    }

    console.log(`Subscription created for user ${userId}, plan: ${planId}`);
  }

  // 単発購入（クレジット購入）の場合
  if (session.mode === 'payment') {
    const packageId = metadata.packageId;
    const creditUsd = parseFloat(metadata.creditUsd || '0');
    const packageName = metadata.packageName || 'クレジットパッケージ';
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || session.id;

    if (creditUsd > 0) {
      await addPurchasedCredit(userId, creditUsd, paymentIntentId, packageName);
      console.log(
        `Credit purchased for user ${userId}: $${creditUsd} (package: ${packageName})`
      );
    }
  }
}

/**
 * Invoice支払い完了時の処理（月次更新）
 * TODO: Stripe本番実装時に型を確認
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // 初回請求（サブスク開始時）はcheckout.session.completedで処理済みなのでスキップ
  if (invoice.billing_reason === 'subscription_create') {
    return;
  }

  // 月次更新の場合のみ処理
  if (invoice.billing_reason !== 'subscription_cycle') {
    return;
  }

  // TODO: Stripe本番実装時に型を確認
  const invoiceData = invoice as any;
  const subscriptionId =
    typeof invoiceData.subscription === 'string'
      ? invoiceData.subscription
      : invoiceData.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  // サブスクリプションからユーザーを特定
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.error(`Subscription not found: ${subscriptionId}`);
    return;
  }

  // Price IDからプランを特定
  const priceId = invoiceData.lines?.data?.[0]?.price?.id;
  const planId = priceId ? getPlanIdFromPriceId(priceId) : null;
  const plan = planId ? PLANS[planId] : PLANS[subscription.plan as keyof typeof PLANS];

  if (plan) {
    // 月間クレジット付与
    await grantPlanCredit(subscription.userId, plan.includedCreditUsd, plan.name);

    // 期間を更新
    await updateSubscription(subscription.userId, {
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    console.log(
      `Monthly credit granted for user ${subscription.userId}: $${plan.includedCreditUsd}`
    );
  }
}

/**
 * サブスクリプション更新時の処理
 * TODO: Stripe本番実装時に型を確認
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!subscriptionRecord) {
    return;
  }

  // TODO: Stripe本番実装時に型を確認
  const subData = subscription as any;

  // プラン変更の検出
  const priceId = subData.items?.data?.[0]?.price?.id;
  const newPlanId = priceId ? getPlanIdFromPriceId(priceId) : null;

  await updateSubscription(subscriptionRecord.userId, {
    status: subData.status,
    cancelAtPeriodEnd: subData.cancel_at_period_end,
    currentPeriodStart: subData.current_period_start
      ? new Date(subData.current_period_start * 1000)
      : new Date(),
    currentPeriodEnd: subData.current_period_end
      ? new Date(subData.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...(newPlanId && { plan: newPlanId, stripePriceId: priceId }),
  });

  // プランが変更された場合、UserSettingsも更新
  if (newPlanId && newPlanId !== subscriptionRecord.plan) {
    await prisma.userSettings.update({
      where: { userId: subscriptionRecord.userId },
      data: { plan: newPlanId },
    });
  }
}

/**
 * サブスクリプション削除時の処理
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!subscriptionRecord) {
    return;
  }

  // ステータスを更新
  await updateSubscription(subscriptionRecord.userId, {
    status: 'canceled',
  });

  console.log(`Subscription canceled for user ${subscriptionRecord.userId}`);
}
