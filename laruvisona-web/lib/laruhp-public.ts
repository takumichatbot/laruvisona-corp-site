export const LARUHP_INDUSTRIES = [
  'restaurant', 'beauty', 'clinic', 'legal', 'construction',
  'realestate', 'retail', 'fitness', 'hotel', 'education',
  'wedding', 'pet', 'dental', 'photo', 'accounting',
] as const;

export const LARUHP_ARTICLE_SLUGS = [
  'hp-sakusei-cost',
  'hp-hitsuyou-riyuu',
  'ai-hp-jidou-seisaku',
  'seo-chiiki-meo',
  'chatbot-jidou-outon',
] as const;

const FIXED_PUBLIC_PATHS = ['/plans', '/contact', '/privacy', '/terms', '/tokusho'] as const;
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
