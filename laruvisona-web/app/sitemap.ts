import { MetadataRoute } from 'next';
import { TROUBLES } from '@/lib/trouble-data';
import { WORKS } from '@/lib/works-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://laruvisona.jp';
  const now = new Date();

  return [
    // 会社サイト
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1.0 },

    // ロゴについて（ブランド）
    { url: `${base}/brand`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },

    // 受託開発サービス
    { url: `${base}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },

    // ブログ（LARU SEO 記事一覧）は、記事の本体が larubot.tokyo 側で描かれる。
    // こちらが返すHTMLには本文が1文字も無いので、sitemapからは外しておく。
    // 「毎週更新」と宣言しているのに中身が空、という状態にはしない。
    // サーバー側で記事を取って /blog/[slug] を実体化したら、ここへ戻す。

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
  ];
}
