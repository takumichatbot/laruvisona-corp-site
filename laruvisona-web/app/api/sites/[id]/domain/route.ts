import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import dns from 'dns/promises';

// PUT /api/sites/[id]/domain — set or clear custom domain
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { customDomain } = await req.json().catch(() => ({}));

  // Basic domain format validation
  const trimmed = (customDomain as string | undefined)?.trim() || null;
  if (trimmed && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return NextResponse.json({ error: 'ドメイン形式が正しくありません（例: example.com）' }, { status: 400 });
  }

  const { error } = await supabase
    .from('sites')
    .update({ custom_domain: trimmed })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, customDomain: trimmed });
}

// GET /api/sites/[id]/domain — check DNS CNAME record for the custom domain
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

  const target = process.env.VERCEL_URL
    ? `cname.vercel-dns.com`
    : `laruvisona.com`;

  try {
    const records = await dns.resolveCname(site.custom_domain);
    const matched = records.some(r => r.includes('vercel') || r.includes('laruvisona'));
    return NextResponse.json({
      verified: matched,
      cname: records[0] || null,
      expectedTarget: target,
      domain: site.custom_domain,
    });
  } catch {
    return NextResponse.json({
      verified: false,
      cname: null,
      expectedTarget: target,
      domain: site.custom_domain,
      reason: 'dns_lookup_failed',
    });
  }
}
