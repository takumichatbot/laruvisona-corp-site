import { MetadataRoute } from 'next';
import { TROUBLES } from '@/lib/trouble-data';

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

    // ブログ（LARU SEO 記事一覧）
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },

    // 困りごと別の入口。検索から直接ここへ降りてくることを狙っている。
    { url: `${base}/trouble`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...TROUBLES.map(t => ({
      url: `${base}/trouble/${t.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),

    { url: `${base}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
