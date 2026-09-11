import { createClient } from '@supabase/supabase-js';
import { canonicalBase, decodeSlug } from '@/lib/public-site-url';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = decodeSlug(rawSlug);
  const supabase = getAdminClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id, slug, custom_domain, updated_at, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site) {
    return new Response('Not found', { status: 404 });
  }

  // 正規URLは入口のホストに依存させない
  const loc = canonicalBase(site as { slug?: string | null; custom_domain?: string | null });
  const lastmod = site.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0];

  // Check if shop has active products
  const settings = (site.settings_json as Record<string, unknown>) || {};
  const products = (settings.products as Array<{ active: boolean }>) || [];
  const hasShop = products.some(p => p.active);

  // Check if translations are available
  const translations = (settings.translations as Record<string, { translatedAt: string }>) || {};
  const locales = Object.keys(translations);

  const urls: string[] = [
    `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`,
  ];

  if (hasShop) {
    urls.push(`  <url>
    <loc>${loc}/shop</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  // このサイトの公開済み記事だけを載せる。
  // 非公開の記事や、別サイトの記事は含めない。
  const { data: posts } = await supabase
    .from('news_posts')
    .select('id, published_at')
    .eq('site_id', site.id)
    .eq('published', true)
    .order('published_at', { ascending: false })
    .limit(1000);

  for (const post of (posts ?? []) as Array<{ id: string; published_at: string | null }>) {
    urls.push(`  <url>
    <loc>${loc}/post/${post.id}</loc>
    <lastmod>${post.published_at?.split('T')[0] || lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  for (const locale of locales) {
    urls.push(`  <url>
    <loc>${loc}?lang=${locale}</loc>
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
