import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.jp';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/laruHP/', '/hp/'],
        disallow: [
          '/api/',
          '/laruHP/dashboard',
          '/laruHP/builder',
          '/laruHP/crm',
          '/laruHP/settings',
          '/laruHP/admin',
          '/laruHP/auth/',
          '/laruHP/newsletter',
          '/laruHP/contacts',
          '/laruHP/blog',
          '/laruHP/booking',
          '/laruHP/larubot-logs',
          '/laruHP/invite/',
          '/laruHP/r/',
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
