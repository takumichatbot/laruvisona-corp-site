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
    .select('slug, settings_json')
    .eq('custom_domain', normalized)
    .eq('published', true)
    .single();

  if (!site) {
    return new Response('Not found', { status: 404 });
  }

  const settings = (site.settings_json as Record<string, unknown>) || {};
  // Allow opt-out of indexing via settings
  const noIndex = settings.noIndex === true;

  const sitemapUrl = `https://${normalized}/sitemap.xml`;

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
