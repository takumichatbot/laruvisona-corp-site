/**
 * LARU SEO の記事提供 API（Content API）を、LARU HP の顧客サイトの記事ページが読むための窓口。
 *
 * 仕様（正）: LARUbot_homepage `docs/integrations/laru_hp_seo_article_contract.md`（M03・2026-10-04）
 *   一覧  GET {LARU}/api/seo/content/{public_id}?page=&limit=   （limit 1〜100）
 *   本文  GET {LARU}/api/seo/content/{public_id}/{slug}
 *   200: Cache-Control public, max-age=300 ／ ETag ／ Last-Modified（If-None-Match 一致で 304）
 *   404 {"error":"not_found"} ／ 404 {"error":"moved","slug":"新slug"} ／ 410 {"error":"gone"}（エラーは no-store）
 *
 * 決めごと:
 *   ・記事を書くのは LARU SEO だけ。ここは公開済みの記事を読むだけ（生成・下書き・枠・プラン判定は持たない）
 *   ・欄の名前は仕様書と実際の応答に合わせる（推測しない）。形が違う値は捨てる
 *   ・canonical は API の canonical_url をそのまま使う。正規の公開先がこのサイトかどうかは publication で見る
 *   ・向こうが遅い・落ちているときに、こちらを道連れにしない（時間を切り、例外を投げない）
 *   ・取った応答は 5 分だけ手元に置き、それを過ぎたら ETag / Last-Modified で確かめ直す（304 なら中身を使い回す）
 */
import { cleanIncomingText, sanitizeArticleHtml } from '@/lib/safe-markup';
import { isValidSlug } from '@/lib/laruseo-articles';
import { siteUrl } from '@/lib/public-site-url';

export const HP_ARTICLE_PATH = '/articles/{slug}';
export const HP_ARTICLE_DIR = 'articles';

export interface Publication {
  targetType: string | null;
  canonicalBase: string | null;
  articlePath: string | null;
  canonicalPolicy: string | null;
}
export interface ContentItem {
  id: number;
  slug: string;
  title: string;
  metaDescription: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  canonicalUrl: string | null;
}
export interface ContentArticle extends ContentItem {
  html: string;
  author: string;
  status: string;
  indexable: boolean;
  isPrimaryTarget: boolean;
}
export type ListResult =
  | { ok: true; items: ContentItem[]; hasNext: boolean; total: number; page: number; publication: Publication }
  | { ok: false; reason: 'not_found' | 'unavailable' };
export type ArticleResult =
  | { kind: 'ok'; article: ContentArticle; publication: Publication }
  | { kind: 'not_found' }
  | { kind: 'moved'; slug: string }
  | { kind: 'gone' }
  | { kind: 'unavailable' };

const base = (): string => (process.env.LARUBOT_API_URL || 'https://larubot.tokyo').replace(/\/+$/, '');
const PUBLIC_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const isPublicId = (v: unknown): v is string => typeof v === 'string' && PUBLIC_ID.test(v);

const text = (value: unknown, max: number): string => (typeof value === 'string' ? cleanIncomingText(value, max).trim() : '');
const https = (value: unknown): string | null => {
  const s = text(value, 600);
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
};
/** 「2026-10-04T00:08:06.424754」（UTC・タイムゾーン表記なし）を ISO に。読めなければ null */
export function utcIso(value: unknown): string | null {
  const s = text(value, 40);
  if (!s) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function parsePublication(raw: unknown): Publication {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    targetType: text(p.target_type, 40) || null,
    canonicalBase: https(p.canonical_base),
    articlePath: text(p.article_path, 200) || null,
    canonicalPolicy: text(p.canonical_policy, 40) || null,
  };
}

export function parseItem(raw: unknown): ContentItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isValidSlug(r.slug) || typeof r.id !== 'number' || !Number.isInteger(r.id)) return null;
  const title = text(r.title, 300);
  if (!title) return null;
  return {
    id: r.id,
    slug: r.slug,
    title,
    metaDescription: text(r.meta_description, 400),
    thumbnailUrl: https(r.thumbnail_url),
    publishedAt: utcIso(r.published_at),
    updatedAt: utcIso(r.updated_at),
    canonicalUrl: https(r.canonical_url),
  };
}

export function parseArticle(raw: unknown): ContentArticle | null {
  const item = parseItem(raw);
  if (!item) return null;
  const r = raw as Record<string, unknown>;
  const html = typeof r.content_html === 'string' ? sanitizeArticleHtml(r.content_html) : '';
  if (!html.trim()) return null;
  return {
    ...item,
    html,
    author: text(r.author, 120),
    status: text(r.status, 30),
    indexable: r.indexable === true,
    isPrimaryTarget: r.is_primary_target === true,
  };
}

/* ── 取得（5 分は手元のものを使い、過ぎたら検証付きで取り直す） ── */
interface Cached { at: number; etag: string; lastModified: string; json: unknown }
const memo = new Map<string, Cached>();
// 5 分（LARU SEO の再検証と同じ）。手元の確認だけ HP_SEO_CONTENT_FRESH_MS で短くできる
const FRESH_MS = Number.isFinite(Number(process.env.HP_SEO_CONTENT_FRESH_MS)) && process.env.HP_SEO_CONTENT_FRESH_MS !== undefined ? Number(process.env.HP_SEO_CONTENT_FRESH_MS) : 300_000;
const MAX_ENTRIES = 500;
const TIMEOUT_MS = 6000;
type Fetched = { status: number; json: unknown } | null;

/** テスト用：手元の控えを空にする */
export function clearContentCache(): void { memo.clear(); }

async function getJson(path: string): Promise<Fetched> {
  const url = `${base()}${path}`;
  const hit = memo.get(url);
  if (hit && Date.now() - hit.at < FRESH_MS) return { status: 200, json: hit.json };
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  else if (hit?.lastModified) headers['If-Modified-Since'] = hit.lastModified;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    if (res.status === 304 && hit) {
      hit.at = Date.now();
      return { status: 200, json: hit.json };
    }
    const json = await res.json().catch(() => null);
    if (res.status === 200 && json && typeof json === 'object') {
      if (memo.size >= MAX_ENTRIES) memo.delete(memo.keys().next().value as string);
      memo.set(url, { at: Date.now(), etag: res.headers.get('etag') || '', lastModified: res.headers.get('last-modified') || '', json });
    } else {
      // エラー（取り消し・削除・移動）は控えない。次の取得で必ず確かめる
      memo.delete(url);
    }
    return { status: res.status, json };
  } catch {
    return null;
  }
}

export async function listContent(publicId: string, opts: { page?: number; limit?: number } = {}): Promise<ListResult> {
  if (!isPublicId(publicId)) return { ok: false, reason: 'not_found' };
  const limit = Math.min(100, Math.max(1, Math.trunc(opts.limit ?? 20)));
  const page = Math.min(1000, Math.max(1, Math.trunc(opts.page ?? 1)));
  const r = await getJson(`/api/seo/content/${encodeURIComponent(publicId)}?page=${page}&limit=${limit}`);
  if (r && (r.status === 404 || r.status === 410)) return { ok: false, reason: 'not_found' };
  if (!r || r.status !== 200 || !r.json || typeof r.json !== 'object') return { ok: false, reason: 'unavailable' };
  const j = r.json as Record<string, unknown>;
  const items = (Array.isArray(j.items) ? j.items : []).map(parseItem).filter((x): x is ContentItem => !!x);
  return {
    ok: true,
    items,
    hasNext: j.has_next === true,
    total: typeof j.total === 'number' && j.total >= 0 ? Math.trunc(j.total) : items.length,
    page,
    publication: parsePublication(j.publication),
  };
}

export async function getContent(publicId: string, slug: string): Promise<ArticleResult> {
  if (!isPublicId(publicId) || !isValidSlug(slug)) return { kind: 'not_found' };
  const r = await getJson(`/api/seo/content/${encodeURIComponent(publicId)}/${encodeURIComponent(slug)}`);
  if (!r) return { kind: 'unavailable' };
  const err = r.json && typeof r.json === 'object' ? (r.json as Record<string, unknown>).error : undefined;
  if (r.status === 410 || err === 'gone') return { kind: 'gone' };
  if (r.status === 404 && err === 'moved') {
    const next = (r.json as Record<string, unknown>).slug;
    return isValidSlug(next) && next !== slug ? { kind: 'moved', slug: next } : { kind: 'not_found' };
  }
  if (r.status === 404) return { kind: 'not_found' };
  if (r.status !== 200) return { kind: 'unavailable' };
  const article = parseArticle(r.json);
  if (!article) return { kind: 'unavailable' };
  return { kind: 'ok', article, publication: parsePublication((r.json as Record<string, unknown>).publication) };
}

/** slug の変更を、最後の行き先まで辿る（転送を重ねない）。辿れなければ null */
export async function resolveMoved(publicId: string, slug: string, maxHops = 3): Promise<string | null> {
  let current = slug;
  for (let i = 0; i < maxHops; i++) {
    const r = await getContent(publicId, current);
    if (r.kind === 'ok') return current === slug ? null : current;
    if (r.kind !== 'moved') return null;
    current = r.slug;
  }
  return null;
}

/* ── 正規の公開先と index の判定（純粋関数） ── */
const trimBase = (s: string | null) => (s || '').replace(/\/+$/, '').toLowerCase();

export type TargetState = 'here' | 'elsewhere' | 'unregistered';
/**
 * このサイトが、LARU SEO に登録された正規の公開先か。
 *   here        公開先が LARU HP で、canonical_base と記事の置き場がこのサイトと一致
 *   elsewhere   公開先が LARU HP の別サイト（同じ public_id の別サイト）→ 記事ページを出さない
 *   unregistered まだ LARU HP が公開先ではない（LARU 側の入口が正規）→ 出すが index しない
 */
export function targetState(publication: Publication, siteBase: string): TargetState {
  if (publication.targetType !== 'laruhp') return 'unregistered';
  return trimBase(publication.canonicalBase) === trimBase(siteBase) && publication.articlePath === HP_ARTICLE_PATH ? 'here' : 'elsewhere';
}

export const articleUrl = (siteBase: string, slug: string) => siteUrl(siteBase, `${HP_ARTICLE_DIR}/${slug}`);
export const listUrl = (siteBase: string, page = 1) => siteUrl(siteBase, page > 1 ? `${HP_ARTICLE_DIR}?page=${page}` : HP_ARTICLE_DIR);

/** 記事1本の index と canonical。canonical は API の値のまま。index はこのサイトが正規で、値が一致するときだけ */
export function articleIndexing(input: { state: TargetState; siteNoIndex: boolean; siteBase: string; article: Pick<ContentArticle, 'slug' | 'indexable' | 'isPrimaryTarget' | 'canonicalUrl'> }) {
  const { state, siteNoIndex, siteBase, article } = input;
  const own = articleUrl(siteBase, article.slug);
  const index = state === 'here' && !siteNoIndex && article.indexable && article.isPrimaryTarget && article.canonicalUrl === own;
  return { index, canonical: article.canonicalUrl, own };
}

/** サイトマップに載せる記事（このサイトが正規のときだけ・正規 URL がこのサイトの記事 URL と一致するものだけ） */
export async function sitemapArticles(publicId: string, siteBase: string, maxPages = 20): Promise<{ loc: string; lastmod: string | null }[]> {
  const out: { loc: string; lastmod: string | null }[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await listContent(publicId, { page, limit: 100 });
    if (!r.ok || targetState(r.publication, siteBase) !== 'here') return out;
    for (const item of r.items) {
      const own = articleUrl(siteBase, item.slug);
      if (item.canonicalUrl === own) out.push({ loc: own, lastmod: item.updatedAt ?? item.publishedAt });
    }
    if (!r.hasNext) break;
  }
  return out;
}
