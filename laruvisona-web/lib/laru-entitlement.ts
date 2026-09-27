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

/**
 * LARU HP のプランが「お客様に何を渡すか」の正（2026-09-27）。
 *
 * 商品表示・公開ページの出し分け・ダッシュボード・プラン変更の確認・LARUbot 登録は、
 * すべてここを見る。LARUbot 側の内部名（lite / starter など）はお客様に見せない。
 *   - hp-bot / hp-bot-seo は LARUbot 側では starter。お客様向けには「Standard」
 *   - agency は LARUbot 側では lite + SEO
 * 価格は lib/laruhp-facts.ts が正。ここには書かない。
 */
export type HpPlanId = 'hp' | 'lite' | 'hp-bot' | 'hp-bot-seo' | 'agency';

export const HP_PLAN_PRODUCTS: Record<HpPlanId, { name: string; bot: 'LARUbot Lite' | 'LARUbot Standard' | null; seo: boolean }> = {
  hp: { name: 'HP単体', bot: null, seo: false },
  lite: { name: 'HP + Bot Lite', bot: 'LARUbot Lite', seo: false },
  'hp-bot': { name: 'HP + Bot Standard', bot: 'LARUbot Standard', seo: false },
  'hp-bot-seo': { name: 'HP + Bot + SEO', bot: 'LARUbot Standard', seo: true },
  agency: { name: 'エージェンシー', bot: 'LARUbot Lite', seo: true },
};

/** HP に付く LARU SEO の記事枠（LARUbot 側 seo_article_limit。月あたり）。 */
export const HP_SEO_ARTICLES_PER_MONTH = 5;

export function hpProduct(plan: string | null | undefined) {
  return plan && plan in HP_PLAN_PRODUCTS ? HP_PLAN_PRODUCTS[plan as HpPlanId] : null;
}

/** LARUbot が付くプランか（契約状態は見ない）。 */
export function isBotPlan(plan: string | null | undefined): boolean {
  return !!hpProduct(plan)?.bot;
}

/** LARU SEO が付くプランか（契約状態は見ない）。 */
export function isSeoPlan(plan: string | null | undefined): boolean {
  return !!hpProduct(plan)?.seo;
}

/**
 * プランを変える前に、お客様へ見せる説明。
 * 公開サイトで起きることだけを書く。LARUbot 側の権限停止はまだ同期していないので
 * （docs/larubot-request-2026-09-27-entitlement-sync.md）「完全に止まる」とは書かない。
 */
export function planChangeNotes(from: string | null | undefined, to: string): string[] {
  const a = hpProduct(from);
  const b = hpProduct(to);
  if (!b) return [];
  const lines = [`現在: ${a?.name ?? '未契約'} → 変更後: ${b.name}`];
  if (b.bot && a?.bot !== b.bot) lines.push(`AIチャット（${b.bot}）が公開サイトへ自動で設置されます。`);
  if (b.seo && !a?.seo) lines.push(`LARU SEO の記事（月${HP_SEO_ARTICLES_PER_MONTH}本まで）が公開サイトの「コラム」に自動で表示されます。`);
  if (a?.bot && !b.bot) lines.push('プラン変更後、公開サイトのAIチャットは表示されなくなります。設定データは保持されます。');
  if (a?.seo && !b.seo) lines.push('LARU SEO の新しい記事生成とサイト上の記事表示は対象外になります。既存データは保持されます。');
  lines.push('サイトは作り直しません。料金の差額は日割りで次回の請求に反映されます。');
  return lines;
}

/**
 * LARUbot / LARU SEO の接続情報は、こちら（契約時の自動連携）だけが書く。
 * 編集画面からの保存では変えさせない（他の人の public_id を入れて、
 * 別のテナントのチャットや記事を自分のサイトに出せてしまうため）。
 */
export const SERVER_OWNED_SETTING_KEYS = ['larubotPublicId', 'laruseoPublicId', 'larubotRegisteredPlan'] as const;

/** 送られてきた設定のうち、接続情報だけは保存済みの値に戻す。 */
export function keepServerOwnedSettings(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...incoming };
  for (const key of SERVER_OWNED_SETTING_KEYS) {
    if (current && key in current) out[key] = current[key];
    else delete out[key];
  }
  return out;
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
