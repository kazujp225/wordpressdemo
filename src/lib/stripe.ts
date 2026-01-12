/**
 * Stripe統合
 * サブスクリプションとクレジット購入
 */

import Stripe from 'stripe';
import { PLANS, CREDIT_PACKAGES, type PlanType } from './plans';

// Stripeクライアント初期化
// TODO: 本番実装時にAPIバージョンを確認
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// ベースURL
const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Stripe Customerを作成または取得
 */
export async function getOrCreateCustomer(
  email: string,
  userId: string,
  name?: string
): Promise<string> {
  // 既存のCustomerを検索
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // 新規作成
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });

  return customer.id;
}

/**
 * サブスクリプション作成用Checkout Session
 */
export async function createSubscriptionCheckout(
  userId: string,
  email: string,
  planId: PlanType,
  customerId?: string
): Promise<string> {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // Customerを取得または作成
  const stripeCustomerId = customerId || (await getOrCreateCustomer(email, userId));

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${getBaseUrl()}/admin/settings?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/admin/settings?subscription=canceled`,
    metadata: {
      userId,
      planId,
    },
    subscription_data: {
      metadata: {
        userId,
        planId,
      },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    payment_method_types: ['card'],
    locale: 'ja',
  });

  return session.url!;
}

/**
 * 追加クレジット購入用Checkout Session
 */
export async function createCreditPurchaseCheckout(
  userId: string,
  email: string,
  packageId: number,
  customerId?: string
): Promise<string> {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) {
    throw new Error(`Invalid package: ${packageId}`);
  }

  // Customerを取得または作成
  const stripeCustomerId = customerId || (await getOrCreateCustomer(email, userId));

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'jpy',
          product_data: {
            name: `APIクレジット購入 (${pkg.name})`,
            description: `$${pkg.creditUsd.toFixed(2)}分のAPIクレジット`,
          },
          unit_amount: pkg.priceJpy,
        },
        quantity: 1,
      },
    ],
    success_url: `${getBaseUrl()}/admin/settings?credit=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getBaseUrl()}/admin/settings?credit=canceled`,
    metadata: {
      userId,
      packageId: packageId.toString(),
      creditUsd: pkg.creditUsd.toString(),
      packageName: pkg.name,
    },
    payment_method_types: ['card'],
    locale: 'ja',
  });

  return session.url!;
}

/**
 * サブスクリプションのキャンセル
 */
export async function cancelSubscription(
  stripeSubscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    // 期間終了時にキャンセル
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    // 即時キャンセル
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }
}

/**
 * サブスクリプションの再開（キャンセル取り消し）
 */
export async function resumeSubscription(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * プラン変更
 */
export async function changeSubscriptionPlan(
  stripeSubscriptionId: string,
  newPlanId: PlanType
): Promise<Stripe.Subscription> {
  const plan = PLANS[newPlanId];
  if (!plan) {
    throw new Error(`Invalid plan: ${newPlanId}`);
  }

  // 現在のサブスクリプションを取得
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0].id;

  // プランを変更
  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [
      {
        id: itemId,
        price: plan.stripePriceId,
      },
    ],
    proration_behavior: 'create_prorations',
    metadata: {
      planId: newPlanId,
    },
  });
}

/**
 * サブスクリプション情報を取得
 */
export async function getSubscriptionDetails(
  stripeSubscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch {
    return null;
  }
}

/**
 * Customer Portal セッションを作成
 */
export async function createCustomerPortalSession(
  stripeCustomerId: string,
  returnUrl?: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || `${getBaseUrl()}/admin/settings`,
  });

  return session.url;
}

/**
 * Webhook署名検証
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET || ''
  );
}

/**
 * Price IDからプランIDを特定
 */
export function getPlanIdFromPriceId(priceId: string): PlanType | null {
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === priceId) {
      return planId as PlanType;
    }
  }
  return null;
}

/**
 * Checkout Session詳細を取得
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}
