import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;
  const normalized = decodeURIComponent(domain).toLowerCase();
  const supabase = getAdminClient();

  const { data: site } = await supabase
    .from('sites')
    .select('slug, updated_at, settings_json')
    .eq('custom_domain', normalized)
    .eq('published', true)
    .single();

  if (!site) {
    return new Response('Not found', { status: 404 });
  }

  const loc = `https://${normalized}`;
  const lastmod = site.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0];

  const settings = (site.settings_json as Record<string, unknown>) || {};

  // Check if translations are available
  const translations = (settings.translations as Record<string, { translatedAt: string }>) || {};
  const locales = Object.keys(translations);

  // 独自ドメインでは全パスがトップにリライトされるため /shop は載せない
  const urls: string[] = [
    `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
  ];

  for (const locale of locales) {
    urls.push(`  <url>
    <loc>${loc}/?lang=${locale}</loc>
    <lastmod>${translations[locale].translatedAt?.split('T')[0] || lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
