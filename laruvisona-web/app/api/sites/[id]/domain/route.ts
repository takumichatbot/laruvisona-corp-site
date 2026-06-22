import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import dns from 'dns/promises';

// PUT /api/sites/[id]/domain — set or clear custom domain + register with Render
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customDomain } = await req.json().catch(() => ({}));

  const trimmed = (customDomain as string | undefined)?.trim().toLowerCase().replace(/^https?:\/\//, '') || null;
  if (trimmed && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return NextResponse.json({ error: 'ドメイン形式が正しくありません（例: example.com）' }, { status: 400 });
  }

  // Check duplicate
  if (trimmed) {
    const { data: dup } = await supabase.from('sites').select('id').eq('custom_domain', trimmed).neq('id', id).limit(1);
    if (dup && dup.length > 0) {
      return NextResponse.json({ error: 'このドメインはすでに別のサイトに設定されています' }, { status: 409 });
    }
  }

  // Save to DB
  const { error: dbError } = await supabase
    .from('sites')
    .update({ custom_domain: trimmed })
    .eq('id', id)
    .eq('user_id', user.id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Register with Render API (optional — requires RENDER_API_KEY + RENDER_SERVICE_ID)
  let renderStatus: string | null = null;
  if (trimmed && process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
    try {
      const renderRes = await fetch(
        `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/custom-domains`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      const renderData = await renderRes.json() as { id?: string; verificationStatus?: string; message?: string };
      renderStatus = renderRes.ok ? (renderData.verificationStatus || 'registered') : (renderData.message || 'render_error');
    } catch {
      renderStatus = 'render_unreachable';
    }
  }

  return NextResponse.json({ ok: true, customDomain: trimmed, renderStatus });
}

// GET /api/sites/[id]/domain — check DNS CNAME and Render verification status
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data: site } = await supabase
    .from('sites')
    .select('custom_domain, slug')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!site.custom_domain) return NextResponse.json({ verified: false, reason: 'no_domain' });

  // Render service slug for CNAME target
  const renderServiceSlug = process.env.RENDER_SERVICE_SLUG || process.env.RENDER_SERVICE_ID || 'your-app';
  const expectedTarget = `${renderServiceSlug}.onrender.com`;

  // Check DNS CNAME
  let cname: string | null = null;
  let dnsVerified = false;
  try {
    const records = await dns.resolveCname(site.custom_domain);
    cname = records[0] || null;
    dnsVerified = records.some(r => r.includes('onrender.com') || r.includes(renderServiceSlug));
  } catch {
    // DNS lookup failed — domain not propagated yet
  }

  // Check Render verification status if API key is configured
  let renderVerified: boolean | null = null;
  if (process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
    try {
      const renderRes = await fetch(
        `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/custom-domains`,
        { headers: { 'Authorization': `Bearer ${process.env.RENDER_API_KEY}` } }
      );
      if (renderRes.ok) {
        const domains = await renderRes.json() as Array<{ customDomain: { name: string; verificationStatus: string } }>;
        const found = domains.find(d => d.customDomain?.name === site.custom_domain);
        renderVerified = found?.customDomain?.verificationStatus === 'verified';
      }
    } catch {/* ignore */}
  }

  return NextResponse.json({
    verified: dnsVerified || renderVerified === true,
    dnsVerified,
    renderVerified,
    cname,
    expectedTarget,
    domain: site.custom_domain,
  });
}
