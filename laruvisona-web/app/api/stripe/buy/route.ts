import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clientIp } from '@/lib/rate-limit';
import { safeReturnUrl } from '@/lib/site-origin';
import { readContactBody } from '@/lib/contact-contract';
import { createServiceClient } from '@/lib/supabase/server';
import { claimPublicRate } from '@/lib/public-rate-limit';

export async function POST(req: Request) {
  let input: { priceId?: string; siteUrl?: string };
  try { input = await readContactBody(req, 10_000) as typeof input; }
  catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const { priceId, siteUrl } = input;
  if (!priceId || !/^price_[A-Za-z0-9]+$/.test(priceId)) return NextResponse.json({ error: 'priceId required' }, { status: 400 });

  const rate = await claimPublicRate(createServiceClient(), 'stripe-buy', clientIp(req), 20);
  if (rate === 'limited') {
    return NextResponse.json(
      { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
      { status: 429 },
    );
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '購入受付を確認できません' }, { status: 503 });

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/buy] STRIPE_SECRET_KEY is not set');
    return NextResponse.json({ error: '決済が設定されていません（管理者にお問い合わせください）' }, { status: 500 });
  }

  // この旧APIは運営Stripeへ直接入金され、店舗の注文台帳も作らない。
  // 公開サイトの新規販売はConnect対応ショップを使う。既存の運営商品だけは
  // サーバー側allowlistへ明示したPrice IDに限って互換提供する。
  const allowedPrices = new Set((process.env.STRIPE_PUBLIC_BUY_PRICE_IDS || '')
    .split(',').map(value => value.trim()).filter(value => /^price_[A-Za-z0-9]+$/.test(value)));
  if (allowedPrices.size === 0) {
    return NextResponse.json({ error: 'この決済方法は現在利用できません。ショップ機能をご利用ください。' }, { status: 503 });
  }
  if (!allowedPrices.has(priceId)) {
    return NextResponse.json({ error: 'この商品は現在購入できません。' }, { status: 400 });
  }

  // 決済後の戻り先。siteUrl はクライアントの言い値なので、そのまま使うと
  // 決済を終えた利用者を攻撃者のドメインへ飛ばせる（オープンリダイレクト）。
  // このAPIは本体サイトの購読ボタン用なので、本体のホストだけを許可する。
  const base = safeReturnUrl(siteUrl, req.headers.get('origin'), {});

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 価格が継続課金(subscription)か単発(payment)かを判定して mode を切り替える
    const price = await stripe.prices.retrieve(priceId);
    const mode: Stripe.Checkout.SessionCreateParams.Mode = price.recurring ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}?payment=success`,
      cancel_url: `${base}?payment=canceled`,
      locale: 'ja',
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const e = err as { message?: string; code?: string; type?: string };
    // 多くは priceId がキーのモード/アカウントに存在しない（test鍵にlive priceID等）
    console.error('[stripe/buy] error:', e?.type, e?.code, e?.message);
    // Stripeの生メッセージは英語かつ priceID・key mode 等の内部情報を含むため顧客には返さない
    const friendly = (e?.code === 'resource_missing' || e?.type === 'StripeInvalidRequestError')
      ? 'この商品は現在購入できません。お手数ですがサイト運営者にお問い合わせください。'
      : '決済の開始に失敗しました。しばらくしてからもう一度お試しください。';
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
