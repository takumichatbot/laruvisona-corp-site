import { NextResponse } from 'next/server';
import { verifyPrice } from '@/lib/price-integrity';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { provisionLarubotOnPlan } from '@/lib/larubot-provision';
import { alertLarubotFailure } from '@/lib/larubot-alert';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';

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

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 10_000); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  if (typeof body.plan !== 'string' || Object.keys(body).some(key => key !== 'plan')) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }
  const plan = body.plan;
  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  // 画面に出した額と、Stripeが請求する額が違うまま切り替えない（checkout と同じ）。
  try {
    const price = await stripe.prices.retrieve(priceId);
    const verdict = verifyPrice(plan, 'monthly', price);
    if (!verdict.ok) {
      console.error('[stripe/upgrade] 表示額とStripeの価格が一致しません', { plan, reason: verdict.reason });
      return NextResponse.json({ error: '料金の設定を確認しています。少し時間をおいてお試しください。' }, { status: 503 });
    }
  } catch (err) {
    console.error('[stripe/upgrade] 価格を確認できませんでした:', (err as Error)?.message);
    return NextResponse.json({ error: '料金を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
  }

  const rate = await claimPublicRate(createServiceClient(), 'plan-billing', user.id, 1, 60);
  if (rate === 'limited') return NextResponse.json({ error: '少し待ってからお試しください' }, { status: 429 });
  if (rate === 'unavailable') return NextResponse.json({ error: '決済受付を確認できません' }, { status: 503 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, plan')
    .eq('id', user.id)
    .single();

  // 契約元を読めないまま「契約なし」とみなすと、利用者には再試行可能な404に見え、
  // DB復旧後の実状態と食い違う。Stripeへ触る前に障害として止める。
  if (profileError) {
    return NextResponse.json({ error: '現在の契約を確認できませんでした' }, { status: 503 });
  }

  if (!profile?.stripe_subscription_id || !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  if (profile.plan === plan) {
    return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
  }

  // Get current subscription
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  } catch (error) {
    console.error('[stripe/upgrade] subscription lookup failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Stripe契約を確認できませんでした' }, { status: 503 });
  }
  const itemId = subscription.items.data[0]?.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  if (!itemId || subscription.items.data.length !== 1 || customerId !== profile.stripe_customer_id
    || ['canceled', 'incomplete_expired'].includes(subscription.status)) {
    return NextResponse.json({ error: 'Stripe契約の内容を確認してください' }, { status: 409 });
  }
  const currentPrice = subscription.items.data[0].price.id;
  if (currentPrice === priceId) return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });

  // Update subscription item to new price (prorate immediately)
  try {
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...(subscription.metadata || {}), plan },
    }, { idempotencyKey: `laruhp-upgrade-${subscription.id}-${currentPrice}-${priceId}` });
  } catch (error) {
    console.error('[stripe/upgrade] subscription update failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Stripeのプラン変更を確定できませんでした' }, { status: 502 });
  }

  // Update profile plan immediately
  const saved = await supabase.from('profiles').update({ plan }).eq('id', user.id).select('id');
  if (saved.error || saved.data?.length !== 1) {
    return NextResponse.json({ error: 'プラン変更を保存できませんでした。決済状態を確認しています。' }, { status: 503 });
  }

  // LARUbot なし → あり への切替時のみ LARUbot を自動登録（アップグレード処理は止めない）
  try {
    await provisionLarubotOnPlan({ userId: user.id, email: user.email, plan, prevPlan: profile.plan });
  } catch (e) {
    await alertLarubotFailure({
      kind: 'register', userId: user.id, plan, reason: (e as Error)?.message || 'unknown',
    });
  }

  return NextResponse.json({ ok: true, plan });
}
