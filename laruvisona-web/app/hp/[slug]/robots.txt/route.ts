import { createClient } from '@supabase/supabase-js';
import { publicBase, siteUrl } from '@/lib/public-site-url';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = getAdminClient();

  const { data: site } = await supabase
    .from('sites')
    .select('slug, custom_domain, settings_json')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!site) {
    return new Response('Not found', { status: 404 });
  }

  const settings = (site.settings_json as Record<string, unknown>) || {};
  // Allow opt-out of indexing via settings
  const noIndex = settings.noIndex === true;

  // 独自ドメイン・サブドメイン・パス形式のどれで開かれたかに合わせる
  const base = publicBase(site as { slug?: string | null; custom_domain?: string | null }, req.headers.get('host'));
  const sitemapUrl = siteUrl(base, 'sitemap.xml');

  const txt = noIndex
    ? `User-agent: *\nDisallow: /\n`
    : `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`;

  return new Response(txt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
