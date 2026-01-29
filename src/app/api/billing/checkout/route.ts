import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PLANS, type PlanType } from '@/lib/plans';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

// Stripeクライアント
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
  });
}

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * ランダムパスワード生成（12文字）
 */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  const randomBytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

/**
 * POST: 未認証ユーザー向けCheckout Session作成
 * メールアドレスとプランIDを受け取り、Stripe Checkoutセッションを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, planId } = body as { email: string; planId: string };

    // バリデーション
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    // freeプランは受け付けない
    if (planId === 'free' || !planId || !(planId in PLANS)) {
      return NextResponse.json(
        { error: '有効なプランを選択してください' },
        { status: 400 }
      );
    }

    const plan = PLANS[planId as PlanType];

    // 自動生成パスワード
    const tempPassword = generatePassword();

    const stripe = getStripe();

    // Stripe Customerを検索または作成
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    let customerId: string;
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { tempPassword }, // 一時的にパスワードを保存
      });
      customerId = customer.id;
    }

    // メタデータにパスワードを保存（Customerが既存の場合も更新）
    await stripe.customers.update(customerId, {
      metadata: { tempPassword },
    });

    // Checkout Session作成
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${getBaseUrl()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/?canceled=true`,
      metadata: {
        email,
        planId,
        tempPassword, // Webhook側でパスワードを取得するため
      },
      subscription_data: {
        metadata: {
          email,
          planId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      payment_method_types: ['card'],
      locale: 'ja',
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Failed to create checkout session:', error);
    return NextResponse.json(
      { error: '決済セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
