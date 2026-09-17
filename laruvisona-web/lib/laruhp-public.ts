import { FAQ_SLUGS } from './laruhp-faq';

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
  // 公開まで行かずに止まる二大理由（文章・写真）と、依頼するかの判断
  'hp-bunshou-kakenai',
  'hp-shashin-nai',
  'hp-jibun-ka-irai-ka',
  'hp-hitsuyou-riyuu',
  'ai-hp-jidou-seisaku',
  'seo-chiiki-meo',
  'chatbot-jidou-outon',
  // 「ホームページ作成 無料」で掲載順位10位（1ページ目）まで来ているのに
  // クリック0だった。答える記事が1本も無かった（Search Console 2026-09-17）。
  'hp-muryou-de-tsukureru-ka',
] as const;

const FIXED_PUBLIC_PATHS = ['/plans', '/simulator', '/demo', '/faq', '/domains', '/contact', '/privacy', '/terms', '/tokusho'] as const;

/** 他社と比べるページ。app/laruHP/vs/[competitor] の COMPETITORS と揃えること。 */
export const LARUHP_VS_SLUGS = ['jimdo', 'wix', 'canva', 'studio'] as const;
const PUBLIC_ASSET_PATHS = ['/opengraph-image'] as const;

export const LARUHP_PUBLIC_PATHS = [
  '/',
  ...FIXED_PUBLIC_PATHS,
  ...FAQ_SLUGS.map(slug => `/faq/${slug}`),
  ...LARUHP_INDUSTRIES.map(id => `/${id}`),
  '/articles',
  ...LARUHP_ARTICLE_SLUGS.map(slug => `/articles/${slug}`),
  ...LARUHP_VS_SLUGS.map(slug => `/vs/${slug}`),
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

/** 更新した日。記事を書き直したら、ここも変える（sitemapのlastmodに出る）。 */
export const LARUHP_SITEMAP_UPDATED = '2026-09-17';

export function laruHpSitemapXml(lastmod = LARUHP_SITEMAP_UPDATED): string {
  // lastmod が無いと、記事を直しても検索側に「見に来てよい」合図が出ない。
  // 会社サイト側（app/sitemap.ts）は出しているので、案内サイト側も揃える。
  const priorityOf = (path: string) =>
    path === '/' ? '1.0'
    : path === '/plans' || path === '/demo' || path === '/simulator' ? '0.9'
    : '0.7';
  const urls = LARUHP_PUBLIC_PATHS
    .map(path => `<url><loc>https://laruhp.com${path}</loc><lastmod>${lastmod}</lastmod><priority>${priorityOf(path)}</priority></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
