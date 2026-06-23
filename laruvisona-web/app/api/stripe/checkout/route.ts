import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_BUNDLE_BOT_PRICE_ID, // lite は hp-bot と同じ Price ID
};

// Annual price IDs — create these in Stripe Dashboard as yearly prices (approx 20% discount)
const PLAN_ANNUAL_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_HP_ANNUAL_PRICE_ID,
  'hp-bot': process.env.STRIPE_BOT_ANNUAL_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_FULL_ANNUAL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID,
  lite: process.env.STRIPE_BOT_ANNUAL_PRICE_ID, // lite は hp-bot と同じ Annual Price ID
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId, plan = 'hp', billing = 'monthly' } = await req.json().catch(() => ({}));
  const isAnnual = billing === 'annual';
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL;

  const priceId = isAnnual ? PLAN_ANNUAL_PRICE_MAP[plan] : PLAN_PRICE_MAP[plan];
  // Annual price not configured yet — fall back to monthly
  const resolvedPriceId = priceId ?? (isAnnual ? PLAN_PRICE_MAP[plan] : undefined);
  if (!resolvedPriceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, business_name')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.business_name || user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const sessionMeta = {
    supabase_user_id: user.id,
    site_id: siteId || '',
    plan,
  };

  // 月払いのみ初月無料クーポン適用（年払いは割引価格自体で節約）
  const couponId = !isAnnual ? process.env.STRIPE_FIRST_MONTH_COUPON_ID : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      metadata: sessionMeta,
      subscription_data: {
        metadata: {
          ...sessionMeta,
          contract_months: isAnnual ? '12' : '6',
          billing: billing,
        },
      },
      success_url: `${origin}/laruHP/dashboard?payment=success`,
      cancel_url: `${origin}/laruHP/plans?payment=canceled`,
      locale: 'ja',
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const stripeErr = err as { message?: string; code?: string };
    console.error('[stripe/checkout] error:', stripeErr?.code, stripeErr?.message);
    return NextResponse.json(
      { error: stripeErr?.message || 'Stripe error', code: stripeErr?.code },
      { status: 500 }
    );
  }
}
