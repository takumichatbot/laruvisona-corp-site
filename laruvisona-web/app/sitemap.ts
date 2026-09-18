import { MetadataRoute } from 'next';
import { TROUBLES } from '@/lib/trouble-data';
import { WORKS } from '@/lib/works-data';
import { listArticles } from '@/lib/laruseo-articles';
import { listPublishedPathSites, sitemapUrlForSlug } from '@/lib/published-sites-index';

/*
  公開のたびに変わるので、作り置きにしない。
  ⚠️ 無しにすると組み立て時の一覧が焼き付き、あとから公開した人が
     いつまでも載らない。
*/
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://laruvisona.jp';
  const now = new Date();

  // ブログは記事があるときだけ載せる。
  // 取りに行けなかった日も 0件で返るので、結果としてその日は載らない。
  const { articles } = await listArticles({ limit: 50 });

  /*
    顧客が公開したサイト。ここに載せるまで、検索側から辿る道が無かった。
    独自ドメインの人と、noIndex を選んだ人は入っていない。
    取得に失敗した日は 0件で返るので、その日は載らない（会社サイトの
    sitemap 自体は出る）。
  */
  const customerSites = await listPublishedPathSites();

  return [

    // 会社サイト
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1.0 },

    // ロゴについて（ブランド）
    { url: `${base}/brand`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },

    // 受託開発サービス
    { url: `${base}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // ブログ。2026-09-17 にサーバー側描画へ切り替えたので、本文がHTMLに載る。
    // ただし **記事が0件のあいだは載せない**。中身の無いページを
    // 「毎週更新」と宣言して出すと、サイト全体の評価が下がる。
    ...(articles.length
      ? [
          { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
          ...articles.map(a => ({
            url: `${base}/blog/${a.slug}`,
            lastModified: a.updatedAt ? new Date(a.updatedAt) : now,
            changeFrequency: 'monthly' as const,
            priority: 0.6,
          })),
        ]
      : []),

    // 地域。1本だけ。量産すると誘導ページ扱いになる。
    { url: `${base}/local`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },

    // 困りごと別の入口。検索から直接ここへ降りてくることを狙っている。
    { url: `${base}/trouble`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...TROUBLES.map(t => ({
      url: `${base}/trouble/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),

    // 開発実績。以前ここに無かったため、書いてある3ページを検索側が
    // 一度も見ていなかった。受託を探している人がいちばん見たい種類のページである。
    { url: `${base}/works`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...WORKS.map(w => ({
      url: `${base}/works/${w.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    { url: `${base}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },

    // 顧客の公開サイト。会社の項目のあと。
    ...customerSites.map(site => ({
      url: sitemapUrlForSlug(base, site.slug),
      lastModified: site.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
