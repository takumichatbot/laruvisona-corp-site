import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
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
