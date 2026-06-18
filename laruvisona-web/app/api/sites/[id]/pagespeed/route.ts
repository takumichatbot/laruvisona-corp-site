import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase
    .from('sites')
    .select('slug, published')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!site || !site.published || !site.slug) {
    return NextResponse.json({ error: 'Site not published' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laruvisona.com';
  const targetUrl = `${appUrl}/hp/${site.slug}`;
  const apiKey = process.env.PAGESPEED_API_KEY || '';
  const apiBase = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  const [mobile, desktop] = await Promise.all([
    fetch(`${apiBase}?url=${encodeURIComponent(targetUrl)}&strategy=mobile${apiKey ? `&key=${apiKey}` : ''}`).then(r => r.json()),
    fetch(`${apiBase}?url=${encodeURIComponent(targetUrl)}&strategy=desktop${apiKey ? `&key=${apiKey}` : ''}`).then(r => r.json()),
  ]);

  const extract = (result: Record<string, unknown>) => {
    const cats = (result as { lighthouseResult?: { categories?: Record<string, { score?: number }> } })?.lighthouseResult?.categories;
    if (!cats) return null;
    return {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
      bestPractices: Math.round(((cats['best-practices'] as { score?: number })?.score ?? 0) * 100),
    };
  };

  return NextResponse.json({
    url: targetUrl,
    mobile: extract(mobile as Record<string, unknown>),
    desktop: extract(desktop as Record<string, unknown>),
  });
}
