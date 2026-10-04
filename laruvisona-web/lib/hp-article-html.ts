/**
 * LARU HP の顧客サイトに置く LARU SEO の記事ページ（一覧・本文）の HTML。
 *
 * サーバーで完成した HTML を返す（検索エンジンが JavaScript なしで本文を読める）。
 * 会社サイト（laruvisona.jp）の共通レイアウト・計測・構造化データは混ぜない（顧客サイトとして名乗る）。
 * 見た目は既存のお知らせ記事ページ（app/hp/[slug]/post）と同じ組み方で、色はそのサイトの「サイト全体」の設定があればそれを使う。
 * 文字はすべてエスケープし、本文は除菌済みの HTML（lib/hp-seo-content.ts）だけを入れる。
 */
import { escapeHtml, jsonForScript } from '@/lib/safe-markup';
import type { SiteDesign } from '@/lib/site-design';
import { articleUrl, listUrl, type ContentArticle, type ContentItem } from '@/lib/hp-seo-content';

export interface PageSite {
  base: string;
  siteName: string;
  design: SiteDesign | null;
  fontFamily: string;
}

const e = (s: unknown) => escapeHtml(String(s ?? ''));
const jaDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' }).format(d) : '';
};
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function css(site: PageSite): string {
  const d = site.design;
  const ink = d?.ink || '#0f172a', bg = d?.bg || '#ffffff', accent = d?.accent || '#0369a1', line = d?.line || '#e2e8f0', surface = d?.surface || '#f8fafc';
  const serif = site.fontFamily === 'mincho' || site.fontFamily === 'kaisei';
  const font = serif ? `'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif` : `'Noto Sans JP',-apple-system,BlinkMacSystemFont,'Hiragino Kaku Gothic ProN','Segoe UI',sans-serif`;
  return `:root{--ink:${ink};--bg:${bg};--accent:${accent};--line:${line};--surface:${surface}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${font};line-height:1.85;overflow-wrap:anywhere}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.w{max-width:46rem;margin:0 auto;padding:0 20px}
.top{border-bottom:1px solid var(--line)}.top .w{display:flex;align-items:center;min-height:56px}
.top a{color:var(--ink);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;min-height:44px}
.crumb ol{list-style:none;display:flex;flex-wrap:wrap;gap:4px 8px;padding:0;margin:20px 0 0;font-size:13px;opacity:.75}
.crumb li+li:before{content:'›';margin-right:8px}.crumb a{color:inherit;display:inline-flex;align-items:center;min-height:32px}
h1{font-size:clamp(24px,5.4vw,36px);line-height:1.4;margin:12px 0 0;letter-spacing:.01em}
.meta{margin:12px 0 0;font-size:13px;opacity:.7}.meta time+time:before{content:'・'}
.thumb{display:block;width:100%;height:auto;margin:24px 0 0;border-radius:14px;border:1px solid var(--line);aspect-ratio:16/9;object-fit:cover;background:var(--surface)}
.body{margin:32px 0 0;font-size:16px}.body h2{font-size:1.35em;line-height:1.5;margin:2.2em 0 .6em;padding-bottom:.3em;border-bottom:1px solid var(--line)}
.body h3{font-size:1.15em;margin:1.8em 0 .5em}.body p,.body ul,.body ol,.body blockquote,.body pre,.body figure{margin:0 0 1.2em}
.body img{max-width:100%;height:auto;border-radius:8px}.body pre{overflow-x:auto;background:var(--surface);padding:12px;border-radius:8px}
.body table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:0 0 1.2em;font-size:15px}
.body th,.body td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;min-width:6em}
.body blockquote{border-left:3px solid var(--line);padding-left:14px;opacity:.85}
.more{margin:56px 0 0;padding:28px 0 0;border-top:1px solid var(--line)}.more h2{font-size:18px;margin:0 0 8px}
.more ul{list-style:none;padding:0;margin:0}.more p a{display:inline-flex;align-items:center;min-height:44px}.more li a{display:flex;align-items:center;min-height:44px;padding:6px 0;line-height:1.6}
.list{list-style:none;padding:0;margin:28px 0 0;display:grid;gap:28px}
.card{display:grid;gap:10px;align-content:start}.card a.img{display:block;border-radius:12px;overflow:hidden;border:1px solid var(--line)}
.card img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;background:var(--surface)}
.card h2{font-size:19px;line-height:1.55;margin:0}.card h2 a{color:var(--ink);text-decoration:none;display:block;padding:6px 0}.card h2 a:hover{text-decoration:underline}
.card p{margin:0;font-size:14px;opacity:.8}.card time{font-size:12px;opacity:.65}
.pager{display:flex;justify-content:space-between;gap:12px;margin:36px 0 0}.pager a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--line);border-radius:999px;text-decoration:none}
.empty{margin:32px 0 0;padding:24px;border:1px dashed var(--line);border-radius:12px}
.foot{margin:64px 0 0;padding:20px 0 40px;border-top:1px solid var(--line);font-size:14px}.foot a{display:inline-flex;align-items:center;min-height:44px}
@media(min-width:720px){.list{grid-template-columns:1fr 1fr}}`;
}

function head(o: { title: string; description: string; canonical: string | null; index: boolean; og: { type: string; url: string; image?: string | null; siteName: string; published?: string | null; modified?: string | null }; ld: unknown[]; site: PageSite; extra?: string }) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(o.title)}</title>
<meta name="description" content="${e(o.description)}">
<meta name="robots" content="${o.index ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">
${o.canonical ? `<link rel="canonical" href="${e(o.canonical)}">` : ''}${o.extra ?? ''}
<meta property="og:type" content="${e(o.og.type)}"><meta property="og:title" content="${e(o.title)}"><meta property="og:description" content="${e(o.description)}"><meta property="og:url" content="${e(o.og.url)}"><meta property="og:site_name" content="${e(o.og.siteName)}"><meta property="og:locale" content="ja_JP">${o.og.image ? `<meta property="og:image" content="${e(o.og.image)}">` : ''}
${o.og.published ? `<meta property="article:published_time" content="${e(o.og.published)}">` : ''}${o.og.modified ? `<meta property="article:modified_time" content="${e(o.og.modified)}">` : ''}
<meta name="twitter:card" content="${o.og.image ? 'summary_large_image' : 'summary'}">
<script type="application/ld+json">${jsonForScript(o.ld)}</script>
<style>${css(o.site)}</style></head>`;
}

const topBar = (site: PageSite) => `<header class="top"><div class="w"><a href="${e(site.base)}">${e(site.siteName)}</a></div></header>`;
const footer = (site: PageSite) => `<footer class="foot"><a href="${e(site.base)}">← ${e(site.siteName)} のトップへ</a></footer>`;
const breadcrumbLd = (site: PageSite, tail?: { name: string; url: string }) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: site.siteName, item: site.base },
    { '@type': 'ListItem', position: 2, name: 'コラム', item: listUrl(site.base) },
    ...(tail ? [{ '@type': 'ListItem', position: 3, name: tail.name, item: tail.url }] : []),
  ],
});

/** 記事本文のページ */
export function articlePageHtml(input: { site: PageSite; article: ContentArticle; canonical: string | null; index: boolean; related: ContentItem[] }): string {
  const { site, article, canonical, index } = input;
  const own = articleUrl(site.base, article.slug);
  const description = article.metaDescription || clip(article.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 120);
  const publisher = { '@type': 'Organization', name: site.siteName, url: site.base };
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: clip(article.title, 110),
      description,
      ...(article.thumbnailUrl ? { image: [article.thumbnailUrl] } : {}),
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
      author: { '@type': 'Organization', name: article.author || site.siteName, url: site.base },
      publisher,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical || own },
      url: canonical || own,
      inLanguage: 'ja',
    },
    breadcrumbLd(site, { name: article.title, url: canonical || own }),
  ];
  const related = input.related.filter((x) => x.slug !== article.slug).slice(0, 5);
  return `${head({ title: `${article.title} | ${site.siteName}`, description, canonical, index, site, ld, og: { type: 'article', url: canonical || own, image: article.thumbnailUrl, siteName: site.siteName, published: article.publishedAt, modified: article.updatedAt } })}
<body>${topBar(site)}<main class="w">
<nav class="crumb" aria-label="現在地"><ol><li><a href="${e(site.base)}">トップ</a></li><li><a href="${e(listUrl(site.base))}">コラム</a></li><li aria-current="page">${e(clip(article.title, 40))}</li></ol></nav>
<article><h1>${e(article.title)}</h1>
<p class="meta">${article.publishedAt ? `<time datetime="${e(article.publishedAt)}">公開 ${e(jaDate(article.publishedAt))}</time>` : ''}${article.updatedAt && jaDate(article.updatedAt) !== jaDate(article.publishedAt) ? `<time datetime="${e(article.updatedAt)}">更新 ${e(jaDate(article.updatedAt))}</time>` : ''}</p>
${article.thumbnailUrl ? `<img class="thumb" src="${e(article.thumbnailUrl)}" alt="" width="1200" height="675" fetchpriority="high" decoding="async">` : ''}
<div class="body">${article.html}</div></article>
<section class="more" aria-label="ほかの記事">${related.length ? `<h2>ほかの記事</h2><ul>${related.map((x) => `<li><a href="${e(articleUrl(site.base, x.slug))}">${e(x.title)}</a></li>`).join('')}</ul>` : ''}<p><a href="${e(listUrl(site.base))}">記事の一覧へ</a></p></section>
${footer(site)}</main></body></html>`;
}

/** 記事一覧のページ */
export function listPageHtml(input: { site: PageSite; items: ContentItem[]; page: number; hasNext: boolean; index: boolean }): string {
  const { site, items, page, hasNext, index } = input;
  const own = listUrl(site.base, page);
  const title = page > 1 ? `コラム（${page}ページ目） | ${site.siteName}` : `コラム | ${site.siteName}`;
  const description = `${site.siteName}のコラムの一覧です。`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: own, isPartOf: { '@type': 'WebSite', name: site.siteName, url: site.base } },
    breadcrumbLd(site),
  ];
  const prev = page > 1 ? listUrl(site.base, page - 1) : '';
  const next = hasNext ? listUrl(site.base, page + 1) : '';
  return `${head({ title, description, canonical: own, index, site, ld, og: { type: 'website', url: own, siteName: site.siteName } })}
<body>${topBar(site)}<main class="w">
<nav class="crumb" aria-label="現在地"><ol><li><a href="${e(site.base)}">トップ</a></li><li aria-current="page">コラム</li></ol></nav>
<h1>コラム</h1>
${items.length ? `<ul class="list">${items.map((x) => {
    const href = e(articleUrl(site.base, x.slug));
    return `<li class="card">${x.thumbnailUrl ? `<a class="img" href="${href}" tabindex="-1" aria-hidden="true"><img src="${e(x.thumbnailUrl)}" alt="" width="640" height="360" loading="lazy" decoding="async"></a>` : ''}<h2><a href="${href}">${e(x.title)}</a></h2>${x.metaDescription ? `<p>${e(clip(x.metaDescription, 120))}</p>` : ''}${x.updatedAt || x.publishedAt ? `<time datetime="${e(x.updatedAt || x.publishedAt)}">${e(jaDate(x.updatedAt || x.publishedAt))}</time>` : ''}</li>`;
  }).join('')}</ul>` : `<p class="empty">まだ記事はありません。<br><a href="${e(site.base)}">${e(site.siteName)} のトップへ</a></p>`}
${prev || next ? `<nav class="pager" aria-label="ページ送り">${prev ? `<a href="${e(prev)}" rel="prev">← 前のページ</a>` : '<span></span>'}${next ? `<a href="${e(next)}" rel="next">次のページ →</a>` : ''}</nav>` : ''}
${footer(site)}</main></body></html>`;
}

/** 404 / 410 / 503 の小さなページ（検索に載せない） */
export function statusPageHtml(status: 404 | 410 | 503, site: PageSite | null): string {
  const msg = status === 410 ? 'この記事は削除されました。' : status === 503 ? '記事をいま読み込めません。時間をおいてもう一度お試しください。' : 'お探しの記事は見つかりませんでした。';
  const back = site ? `<p><a href="${e(listUrl(site.base))}">記事の一覧へ</a>・<a href="${e(site.base)}">${e(site.siteName)} のトップへ</a></p>` : '';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${e(msg)}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif;line-height:1.8;color:#0f172a}main{max-width:40rem;margin:0 auto;padding:64px 20px}a{display:inline-flex;min-height:44px;align-items:center;color:#0369a1}</style></head><body><main><h1 style="font-size:22px">${e(msg)}</h1>${back}</main></body></html>`;
}
