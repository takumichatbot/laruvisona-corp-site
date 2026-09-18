import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { provisionLarubotOnPlan } from '@/lib/larubot-provision';
import { alertLarubotFailure } from '@/lib/larubot-alert';
import { billingAppOrigin } from '@/lib/billing-url';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';
import { verifyPrice, verifyFirstMonthCoupon } from '@/lib/price-integrity';
import { createHash } from 'node:crypto';
import type Stripe from 'stripe';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 二度押しで2つ作らないための鍵。
 *
 * 2026-09-17まで `laruhp-checkout-<利用者>-<プラン>-<支払方法>` の**固定**だった。
 * Stripe は鍵を24時間覚えていて、**同じ鍵で中身が少しでも違うと拒否する。**
 * 実際に本番で出た文面がこれ:
 *
 *   Keys for idempotent requests can only be used with the same parameters
 *   they were first used with. Try using a key other than
 *   'laruhp-checkout-159ff404-...-hp-monthly'
 *
 * どういうときに中身が変わるか。
 *   ・別のサイトの「公開する」から入った（戻り先URLに siteId が入る）
 *   ・初月無料クーポンの有無が変わった
 *   ・値段を変えた
 * つまり **一度やめたお客様が、24時間以内に別の入口から入り直すと、
 * 二度と買えない。** 出るのは英語のエラーで、こちらの利用者IDまで載っていた。
 *
 * 中身から鍵を作れば、同じ注文は1つに、違う注文は別々になる。それが本来の形。
 */
function checkoutKey(userId: string, params: unknown): string {
  const digest = createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 32);
  return `laruhp-checkout-${userId}-${digest}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let input: Record<string, unknown>;
  try { input = await readContactBody(req, 10_000); }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const { siteId, plan: rawPlan = 'hp', billing: rawBilling = 'monthly', returnTo: rawReturnTo } = input;
  /*
    支払ったあと、どの画面へ戻すか。

    これまでは必ず builder（これまでの編集画面）へ戻していた。ところが
    新しく登録した人が通るのは studio（制作画面）で、**見たこともない画面に
    放り出されていた。** 払った直後にそれをやると、そこで手が止まる。

    受け取るのは決め打ちの2つだけ。外から任意のURLを入れさせない。
  */
  const returnTo = rawReturnTo === 'studio' ? 'studio' : 'builder';
  if (typeof rawPlan !== 'string' || typeof rawBilling !== 'string') return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  const plan = rawPlan;
  const billing = rawBilling;
  if (billing !== 'monthly' && billing !== 'annual') return NextResponse.json({ error: 'Invalid billing' }, { status: 400 });
  const isAnnual = billing === 'annual';
  const origin = billingAppOrigin();

  let ownedSiteId = '';
  if (siteId !== undefined && siteId !== null && siteId !== '') {
    if (typeof siteId !== 'string' || !UUID.test(siteId)) {
      return NextResponse.json({ error: 'Invalid site' }, { status: 400 });
    }
    const owned = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).maybeSingle();
    if (owned.error) return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
    if (!owned.data) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    ownedSiteId = owned.data.id;
  }

  const rate = await claimPublicRate(createServiceClient(), 'plan-billing', user.id, 1, 60);
  if (rate === 'limited') return NextResponse.json({ error: '少し待ってからお試しください' }, { status: 429 });
  if (rate === 'unavailable') return NextResponse.json({ error: '決済受付を確認できません' }, { status: 503 });

  const resolvedPriceId = isAnnual ? PLAN_ANNUAL_PRICE_MAP[plan] : PLAN_PRICE_MAP[plan];
  // 月払い価格へのフォールバックはしない（表示と請求の食い違い＝誤課金を防ぐ）
  if (!resolvedPriceId) {
    return NextResponse.json(
      { error: isAnnual ? '年払いは現在準備中です。月払いをご利用ください。' : 'Invalid plan' },
      { status: 400 }
    );
  }
  // 画面に出した額と、Stripeが実際に請求する額が違うまま売らない。
  // （2026-09-16、年払いが画面9,990円／Stripe9,999円になっていた）
  try {
    const price = await stripe.prices.retrieve(resolvedPriceId);
    const verdict = verifyPrice(plan, isAnnual ? 'annual' : 'monthly', price);
    if (!verdict.ok) {
      console.error('[stripe/checkout] 表示額とStripeの価格が一致しません', { plan, billing, reason: verdict.reason });
      return NextResponse.json({ error: '料金の設定を確認しています。少し時間をおいてお試しください。' }, { status: 503 });
    }
  } catch (err) {
    console.error('[stripe/checkout] 価格を確認できませんでした:', (err as Error)?.message);
    return NextResponse.json({ error: '料金を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
  }

  const couponId = !isAnnual ? process.env.STRIPE_FIRST_MONTH_COUPON_ID : undefined;
  if (!isAnnual && !couponId) {
    // 画面で初月無料を約束しているため、クーポン無しの通常請求には退化させない。
    return NextResponse.json({ error: '初月無料の決済設定を確認中です。時間をおいてお試しください。' }, { status: 503 });
  }
  // クーポンが本当に「そのプランを無料にする」ものかを、売る前に確かめる。
  // 固定額クーポンだと、高いプランでは初月無料にならない。
  if (couponId) {
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      const couponVerdict = verifyFirstMonthCoupon(plan, coupon);
      if (!couponVerdict.ok) {
        console.error('[stripe/checkout] 初月無料のクーポンが表示と一致しません', { plan, reason: couponVerdict.reason });
        return NextResponse.json({ error: '初月無料の設定を確認しています。少し時間をおいてお試しください。' }, { status: 503 });
      }
    } catch (err) {
      console.error('[stripe/checkout] クーポンを確認できませんでした:', (err as Error)?.message);
      return NextResponse.json({ error: '初月無料の設定を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
    }
  }

  // Get or create Stripe customer
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, business_name, stripe_subscription_id, subscription_status, plan')
    .eq('id', user.id)
    .single();
  // 契約状態を読めないままStripe側へ進むと、既存顧客・契約を見落として
  // 外部に重複した顧客や請求を作り得る。読み取り失敗時は外部作用の前で止める。
  if (profileError || !profile) {
    return NextResponse.json({ error: '現在の契約を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
  }

  // 既に契約中なら「新規サブスク作成」ではなく既存サブスクの価格を差し替える（日割り）。
  // これをしないと2本目のサブスクが作られて二重課金になる（旧サブスクは請求され続ける）。
  if (profile?.stripe_subscription_id) {
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
        const saved = await supabase.from('profiles').update({ plan }).eq('id', user.id).select('id');
        if (saved.error || saved.data?.length !== 1) {
          return NextResponse.json({ error: 'プラン変更を保存できませんでした。決済状態を確認しています。' }, { status: 503 });
        }

        // LARUbot なし → あり への切替時のみ LARUbot を自動登録（決済処理は止めない）
        try {
          await provisionLarubotOnPlan({ userId: user.id, email: user.email, plan, siteId: ownedSiteId || undefined, prevPlan: profile.plan });
        } catch (e) {
          // 決済は止めない。ただし運営には届ける（ログだけでは誰も見ない）。
          await alertLarubotFailure({
            kind: 'register', userId: user.id, plan, siteId: ownedSiteId || null,
            reason: (e as Error)?.message || 'unknown',
          });
        }

        return NextResponse.json({ upgraded: true, plan });
      }
    } catch (err) {
      // 既存契約を確認できないまま新しい契約を作ると二重請求になり得る。
      console.error('[stripe/checkout] existing subscription check failed:', (err as Error)?.message);
      return NextResponse.json({ error: '現在の契約を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
    }
  }

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.business_name || user.email,
      metadata: { supabase_user_id: user.id },
    }, { idempotencyKey: `laruhp-customer-${user.id}` });
    customerId = customer.id;
    const linked = await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id).select('id');
    if (linked.error || linked.data?.length !== 1) {
      return NextResponse.json({ error: '決済利用者を保存できませんでした。時間をおいてお試しください。' }, { status: 503 });
    }
  }

  // 保存済みIDが欠落・古い場合でも、同じ顧客に有効な契約が残っていれば
  // 新しい契約を作らない。手動確認でDBとStripeを同期してから再開する。
  if (customerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
      const live = subscriptions.data.find(sub => !['canceled', 'incomplete_expired'].includes(sub.status));
      if (live && live.id !== profile?.stripe_subscription_id) {
        return NextResponse.json({ error: '既存の契約が見つかりました。契約状態を確認しています。' }, { status: 409 });
      }
    } catch (err) {
      console.error('[stripe/checkout] customer subscriptions check failed:', (err as Error)?.message);
      return NextResponse.json({ error: '現在の契約を確認できませんでした。時間をおいてお試しください。' }, { status: 503 });
    }
  }

  const sessionMeta = {
    supabase_user_id: user.id,
    site_id: ownedSiteId,
    plan,
  };

  // 月払いのみ初月無料クーポン適用（年払いは割引価格自体で節約）
  try {
    const sessionParams = {
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
      // 契約したあとは、作りかけのサイトへ戻す。
      // 「公開」を押して料金画面が出て、支払ったのにダッシュボードへ放り出されると、
      // 何を押せば公開できるのかが分からないまま終わる。
      success_url: ownedSiteId
        ? (returnTo === 'studio'
          ? `${origin}/laruHP/studio?siteId=${ownedSiteId}&step=edit&payment=success`
          : `${origin}/laruHP/builder?siteId=${ownedSiteId}&payment=success`)
        : `${origin}/laruHP/dashboard?payment=success`,
      cancel_url: `${origin}/laruHP/plans?payment=canceled`,
      locale: 'ja',
    } satisfies Stripe.Checkout.SessionCreateParams;
    const session = await stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: checkoutKey(user.id, sessionParams) },
    );
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const stripeErr = err as { message?: string; code?: string };
    // 生の文面をそのまま返していた。英語のうえ、こちらの利用者IDまで載る。
    console.error('[stripe/checkout] error:', stripeErr?.code, stripeErr?.message);
    return NextResponse.json(
      { error: 'お支払い画面を開けませんでした。少し時間をおいてお試しください。', code: stripeErr?.code || 'stripe_error' },
      { status: 500 },
    );
  }
}
