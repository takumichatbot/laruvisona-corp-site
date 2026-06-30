import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  const { priceId, siteUrl } = await req.json().catch(() => ({})) as { priceId?: string; siteUrl?: string };
  if (!priceId) return NextResponse.json({ error: 'priceId required' }, { status: 400 });

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/buy] STRIPE_SECRET_KEY is not set');
    return NextResponse.json({ error: '決済が設定されていません（管理者にお問い合わせください）' }, { status: 500 });
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
  const base = (siteUrl || origin || 'https://laruvisona.jp/').split('?')[0];

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
    return NextResponse.json(
      { error: e?.message || '決済の開始に失敗しました', code: e?.code },
      { status: 500 }
    );
  }
}
