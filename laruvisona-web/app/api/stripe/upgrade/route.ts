import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
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

  return NextResponse.json({ ok: true, plan });
}
