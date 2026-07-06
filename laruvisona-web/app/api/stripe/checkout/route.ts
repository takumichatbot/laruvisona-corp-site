import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { provisionLarubotOnPlan } from '@/lib/larubot-provision';

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_PRICE_ID,
  'hp-bot': process.env.STRIPE_BUNDLE_BOT_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_BUNDLE_FULL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_PRICE_ID,
  lite: process.env.STRIPE_LITE_PRICE_ID, // ¥2,980 専用 Price ID（未設定だと lite は購入不可・過剰請求を防ぐ）
};

// Annual price IDs — create these in Stripe Dashboard as yearly prices (approx 20% discount)
const PLAN_ANNUAL_PRICE_MAP: Record<string, string | undefined> = {
  hp: process.env.STRIPE_HP_ANNUAL_PRICE_ID,
  'hp-bot': process.env.STRIPE_BOT_ANNUAL_PRICE_ID,
  'hp-bot-seo': process.env.STRIPE_FULL_ANNUAL_PRICE_ID,
  agency: process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID,
  lite: process.env.STRIPE_LITE_ANNUAL_PRICE_ID, // ¥2,980 の年払い Price ID
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

  const resolvedPriceId = isAnnual ? PLAN_ANNUAL_PRICE_MAP[plan] : PLAN_PRICE_MAP[plan];
  // 月払い価格へのフォールバックはしない（表示と請求の食い違い＝誤課金を防ぐ）
  if (!resolvedPriceId) {
    return NextResponse.json(
      { error: isAnnual ? '年払いは現在準備中です。月払いをご利用ください。' : 'Invalid plan' },
      { status: 400 }
    );
  }

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, business_name, stripe_subscription_id, subscription_status, plan')
    .eq('id', user.id)
    .single();

  // 既に契約中なら「新規サブスク作成」ではなく既存サブスクの価格を差し替える（日割り）。
  // これをしないと2本目のサブスクが作られて二重課金になる（旧サブスクは請求され続ける）。
  if (profile?.stripe_subscription_id && profile.subscription_status !== 'canceled') {
    try {
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      const reusable = !['canceled', 'incomplete_expired'].includes(sub.status);
      if (reusable) {
        const item = sub.items.data[0];
        if (!item) {
          return NextResponse.json({ error: 'サブスクリプションの構成を確認できませんでした。サポートにお問い合わせください。' }, { status: 500 });
        }
        if (item.price.id === resolvedPriceId) {
          return NextResponse.json({ error: '既にこのプランをご利用中です。' }, { status: 400 });
        }
        await stripe.subscriptions.update(profile.stripe_subscription_id, {
          items: [{ id: item.id, price: resolvedPriceId }],
          proration_behavior: 'create_prorations',
          metadata: { ...(sub.metadata || {}), plan, billing },
        });
        await supabase.from('profiles').update({ plan }).eq('id', user.id);

        // LARUbot なし → あり への切替時のみ LARUbot を自動登録（決済処理は止めない）
        try {
          await provisionLarubotOnPlan({ userId: user.id, email: user.email, plan, siteId, prevPlan: profile.plan });
        } catch (e) {
          console.error('[stripe/checkout] LARUbot provision on upgrade failed:', e);
        }

        return NextResponse.json({ upgraded: true, plan });
      }
    } catch (err) {
      // 旧サブスクが取得できない等は新規契約フローにフォールバック
      console.error('[stripe/checkout] existing subscription check failed, falling back to new checkout:', err);
    }
  }

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
