import { isSeoPlan } from './larubot-seo';
import { hasServiceAccess } from './subscription-access';

/*
  公開ページに LARUbot / LARU SEO を出してよいか（2026-09-27）。

  以前は「public_id があれば出す」だけだった。Bot付きからHP単体へ下げても、
  SEO付きからSEOなしへ下げても、識別子が残っている限り出し続けていた
  （契約していない機能が無料で表示され続ける）。

  LARU HP の契約を正とする。public_id 自体は消さない
  （再契約したとき、同じテナント・同じQ&A・同じ記事に戻すため）。

    HP単体            … Bot なし・SEO なし
    HP + Bot Lite     … Bot
    HP + Bot Standard … Bot
    HP + Bot + SEO    … Bot・SEO
    Agency            … Bot・SEO
*/

const BOT_PLANS = new Set(['lite', 'hp-bot', 'hp-bot-seo', 'agency']);

/** LARUbot が付くプランか（契約状態は見ない）。 */
export function isBotPlan(plan: string | null | undefined): boolean {
  return !!plan && BOT_PLANS.has(plan);
}

export type LaruEntitlement = { bot: boolean; seo: boolean };

/**
 * 持ち主の今の契約から、出してよいものを決める。
 * 運営のアカウント（公開も契約なしで許している）は、確認用に両方出す。
 */
export function laruEntitlement(
  plan: string | null | undefined,
  status: string | null | undefined,
  ownerIsAdmin = false,
): LaruEntitlement {
  if (ownerIsAdmin) return { bot: true, seo: true };
  if (!hasServiceAccess(status)) return { bot: false, seo: false };
  return { bot: isBotPlan(plan), seo: isSeoPlan(plan) };
}
