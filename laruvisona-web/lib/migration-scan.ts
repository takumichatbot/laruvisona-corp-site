const SKIP_PATH = /(?:^|\/)(?:wp-admin|wp-login|admin|login|logout|cart|checkout|account)(?:\/|$)/i;
const ASSET_PATH = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|pdf|zip|mp4|webm|mp3|css|js|xml|json)(?:$|\?)/i;

function decodeEntities(value: string): string {
  const codePoint = (raw: string, radix: number): string => {
    const number = parseInt(raw, radix);
    return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
      && !(number >= 0xd800 && number <= 0xdfff)
      ? String.fromCodePoint(number) : '';
  };
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => codePoint(n, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => codePoint(n, 16));
}

function plain(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

export type MigrationImage = { url: string; alt: string };
export type MigrationPage = {
  url: string;
  path: string;
  title: string;
  description: string;
  canonical: string;
  heading: string;
  text: string;
  images: MigrationImage[];
  links: string[];
};
export type MigrationPageLoader = (url: string) => Promise<{ html: string; url: string }>;

export function migrationUrl(raw: string): URL {
  const value = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  const url = new URL(value);
  url.hash = '';
  return url;
}

export function inspectMigrationHtml(html: string, pageUrl: string): MigrationPage {
  const base = new URL(pageUrl);
  const withoutCode = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ');
  const title = plain(withoutCode.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const heading = plain(withoutCode.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  let description = '';
  let canonical = '';
  for (const tag of withoutCode.match(/<(?:meta|link)\b[^>]*>/gi) ?? []) {
    const name = attr(tag, 'name').toLowerCase();
    const property = attr(tag, 'property').toLowerCase();
    const rel = attr(tag, 'rel').toLowerCase().split(/\s+/);
    if (!description && (name === 'description' || property === 'og:description')) description = plain(attr(tag, 'content'));
    if (!canonical && rel.includes('canonical')) {
      try { canonical = new URL(attr(tag, 'href'), base).toString(); } catch { /* malformed source */ }
    }
  }
  const links = new Set<string>();
  for (const tag of withoutCode.match(/<a\b[^>]*>/gi) ?? []) {
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const target = new URL(href, base);
      target.hash = '';
      target.search = '';
      if (target.protocol !== 'http:' && target.protocol !== 'https:') continue;
      if (target.origin !== base.origin || SKIP_PATH.test(target.pathname) || ASSET_PATH.test(target.pathname)) continue;
      links.add(target.toString());
    } catch { /* malformed source */ }
  }
  const images: MigrationImage[] = [];
  const seenImages = new Set<string>();
  for (const tag of withoutCode.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'src') || attr(tag, 'data-src');
    if (!src) continue;
    try {
      const target = new URL(src, base);
      if (!['http:', 'https:'].includes(target.protocol) || seenImages.has(target.toString())) continue;
      seenImages.add(target.toString());
      images.push({ url: target.toString(), alt: plain(attr(tag, 'alt')).slice(0, 200) });
      if (images.length >= 30) break;
    } catch { /* malformed source */ }
  }
  const text = plain(withoutCode
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')).slice(0, 5000);
  return {
    url: base.toString(), path: base.pathname || '/', title, description,
    canonical, heading, text, images, links: [...links],
  };
}

export async function crawlMigrationPages(
  start: string,
  load: MigrationPageLoader,
  maxPages = 8,
): Promise<MigrationPage[]> {
  const queue = [start];
  const seen = new Set<string>();
  const pages: MigrationPage[] = [];
  let allowedOrigin = '';
  while (queue.length && pages.length < maxPages) {
    const batch: string[] = [];
    while (queue.length && batch.length < 3 && pages.length + batch.length < maxPages) {
      const next = queue.shift()!;
      if (seen.has(next)) continue;
      seen.add(next);
      batch.push(next);
    }
    if (!batch.length) continue;
    const loaded = await Promise.allSettled(batch.map(url => load(url)));
    for (const outcome of loaded) {
      if (outcome.status === 'rejected') {
        if (pages.length === 0) throw outcome.reason;
        continue;
      }
      const fetched = outcome.value;
      const finalUrl = migrationUrl(fetched.url);
      if (!allowedOrigin) allowedOrigin = finalUrl.origin;
      if (finalUrl.origin !== allowedOrigin) continue;
      const page = inspectMigrationHtml(fetched.html, finalUrl.toString());
      pages.push(page);
      for (const link of page.links) {
        if (!seen.has(link) && !queue.includes(link) && queue.length < maxPages * 3) queue.push(link);
      }
    }
  }
  return pages;
}

export function migrationSummary(pages: MigrationPage[]) {
  return {
    pageCount: pages.length,
    imageCount: new Set(pages.flatMap(page => page.images.map(image => image.url))).size,
    missingTitleCount: pages.filter(page => !page.title).length,
    missingDescriptionCount: pages.filter(page => !page.description).length,
    missingHeadingCount: pages.filter(page => !page.heading).length,
  };
}
