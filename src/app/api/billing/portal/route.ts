import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCustomerPortalSession } from '@/lib/stripe';
import { getSubscription } from '@/lib/credits';

/**
 * POST: Stripe Customer Portal セッションを作成
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const subscription = await getSubscription(user.id);

    if (!subscription || !subscription.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 400 }
      );
    }

    const portalUrl = await createCustomerPortalSession(
      subscription.stripeCustomerId
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error: unknown) {
    console.error('Failed to create portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
