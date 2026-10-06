import type { Metadata } from 'next';

/**
 * 会社サイト（laruvisona.jp）のページごとの OGP・Twitter カード（2026-10-06）。
 * openGraph を書かないページは、ルートの既定（og:url がトップ・古い言い回し）をそのまま引き継いでいた。
 * 共有したときにトップのURLと別の題が出るので、題・説明・URL・画像をページの値で揃える。
 */
const ORIGIN = 'https://laruvisona.jp';
export const COMPANY_OG_IMAGE = { url: `${ORIGIN}/opengraph-image`, width: 1200, height: 630 };
const IMAGE = COMPANY_OG_IMAGE;

export function companyShareMeta(path: string, title: string, description: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  const url = path === '/' ? ORIGIN : `${ORIGIN}${path}`;
  return {
    openGraph: { title, description, url, siteName: '株式会社LaruVisona', type: 'website', locale: 'ja_JP', images: [IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [IMAGE.url] },
  };
}
