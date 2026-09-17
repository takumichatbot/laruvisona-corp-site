import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { billingAppOrigin } from '@/lib/billing-url';
import { billingPortalMode } from '@/lib/billing-portal-mode';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, contract_starts_at, subscription_status')
    .eq('id', user.id)
    .single();

  if (profileError) return NextResponse.json({ error: '契約情報を確認できませんでした' }, { status: 503 });

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const returnUrl = `${billingAppOrigin()}/laruHP/dashboard`;

  // 最低契約期間中もカード変更は必要になり得る。通常のポータルを開くと
  // Stripe側の設定次第で早期解約できるため、この期間だけ支払方法変更の
  // 単一フローへ閉じる。契約期間後は通常の管理ポータルを開く。
  //
  // 判定は契約の始まりから数える。以前は contract_ends_at（今の請求期間の
  // 終わり）を見ていたため、支払うたびに未来へ動き、最低利用期間を過ぎても
  // 解約画面が永久に開かなかった。
  const { paymentMethodOnly, cancelableFrom } = billingPortalMode(profile);

  // Stripe側が失敗したとき、ここで捕まえずに投げると Next が本文の無い500を返す。
  // 画面は res.json() で例外になり、読み込み解除まで到達せず「処理中」のまま止まる。
  // 押した人には何も出ない。理由の分かる本文を必ず返す。
  let portalSession: { url: string };
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
      ...(paymentMethodOnly ? {
        flow_data: {
          type: 'payment_method_update' as const,
          after_completion: { type: 'redirect' as const, redirect: { return_url: returnUrl } },
        },
      } : {}),
    });
  } catch (err) {
    const raw = err as { code?: string; type?: string; message?: string };
    const code = raw?.code || raw?.type || 'stripe_error';
    console.error('[stripe/portal] portal session failed', { code, message: raw?.message });
    // Stripeの生の文言はそのまま出さない（顧客IDや設定名が混じる）。
    // 代わりに、利用者が次に何をすればよいかが分かる文にする。
    const message = /No configuration provided/i.test(raw?.message || '')
      // 契約管理画面はStripe側で一度保存しないと使えない。運営がやることなので、
      // 利用者に「設定してください」とは言わない。
      ? 'お支払い管理の画面をいま開けません。お手数ですが info@laruvisona.jp までご連絡ください。'
      : code === 'resource_missing'
        ? 'お客様の決済情報が見つかりませんでした。お手数ですが info@laruvisona.jp までご連絡ください。'
        : '契約管理の画面を開けませんでした。時間をおいてお試しください。';
    return NextResponse.json({ error: message, code }, { status: 502 });
  }

  return NextResponse.json({
    url: portalSession.url,
    mode: paymentMethodOnly ? 'payment_method' : 'manage',
    cancelableFrom,
  });
}
