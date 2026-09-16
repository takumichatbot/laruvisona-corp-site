export const LARUHP_INDUSTRIES = [
  'restaurant', 'beauty', 'clinic', 'legal', 'construction',
  'realestate', 'retail', 'fitness', 'hotel', 'education',
  'wedding', 'pet', 'dental', 'photo', 'accounting',
] as const;

export const LARUHP_ARTICLE_SLUGS = [
  'hp-sakusei-cost',
  // 実際に検索された言葉に合わせて足したもの（Search Console 2026-09-17）。
  //   「工務店 ホームページ 見積り」「リフォーム会社 ホームページ 月額料金」
  //   「ホームページ作成ツール 比較」
  'hp-mitsumori-mikata',
  'hp-getsugaku-ikkatsu',
  'hp-tool-hikaku',
  'hp-hitsuyou-riyuu',
  'ai-hp-jidou-seisaku',
  'seo-chiiki-meo',
  'chatbot-jidou-outon',
] as const;

const FIXED_PUBLIC_PATHS = ['/plans', '/domains', '/contact', '/privacy', '/terms', '/tokusho'] as const;
const PUBLIC_ASSET_PATHS = ['/opengraph-image'] as const;

export const LARUHP_PUBLIC_PATHS = [
  '/',
  ...FIXED_PUBLIC_PATHS,
  ...LARUHP_INDUSTRIES.map(id => `/${id}`),
  '/articles',
  ...LARUHP_ARTICLE_SLUGS.map(slug => `/articles/${slug}`),
];

const PUBLIC_SET = new Set([...LARUHP_PUBLIC_PATHS, ...PUBLIC_ASSET_PATHS]);

export function internalLaruHpPath(pathname: string): string | null {
  if (!PUBLIC_SET.has(pathname)) return null;
  return pathname === '/' ? '/laruHP' : `/laruHP${pathname}`;
}

export function publicPathFromLegacy(pathname: string): string | null {
  if (pathname === '/laruHP' || pathname === '/laruHP/') return '/';
  if (!pathname.startsWith('/laruHP/')) return null;
  const candidate = pathname.slice('/laruHP'.length);
  return PUBLIC_SET.has(candidate) ? candidate : null;
}

export function laruHpSitemapXml(): string {
  const urls = LARUHP_PUBLIC_PATHS
    .map(path => `<url><loc>https://laruhp.com${path}</loc></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
