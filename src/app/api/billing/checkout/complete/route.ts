import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PLANS } from '@/lib/plans';

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

/**
 * GET: Checkout Session完了後の情報取得
 * session_idからユーザー情報とパスワードを取得
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'session_idが必要です' },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();

    // Checkout Sessionを取得
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: '決済が完了していません' },
        { status: 400 }
      );
    }

    const customer = session.customer as Stripe.Customer;
    const sessionMetadata = session.metadata || {};
    const customerMetadata = customer?.metadata || {};

    const email = session.customer_email || sessionMetadata.email || customer?.email || '';

    // パスワードはSessionメタデータから取得（Checkout作成時に設定）
    // Webhookで処理後はCustomerメタデータにも設定される
    const password = sessionMetadata.tempPassword || customerMetadata.tempPassword || '';

    const planId = sessionMetadata.planId || 'pro';
    const plan = PLANS[planId as keyof typeof PLANS];

    // 新規ユーザーかどうか（パスワードがあれば新規）
    const isNewUser = !!password;

    return NextResponse.json({
      email,
      password, // パスワードは常に返す（あれば）
      planName: plan?.name || planId,
      isNewUser,
    });
  } catch (error: unknown) {
    console.error('Failed to get checkout session:', error);
    return NextResponse.json(
      { error: '情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
