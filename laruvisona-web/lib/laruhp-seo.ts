/** LARU HPの公開ページで共有するOGP画像。ページ固有metadataでも必ず明示する。 */
export const LARUHP_OG_IMAGE = {
  url: 'https://laruhp.com/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'LARU HP — ホームページ制作・運営サービス',
} as const;

/**
 * ページごとのOGP画像。/api/og が画像を作るのに、自社ページはどこも共通の1枚だった。
 * 記事11本・業種15本・比較4本をSNSへ貼ると、全部まったく同じ絵になっていた。
 *
 * 画像はアプリ側（laruvisona.jp）で作る。案内サイト（laruhp.com）は
 * /api/og を公開パスに持っていないため、絶対URLで指す。
 */
export function laruhpOgImage(title: string, desc = ''): { url: string; width: number; height: number; alt: string } {
  const query = new URLSearchParams({ title: title.slice(0, 60) });
  if (desc) query.set('desc', desc.slice(0, 80));
  return {
    url: `https://laruvisona.jp/api/og?${query.toString()}`,
    width: 1200,
    height: 630,
    alt: title,
  };
}
