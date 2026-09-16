import { MONTHLY, ANNUAL_TOTAL } from './laruhp-facts';

/**
 * 画面に出している額と、Stripeが実際に請求する額が違うまま売らない。
 *
 * 2026-09-16 に本番で見つかった: LARU HP の年払いは画面が 9,990円
 * （999円×10ヶ月＝「実質2ヶ月無料」）なのに、Stripeの価格は 9,999円
 * だった。誰も買っていなかったので実害は出ていないが、買われていれば
 * 広告と違う額を請求していたことになる。
 *
 * 出荷手順にも停止条件として書いてある。人が目で照らし合わせる前提だと
 * 必ず抜けるので、決済を作る直前に機械が見る。
 *
 * 食い違ったら売らない。安いほうへ寄せるのも高いほうへ寄せるのも、
 * どちらも「表示と違う額を請求する」ことに変わりはないため。
 */
export const SHOWN_AMOUNT: Record<string, { monthly: number; annual: number }> = {
  hp: { monthly: MONTHLY.hp, annual: ANNUAL_TOTAL.hp },
  lite: { monthly: MONTHLY.lite, annual: ANNUAL_TOTAL.lite },
  'hp-bot': { monthly: MONTHLY.hpBot, annual: ANNUAL_TOTAL.hpBot },
  'hp-bot-seo': { monthly: MONTHLY.hpBotSeo, annual: ANNUAL_TOTAL.hpBotSeo },
  agency: { monthly: MONTHLY.agency, annual: ANNUAL_TOTAL.agency },
};

export type PriceFacts = {
  unit_amount?: number | null;
  currency?: string | null;
  recurring?: { interval?: string | null } | null;
};

export type PriceVerdict =
  | { ok: true }
  /** 知らないプラン。照合できないので、止めずに通す（既存の経路を壊さない）。 */
  | { ok: true; unchecked: true }
  | { ok: false; reason: string };

export function verifyPrice(
  plan: string,
  billing: 'monthly' | 'annual',
  price: PriceFacts,
): PriceVerdict {
  const shown = SHOWN_AMOUNT[plan];
  if (!shown) return { ok: true, unchecked: true };
  const want = billing === 'monthly' ? shown.monthly : shown.annual;
  const amount = price.unit_amount ?? null;
  if (amount !== want) return { ok: false, reason: `画面は${want}円、Stripeは${amount}円` };
  if ((price.currency || '').toLowerCase() !== 'jpy') return { ok: false, reason: `通貨が${price.currency}` };
  const wantInterval = billing === 'monthly' ? 'month' : 'year';
  const interval = price.recurring?.interval ?? null;
  if (interval !== wantInterval) return { ok: false, reason: `請求間隔が${interval}` };
  return { ok: true };
}
