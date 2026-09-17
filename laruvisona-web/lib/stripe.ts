import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * 検証用に、Stripeの宛先を手元のサーバーへ向ける。
 *
 * 申し込みから決済までを人の手なしで通すには、Stripeの応答を再現した
 * サーバーへ向ける必要がある。ただし**向け先を間違えると、実際の請求が
 * 別の宛先へ飛ぶ**ので、次の両方を満たしたときだけ効かせる。
 *
 *   1. 本番の鍵（sk_live…）では絶対に効かない
 *   2. 宛先がループバック（127.0.0.1 / localhost / ::1）であること
 *
 * どちらか一方でも欠けたら、何もせず本物の api.stripe.com へ行く。
 */
export function localEndpoint(): { host: string; port: number; protocol: 'http' | 'https' } | null {
  const base = process.env.STRIPE_API_BASE;
  if (!base) return null;
  if ((process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live')) return null;
  let url: URL;
  try { url = new URL(base); } catch { return null; }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) return null;
  const protocol = url.protocol === 'https:' ? 'https' : 'http';
  return { host: url.hostname, port: Number(url.port || (protocol === 'https' ? 443 : 80)), protocol };
}

export function getStripe(): Stripe {
  if (!_stripe) {
    const local = localEndpoint();
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
      ...(local ? { host: local.host, port: local.port, protocol: local.protocol } : {}),
    });
  }
  return _stripe;
}

// convenience alias used by existing imports
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripe() as unknown as Record<string, unknown>)[prop as string];
  },
});

// 以前ここに PLAN 定数（amount: 999 / firstMonthAmount: 1）があった。
// どこからも参照されておらず、いまの料金（初月無料・2ヶ月目から課金）とも
// 食い違っていたので消した。参照は無かったので、決済の動きは変わらない。
//
// 料金の正は2か所。
//   ・画面に出す数字 …… lib/laruhp-facts.ts
//   ・実際に請求する額 …… Stripe 側の価格ID（STRIPE_PRICE_ID）
// 決済ルート（app/api/stripe/checkout・upgrade）は価格IDだけを見ている。
