/*
  会社サイトの sitemap.xml に、顧客の公開サイトを載せる。

  2026-09-18 に本番で確かめたこと:

    laruvisona.jp/sitemap.xml … /hp/ で始まる項目は **0件**
    laruvisona.jp/robots.txt  … Sitemap: は /sitemap.xml だけ

  公開されている顧客サイトは laruvisona.jp/hp/<slug> にあるが、
  検索側が読む唯一の sitemap に載っていない。
  /hp/<slug>/robots.txt は用意してあるものの、robots.txt は
  **ホストの直下しか読まれない** ので、パス形式のサイトでは誰も読まない。
  つまり、そこに書いてある /hp/<slug>/sitemap.xml へも辿り着けない。

  外からのリンクが無ければ、公開しても検索に出ない。
  「公開できた」と本人は思っている。これも、壊れているのに
  誰にも知らされない形である。

  ⚠️ 独自ドメインのサイトは載せない。
    正規URLがそちらのドメインなので、こちらに載せると別ホストのURLを
    こちらの sitemap が主張することになる。あちらはドメイン直下に
    robots.txt と sitemap.xml が出るので、そちらで拾われる。

  ⚠️ noIndex を選んだ人も載せない（/hp/<slug>/robots.txt と同じ判断）。
*/
import { createClient } from '@supabase/supabase-js';

export interface PublishedSiteEntry {
  slug: string;
  updatedAt: Date | null;
}

/** sitemap が長くなりすぎないようにする。上限は 50,000 件（検索側の仕様）。 */
export const SITEMAP_SITE_LIMIT = 2000;

/**
 * パス形式で公開されている顧客サイトの一覧。
 *
 * 取りに行けなかった日は **空で返す**。
 * ここで投げると会社サイトの sitemap.xml が丸ごと 500 になる。
 * 顧客サイトが載らない日があるより、そちらのほうが痛い。
 */
export async function listPublishedPathSites(): Promise<PublishedSiteEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from('sites')
      .select('slug, custom_domain, settings_json, updated_at')
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(SITEMAP_SITE_LIMIT);

    if (error || !data) return [];

    const out: PublishedSiteEntry[] = [];
    for (const row of data as Array<{
      slug: string | null;
      custom_domain: string | null;
      settings_json: Record<string, unknown> | null;
      updated_at: string | null;
    }>) {
      const slug = (row.slug || '').trim();
      if (!slug) continue;
      if ((row.custom_domain || '').trim()) continue;
      if ((row.settings_json || {}).noIndex === true) continue;
      const t = row.updated_at ? new Date(row.updated_at) : null;
      out.push({ slug, updatedAt: t && !Number.isNaN(t.getTime()) ? t : null });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * sitemap に書くURL。
 *
 * ⚠️ slug は日本語を許している（「のぞみ整体院-mtxas3cy」など）。
 *   sitemap.xml のURLは百分率記法にしておく必要がある。
 *   生のまま書くと、その1行のせいで検索側がファイルごと読まないことがある。
 */
export function sitemapUrlForSlug(base: string, slug: string): string {
  return `${base.replace(/\/$/, '')}/hp/${encodeURIComponent(slug)}`;
}
