export const PLAN_SITE_LIMIT: Record<string, number> = {
  hp: 1,
  lite: 1,
  'hp-bot': 2,
  'hp-bot-seo': 3,
  agency: 999,
};

// 注意: 'analytics' はいまどこからも参照されていない（hasFeature を呼ぶ側が無い）。
// アクセス解析のAPI（app/api/sites/analytics）にプラン判定は無いので、
// 実際には全プランで見られる。表と実物が食い違っていると、あとで
// 「hpは解析なし」と読んで作った処理が既存の利用者から機能を取り上げる。
// 実物に合わせて hp にも入れてある。有料の線引きにするなら、まずAPI側に
// 判定を足し、料金表の記載も直すこと。
export const PLAN_FEATURES: Record<string, string[]> = {
  hp: ['builder', 'publish', 'shop', 'contacts', 'analytics'],
  lite: ['builder', 'publish', 'shop', 'contacts', 'larubot', 'sequences', 'analytics'],
  'hp-bot': ['builder', 'publish', 'shop', 'contacts', 'larubot', 'sequences', 'analytics'],
  'hp-bot-seo': ['builder', 'publish', 'shop', 'contacts', 'larubot', 'sequences', 'analytics', 'translate', 'seo'],
  agency: ['builder', 'publish', 'shop', 'contacts', 'larubot', 'sequences', 'analytics', 'translate', 'seo', 'whitelabel'],
};

export function getSiteLimit(plan: string | null): number {
  if (!plan) return 0;
  return PLAN_SITE_LIMIT[plan] ?? 1;
}

export function hasFeature(plan: string | null, feature: string): boolean {
  if (!plan) return false;
  return (PLAN_FEATURES[plan] ?? []).includes(feature);
}
