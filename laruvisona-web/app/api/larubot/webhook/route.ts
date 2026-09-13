import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Called by LARUbot to notify LARU HP of a user's public_id assignment
export async function POST(req: Request) {
  const secret = req.headers.get('x-laru-secret');
  if (!secret || secret !== process.env.LARU_HP_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { user_id, site_id, larubot_public_id, laruseo_public_id } = body as Record<string, unknown>;
  if (typeof user_id !== 'string' || !UUID.test(user_id)) {
    return NextResponse.json({ error: 'invalid user_id' }, { status: 400 });
  }
  if (site_id !== undefined && site_id !== null && site_id !== '' && (typeof site_id !== 'string' || !UUID.test(site_id))) {
    return NextResponse.json({ error: 'invalid site_id' }, { status: 400 });
  }
  if ((!larubot_public_id && !laruseo_public_id)
      || (larubot_public_id !== undefined && (typeof larubot_public_id !== 'string' || !PUBLIC_ID.test(larubot_public_id)))
      || (laruseo_public_id !== undefined && (typeof laruseo_public_id !== 'string' || !PUBLIC_ID.test(laruseo_public_id)))) {
    return NextResponse.json({ error: 'invalid public id' }, { status: 400 });
  }

  // Cookieのないサーバ間Webhookなので、一般クライアントではRLSに阻まれる。
  // 共有鍵の確認後だけservice roleを使い、必ずuser_idとの組を条件にする。
  const supabase = createServiceClient();

  if (site_id && (larubot_public_id || laruseo_public_id)) {
    // Update specific site's settings_json
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('settings_json')
      .eq('id', site_id)
      .eq('user_id', user_id)
      .single();

    if (siteError) return NextResponse.json({ error: 'site lookup failed' }, { status: 503 });
    if (!site) return NextResponse.json({ error: 'site not found' }, { status: 404 });
    const updated = {
        ...(site.settings_json as Record<string, unknown>),
        ...(larubot_public_id ? { larubotPublicId: larubot_public_id, larubot: true } : {}),
        ...(laruseo_public_id ? { laruseoPublicId: laruseo_public_id, laruseo: true } : {}),
      };
    const saved = await supabase
      .from('sites')
      .update({ settings_json: updated })
      .eq('id', site_id)
      .eq('user_id', user_id)
      .select('id');
    if (saved.error || saved.data?.length !== 1) {
      return NextResponse.json({ error: 'site update failed' }, { status: 503 });
    }
  } else if (user_id && (larubot_public_id || laruseo_public_id)) {
    // Update all sites for this user
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('id, settings_json')
      .eq('user_id', user_id);

    if (sitesError) return NextResponse.json({ error: 'site lookup failed' }, { status: 503 });
    if (!sites?.length) return NextResponse.json({ error: 'site not found' }, { status: 404 });
    for (const site of sites) {
      const updated = {
        ...(site.settings_json as Record<string, unknown>),
        ...(larubot_public_id ? { larubotPublicId: larubot_public_id, larubot: true } : {}),
        ...(laruseo_public_id ? { laruseoPublicId: laruseo_public_id, laruseo: true } : {}),
      };
      const saved = await supabase
        .from('sites')
        .update({ settings_json: updated })
        .eq('id', site.id)
        .eq('user_id', user_id)
        .select('id');
      if (saved.error || saved.data?.length !== 1) {
        return NextResponse.json({ error: 'site update failed' }, { status: 503 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
