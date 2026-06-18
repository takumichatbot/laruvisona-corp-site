import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.com';
  return {
    rules: [
      { userAgent: '*', allow: '/hp/', disallow: ['/laruHP/', '/api/'] },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
