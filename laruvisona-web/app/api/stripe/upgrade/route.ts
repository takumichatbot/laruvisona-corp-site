import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { provisionLarubotOnPlan } from '@/lib/larubot-provision';

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_LITE_PRICE_ID, // ¥2,980 専用 Price ID（checkoutと同一。hp-bot価格を誤請求しない）
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await req.json();
  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, plan')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  if (profile.plan === plan) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
  }

  // Get current subscription
  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) return NextResponse.json({ error: 'No subscription item' }, { status: 500 });

  // Update subscription item to new price (prorate immediately)
  await stripe.subscriptions.update(profile.stripe_subscription_id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: { plan },
  });

  // Update profile plan immediately
  await supabase.from('profiles').update({ plan }).eq('id', user.id);

  // LARUbot なし → あり への切替時のみ LARUbot を自動登録（アップグレード処理は止めない）
  try {
    await provisionLarubotOnPlan({ userId: user.id, email: user.email, plan, prevPlan: profile.plan });
  } catch (e) {
    console.error('[stripe/upgrade] LARUbot provision failed:', e);
  }

  return NextResponse.json({ ok: true, plan });
}
