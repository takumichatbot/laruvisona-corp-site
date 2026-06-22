export const PLAN_SITE_LIMIT: Record<string, number> = {
  hp: 1,
  lite: 1,
  'hp-bot': 2,
  'hp-bot-seo': 3,
  agency: 999,
};

export const PLAN_FEATURES: Record<string, string[]> = {
  hp: ['builder', 'publish', 'shop', 'contacts'],
  lite: ['builder', 'publish', 'shop', 'contacts', 'larubot', 'sequences'],
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
