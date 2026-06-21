import { MetadataRoute } from 'next';

const INDUSTRY_IDS = [
  'restaurant', 'beauty', 'clinic', 'legal', 'construction',
  'realestate', 'retail', 'fitness', 'hotel', 'education',
  'wedding', 'pet', 'dental', 'photo', 'accounting',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://laruvisona.jp';
  const now = new Date();

  const industryEntries: MetadataRoute.Sitemap = INDUSTRY_IDS.map(id => ({
    url: `${base}/laruHP/${id}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [
    // 会社サイト
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1.0 },

    // LARU HP メイン
    { url: `${base}/laruHP`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },

    // 業種特化LP（15業種）
    ...industryEntries,

    // 認証・法的ページ
    { url: `${base}/laruHP/auth/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/laruHP/auth/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/laruHP/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/laruHP/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/laruHP/tokusho`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
