/**
 * 公開ページの head・構造化データ・OGカードに出す値を、「公開した時点の内容」から決める。
 *
 *   1. 公開HTMLの <head> の title・description・og:・twitter:（いつも、ここが正）
 *   2. 新しい公開HTMLは <!--lhpmeta--> にサイト名・事業者情報・カードの色も持っている
 *   3. それが無い（以前の）公開HTMLでは、公開時点の版（site_versions）が
 *      「今の公開HTMLの元」だと確かめられたときだけ、版の事業者情報・カードの色を使う
 *      （下書き＝版、かつ 版を今の書き出しで描いた head と本文の指紋が公開HTMLと一致）
 *   確かめられなければ、下書きへは戻らない。公開HTMLの head にある値だけで出し、
 *   事業者情報などは出さない（理由を返す）。
 *
 * 認可・契約・公開／非公開・正規URL・検索エンジンへの指示（noindex）は、
 * ここでは扱わない（呼ぶ側が今の状態で決める）。
 */
import { exportToHTML } from './html-export';
import { pagesFromBlocksJson } from './site-export';
import { bodyFingerprint, httpUrl, isAutoOgImage, readPublishedHead } from './published-head';
import { canonicalJson } from './republish-source';
import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

export type SiteRow = {
  id: string;
  name?: string | null;
  slug?: string | null;
  industry?: string | null;
  published_html?: string | null;
  blocks_json?: unknown;
  seo_json?: unknown;
  settings_json?: unknown;
};
export type VersionRow = { blocks_json: unknown; seo_json: unknown; settings_json: unknown } | null | undefined;

export type SnapshotCheck = { ok: true } | { ok: false; reason: 'no_snapshot' | 'unpublished_changes' | 'head_mismatch' | 'content_mismatch' };

/**
 * 版が「今の公開HTMLの元」か。部品IDではなく、見出し・説明（head）と、
 * 本文の文字・リンク・写真・代替テキストの並び（指紋）で比べる。
 * 書き出しの版が違って文字が変わった場合も「一致しない」になる（安全側）。
 */
export function snapshotMatchesPublished(site: SiteRow, version: VersionRow): SnapshotCheck {
  if (!version) return { ok: false, reason: 'no_snapshot' };
  const seo = (version.seo_json ?? {}) as SEOSettings;
  const html = exportToHTML(
    pagesFromBlocksJson(version.blocks_json as Block[] | { v: number; pages: Page[] }, seo),
    seo,
    (version.settings_json ?? {}) as SiteSettings,
    String(site.name ?? ''),
    { name: String(site.name ?? ''), industry: site.industry ?? undefined, siteId: site.id, slug: site.slug ?? undefined },
  );
  const a = readPublishedHead(String(site.published_html ?? '')), b = readPublishedHead(html);
  const keys = ['title', 'description', 'ogTitle', 'ogDescription', 'twitterTitle', 'twitterDescription'] as const;
  if (keys.some((k) => a[k] !== b[k])) return { ok: false, reason: 'head_mismatch' };
  if (bodyFingerprint(String(site.published_html ?? '')) !== bodyFingerprint(html)) return { ok: false, reason: 'content_mismatch' };
  return { ok: true };
}

export type PublishedPresentation = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  /** 自分で指定したOG画像（公開時点）。無ければ空（自動生成のカードを使う） */
  explicitOgImage: string;
  /** 構造化データ・OGカードの名前 */
  siteName: string;
  businessInfo: Record<string, unknown>;
  primaryColor?: string;
  /** どこから決めたか（確認・ログ用） */
  source: 'embedded' | 'verified_snapshot' | 'published_head_only';
  reason?: string;
};

export function resolvePublishedPresentation(site: SiteRow, latestVersion: VersionRow): PublishedPresentation {
  const head = readPublishedHead(String(site.published_html ?? ''));
  const title = head.title || 'ホームページ';
  const base = {
    title,
    description: head.description,
    ogTitle: head.ogTitle || title,
    ogDescription: head.ogDescription || head.description,
  };
  const ownOg = head.ogImage && !isAutoOgImage(head.ogImage) ? head.ogImage : '';
  if (head.meta) {
    return {
      ...base, explicitOgImage: ownOg, siteName: head.meta.siteName || title,
      businessInfo: head.meta.businessInfo ?? {}, primaryColor: head.meta.primaryColor, source: 'embedded',
    };
  }
  // 以前の公開HTML：版が元だと確かめられたときだけ、版の値を使う
  let check: SnapshotCheck;
  if (!latestVersion) check = { ok: false, reason: 'no_snapshot' };
  else if (canonicalJson(site.blocks_json) !== canonicalJson(latestVersion.blocks_json)
    || canonicalJson(site.seo_json) !== canonicalJson(latestVersion.seo_json)
    || canonicalJson(site.settings_json) !== canonicalJson(latestVersion.settings_json)) check = { ok: false, reason: 'unpublished_changes' };
  else check = snapshotMatchesPublished(site, latestVersion);
  if (check.ok) {
    const st = (latestVersion!.settings_json ?? {}) as { businessInfo?: Record<string, unknown>; primaryColor?: unknown };
    const bi = st.businessInfo && typeof st.businessInfo === 'object' && !Array.isArray(st.businessInfo) ? st.businessInfo : {};
    return {
      ...base, explicitOgImage: ownOg || httpUrl(bi.ogImage), siteName: title, businessInfo: bi,
      primaryColor: typeof st.primaryColor === 'string' && /^#[0-9a-f]{3,8}$/i.test(st.primaryColor) ? st.primaryColor : undefined,
      source: 'verified_snapshot',
    };
  }
  return { ...base, explicitOgImage: ownOg, siteName: title, businessInfo: {}, source: 'published_head_only', reason: check.reason };
}

/**
 * 公開ページから呼ぶ入口。版を読むのは、公開HTMLに補足（lhpmeta）が無い以前のHTMLのときだけ。
 * 版を読めなかったときは版が無いのと同じ扱い（下書きへは戻らない）。
 */
export async function loadPublishedPresentation(
  db: import('@supabase/supabase-js').SupabaseClient,
  site: SiteRow,
): Promise<PublishedPresentation> {
  if (readPublishedHead(String(site.published_html ?? '')).meta) return resolvePublishedPresentation(site, null);
  const { data, error } = await db
    .from('site_versions')
    .select('blocks_json, seo_json, settings_json, created_at')
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(1);
  return resolvePublishedPresentation(site, error ? null : (data?.[0] ?? null));
}
