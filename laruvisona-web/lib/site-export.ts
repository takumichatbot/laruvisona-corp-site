import type { Block, Page, SEOSettings, SiteSettings } from '@/types/laruHP';

/**
 * 保存形式は2種類ある。v1は Block[]、v2は { v:2, pages: Page[] }。
 * 公開と書き出しで読み方がずれると「公開できているのに書き出せない」が起きるので、
 * 読み方はここ1か所に置く。
 */
export function pagesFromBlocksJson(
  rawBlocks: Block[] | { v: number; pages: Page[] } | null | undefined,
  seo: SEOSettings,
): Page[] {
  if (Array.isArray(rawBlocks)) {
    return [{ id: 'page-main', name: 'トップページ', path: '/', blocks: rawBlocks, seo }];
  }
  if (rawBlocks && rawBlocks.v === 2 && Array.isArray(rawBlocks.pages) && rawBlocks.pages.length) {
    return rawBlocks.pages;
  }
  return [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo }];
}

/**
 * 書き出したファイルは、LARU HPの外へ持って出るためのもの。
 * LARU HP側のサーバーへ繋ぎにいく埋め込み（larubot・LARU SEO）は外す。
 * お客さま自身のGA計測IDは、お客さまのものなので残す。
 */
export function portableSettings(settings: SiteSettings): SiteSettings {
  return { ...settings, larubot: false, laruseo: false };
}

/** 日本語の屋号でも壊れないASCIIの控え名。日本語名は Content-Disposition の filename* 側で渡す。 */
export function exportFileName(siteName: string, at: Date = new Date()): { ascii: string; utf8: string } {
  const day = at.toISOString().slice(0, 10);
  const cleaned = (siteName || '')
    .split('')
    .filter((ch) => ch.charCodeAt(0) > 31 && !'\\/:*?"<>|'.includes(ch))
    .join('')
    .trim();
  const ascii = cleaned && /^[ -~]+$/.test(cleaned) ? cleaned.replace(/\s+/g, '_') : 'site';
  return { ascii: `laruHP_${ascii}_${day}.html`, utf8: `${cleaned || 'サイト'}_${day}.html` };
}
