import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://laruvisona.jp';
  const now = new Date();

  return [
    // 会社サイト
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1.0 },

    // LARU HP
    { url: `${base}/laruHP`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/laruHP/auth/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/laruHP/auth/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/laruHP/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/laruHP/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/laruHP/tokusho`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
