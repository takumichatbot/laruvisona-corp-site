/**
 * LARUSEO（larubot.tokyo）が生成した記事を、**こちらのサーバーで**取ってくる。
 *
 * これまでは `blog.js` という向こうの script 札を貼り、
 * ブラウザの中で記事一覧を描いていた。つまり、こちらが返すHTMLには
 * 記事の文字が1文字も入っていない。
 *
 *   ・検索の評価は、文字が載っているページに付く。載っていなければ付かない。
 *   ・向こうのサーバーが遅い日・止まった日は、こちらのページが白いまま終わる。
 *     しかも、こちらには何の知らせも来ない。
 *   ・記事1本ずつのURLがこちらに無いので、1本も検索に出ない。
 *
 * 口は前からあった（LARUbot側の回答 2026-09-17 ⑬）。
 *   一覧  GET /api/seo/public/<public_id>/articles?limit=&page=
 *   本文  GET /api/seo/public_article_data/<public_id>/<slug>
 * どちらも認証不要。
 *
 * ここで気をつけること。
 *   ・**よそからのHTMLである。** 本文は必ず sanitizeArticleHtml を通す。
 *     通さずに出すと、向こうに何かが混ざった日に、こちらのドメインで動く。
 *   ・**向こうが遅いとき、こちらを道連れにしない。** 時間を切って、
 *     取れなければ「いま出せません」と出す。例外を上へ投げない。
 *   ・**返ってきた形を信じない。** 欄が無い・型が違う・slug に `..` が入る、
 *     を全部ここで落とす。
 */

import { cleanIncomingText, escapeHtml, sanitizeArticleHtml } from '@/lib/safe-markup';

/** 一覧に出す1件。本文は入らない。 */
export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

/** 記事1本。`html` は除菌済み。 */
export interface Article extends ArticleSummary {
  html: string;
}

export interface ArticleList {
  articles: ArticleSummary[];
  hasMore: boolean;
  /** 取りに行けたかどうか。false は「0件」ではなく「分からない」。 */
  ok: boolean;
  /**
   * 取れなかった理由。画面の文言を書き分けるために使う。
   *   'unconfigured' 設置IDが無い（こちらの設定の誤り。待っても直らない）
   *   'unreachable'  向こうが遅い・落ちている（時間をおけば直る）
   */
  reason: 'unconfigured' | 'unreachable' | null;
}

/**
 * slug はURLの一部になる。`..` や `/` を通すと、
 * 組み立てたURLが別の口を指す。英数字と `-` `_` `.` だけにする
 * （`..` は作らせない）。
 */
const SLUG = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG.test(value);
}

const base = (): string => (process.env.LARUBOT_API_URL || 'https://larubot.tokyo').replace(/\/+$/, '');

/** 設置IDが無ければ、そもそも取りに行かない。 */
export function laruseoPublicId(): string {
  const id = (process.env.NEXT_PUBLIC_LARUBOT_PUBLIC_ID || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : '';
}

const text = (value: unknown, max = 400): string => {
  if (typeof value !== 'string') return '';
  // 制御文字は消す。見えないのに、属性や本文の外へ出られる。
  return cleanIncomingText(value, max).trim();
};

/** 絵は https のものだけ。http や data: を混ぜると、こちらのページの鍵が外れる。 */
const imageUrl = (value: unknown): string | null => {
  const s = text(value, 500);
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s : null;
};

/** 日付。読めない値は「無い」にする。いまの時刻で埋めない（新着に化ける）。 */
const when = (value: unknown): string | null => {
  const s = text(value, 40);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

function toSummary(row: unknown): ArticleSummary | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (!isValidSlug(r.slug)) return null;
  const title = text(r.title, 200);
  if (!title) return null;
  return {
    slug: r.slug,
    title,
    description: text(r.meta_description, 300) || text(r.snippet, 300),
    thumbnailUrl: imageUrl(r.thumbnail_url),
    publishedAt: when(r.published_date ?? r.published_at),
    updatedAt: when(r.updated_at),
  };
}

/** 向こうが遅い日に、こちらのページを道連れにしない。 */
const TIMEOUT_MS = 6000;

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${base()}${path}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      // 毎回取りに行くと、向こうの都合でこちらの表示が揺れる。10分置く。
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json && typeof json === 'object' ? json as Record<string, unknown> : null;
  } catch {
    // 時間切れ・名前が引けない・向こうが落ちている。
    // ここで投げるとページ全体が 500 になる。
    // 呼ぶ側が「いま出せません」を出せるよう null を返す。
    return null;
  }
}

/** 記事の一覧。取れなければ ok:false（「0件」と区別する）。 */
export async function listArticles(options: { limit?: number; page?: number } = {}): Promise<ArticleList> {
  const id = laruseoPublicId();
  if (!id) return { articles: [], hasMore: false, ok: false, reason: 'unconfigured' };

  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 12)));
  const page = Math.min(500, Math.max(1, Math.trunc(options.page ?? 1)));

  const json = await getJson(`/api/seo/public/${encodeURIComponent(id)}/articles?limit=${limit}&page=${page}`);
  if (!json) return { articles: [], hasMore: false, ok: false, reason: 'unreachable' };

  const rows = Array.isArray(json.articles) ? json.articles : [];
  const articles = rows.map(toSummary).filter((a): a is ArticleSummary => !!a);
  return { articles, hasMore: json.has_more === true, ok: true, reason: null };
}

/** 記事1本。無ければ null。 */
export async function getArticle(slug: string): Promise<Article | null> {
  const id = laruseoPublicId();
  if (!id || !isValidSlug(slug)) return null;

  const json = await getJson(`/api/seo/public_article_data/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`);
  const row = json?.article;
  if (!row || typeof row !== 'object') return null;

  const r = row as Record<string, unknown>;
  const summary = toSummary({ ...r, slug: isValidSlug(r.slug) ? r.slug : slug });
  if (!summary) return null;

  const raw = typeof r.content === 'string' ? r.content : '';
  if (!raw) return null;

  // content_format が html 以外（markdown など）で来たら、**HTMLとして解釈しない**。
  // こちらに markdown の解釈器を持ち込むと、向こうが形式を変えた日に
  // 記法がそのまま画面に出る。素の文字として出し、段落だけ作る。
  const format = text(r.content_format, 20).toLowerCase();
  const html = format && format !== 'html'
    ? raw.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
    : sanitizeArticleHtml(raw);

  return { ...summary, html };
}
