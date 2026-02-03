import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { constructWebhookEvent, getPlanIdFromPriceId } from '@/lib/stripe';
import {
  grantPlanCredit,
  addPurchasedCredit,
  updateSubscription,
} from '@/lib/credits';
import { PLANS } from '@/lib/plans';
import { prisma } from '@/lib/db';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * Webhookイベントの冪等性チェック
 * 既に処理済みのイベントはスキップ、処理中のイベントは待機
 */
async function checkAndLockEvent(eventId: string, eventType: string): Promise<{ shouldProcess: boolean; eventRecord?: any }> {
  try {
    // 既存のイベントレコードを確認
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId }
    });

    if (existingEvent) {
      // 既に完了しているイベントはスキップ
      if (existingEvent.status === 'completed') {
        console.log(`[Webhook] Event ${eventId} already processed, skipping`);
        return { shouldProcess: false };
      }
      // 処理中のイベントもスキップ（重複リクエスト）
      if (existingEvent.status === 'processing') {
        console.log(`[Webhook] Event ${eventId} is being processed, skipping`);
        return { shouldProcess: false };
      }
      // failedの場合は再処理を許可（リトライ）
    }

    // 新規イベントの場合、または再処理の場合はロックを取得
    const eventRecord = await prisma.webhookEvent.upsert({
      where: { eventId },
      update: {
        status: 'processing',
        updatedAt: new Date()
      },
      create: {
        eventId,
        eventType,
        status: 'processing'
      }
    });

    return { shouldProcess: true, eventRecord };
  } catch (error: any) {
    // ユニーク制約違反の場合（同時リクエスト）
    if (error.code === 'P2002') {
      console.log(`[Webhook] Concurrent request for event ${eventId}, skipping`);
      return { shouldProcess: false };
    }
    throw error;
  }
}

/**
 * Webhookイベントの完了をマーク
 */
async function markEventCompleted(eventId: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: 'completed',
      processedAt: new Date()
    }
  });
}

/**
 * Webhookイベントの失敗をマーク
 */
async function markEventFailed(eventId: string, error: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: 'failed',
      error
    }
  });
}

// Supabase Admin Client（ユーザー作成用）
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


/**
 * Stripe Webhook処理
 *
 * 処理するイベント:
 * - checkout.session.completed: サブスク開始 / クレジット購入完了 / 新規ユーザー作成
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

  // 冪等性チェック：既に処理済みのイベントはスキップ
  const { shouldProcess, eventRecord } = await checkAndLockEvent(event.id, event.type);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, skipped: true });
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

    // イベント処理完了をマーク
    await markEventCompleted(event.id);

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('Webhook handler error:', error);

    // イベント処理失敗をマーク
    await markEventFailed(event.id, error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Checkout Session完了時の処理
 * 新規ユーザー登録フローと既存ユーザーのサブスク開始を両方処理
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {};
  const supabaseAdmin = getSupabaseAdmin();

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
    const email = metadata.email || session.customer_email;

    if (!email) {
      console.error('No email in checkout session');
      return;
    }

    let userId: string;
    let existingUser = null;

    // メールアドレスでSupabaseユーザーを検索
    // Supabase Admin APIにはgetUserByEmailがないため、
    // まず作成を試み、既存ユーザーエラーの場合はlistUsersでページング検索
    // 注意: listUsersは大量ユーザー時に遅いが、Supabase側の制限
    try {
      // ページングで効率的に検索（最大1000件ずつ）
      let page = 1;
      const perPage = 1000;
      while (!existingUser) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage,
        });
        if (error || !data?.users?.length) break;

        existingUser = data.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (data.users.length < perPage) break; // 最後のページ
        page++;
        if (page > 10) break; // 安全のため10ページ（1万件）で打ち切り
      }
    } catch (err) {
      console.log('User lookup failed, will create new user:', err);
    }

    if (existingUser) {
      // 既存ユーザー
      userId = existingUser.id;
      console.log(`Existing user found: ${userId}`);
    } else {
      // 新規ユーザー作成（パスワードなし = 初期状態）
      // ユーザーは後でパスワード設定リンクからパスワードを設定する
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true, // メール確認をスキップ
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return;
      }

      userId = newUser.user.id;
      console.log(`New user created: ${userId}, email: ${email}`);

      // Stripe CustomerメタデータにuserIdのみ保存（パスワードは保存しない）
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-12-15.clover',
      });
      await stripe.customers.update(customerId, {
        metadata: {
          userId,
        },
      });

      // パスワード設定リンクを生成（recovery = パスワードリセット機能を流用）
      // リトライ機能付き（最大3回）
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://xn--lp-xv5crjy08r.com';
      const planName = plan?.name || planId;

      let emailSent = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
              redirectTo: `${baseUrl}/welcome?setup=true`,
            },
          });

          if (linkError || !linkData?.properties?.action_link) {
            console.error(`[Attempt ${attempt}/3] Failed to generate password setup link:`, linkError);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s待機
              continue;
            }
          } else {
            // ウェルカムメールでパスワード設定リンクを送信
            const emailResult = await sendWelcomeEmail({
              to: email,
              planName,
              passwordSetupUrl: linkData.properties.action_link,
            });

            if (emailResult.success) {
              console.log(`Welcome email with password setup link sent to ${email}`);
              emailSent = true;
              break;
            } else {
              console.error(`[Attempt ${attempt}/3] Failed to send welcome email:`, emailResult.error);
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
              }
            }
          }
        } catch (err) {
          console.error(`[Attempt ${attempt}/3] Error in password setup flow:`, err);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (!emailSent) {
        // 全リトライ失敗時、DBにフラグを記録して後で手動対応できるようにする
        console.error(`CRITICAL: Failed to send welcome email to ${email} after 3 attempts. Manual intervention required.`);
        await prisma.userSettings.upsert({
          where: { userId },
          update: { welcomeEmailPending: true },
          create: { userId, email, plan: planId, welcomeEmailPending: true },
        });
      }
    }

    // サブスクリプション情報を保存
    await updateSubscription(userId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: plan?.stripePriceId,
      plan: planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // UserSettingsを作成/更新
    await prisma.userSettings.upsert({
      where: { userId },
      update: {
        plan: planId,
        email,
      },
      create: {
        userId,
        plan: planId,
        email,
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
    // 既存ユーザーのuserIdが必要
    const userId = metadata.userId;
    if (!userId) {
      console.error('No userId in payment session metadata');
      return;
    }

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
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!subscriptionRecord) {
    return;
  }

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
