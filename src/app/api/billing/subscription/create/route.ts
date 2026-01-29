import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSubscriptionCheckout } from '@/lib/stripe';
import { PLANS } from '@/lib/plans';

/**
 * POST: サブスクリプション購入のCheckout Sessionを作成
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
    const { planId } = body as { planId: string };

    // プランの存在確認
    if (!planId || !(planId in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Checkout Sessionを作成
    const checkoutUrl = await createSubscriptionCheckout(
      user.id,
      user.email,
      planId
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
