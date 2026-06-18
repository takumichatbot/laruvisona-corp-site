import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/sites/ab-track — increment AB variant view counter in settings_json
export async function POST(req: Request) {
  const { siteId, variant } = await req.json().catch(() => ({}));
  if (!siteId || !variant || !['a', 'b'].includes(variant)) {
    return NextResponse.json({ ok: false });
  }

  const supabase = getAdminClient();

  const { data: site } = await supabase
    .from('sites')
    .select('settings_json')
    .eq('id', siteId)
    .single();

  if (!site) return NextResponse.json({ ok: false });

  const settings = site.settings_json as Record<string, unknown> || {};
  const abStats = (settings.abStats as Record<string, number>) || { a: 0, b: 0 };
  abStats[variant] = (abStats[variant] || 0) + 1;

  await supabase
    .from('sites')
    .update({ settings_json: { ...settings, abStats } })
    .eq('id', siteId);

  return NextResponse.json({ ok: true });
}
