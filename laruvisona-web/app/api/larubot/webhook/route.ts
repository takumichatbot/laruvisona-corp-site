import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Called by LARUbot to notify LARU HP of a user's public_id assignment
export async function POST(req: Request) {
  const secret = req.headers.get('x-laru-secret');
  if (!secret || secret !== process.env.LARU_HP_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { user_id, site_id, larubot_public_id, laruseo_public_id } = body;
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const supabase = await createClient();

  if (site_id && (larubot_public_id || laruseo_public_id)) {
    // Update specific site's settings_json
    const { data: site } = await supabase
      .from('sites')
      .select('settings_json')
      .eq('id', site_id)
      .eq('user_id', user_id)
      .single();

    if (site) {
      const updated = {
        ...(site.settings_json as Record<string, unknown>),
        ...(larubot_public_id ? { larubotPublicId: larubot_public_id, larubot: true } : {}),
        ...(laruseo_public_id ? { laruseoPublicId: laruseo_public_id, laruseo: true } : {}),
      };
      await supabase
        .from('sites')
        .update({ settings_json: updated })
        .eq('id', site_id)
        .eq('user_id', user_id);
    }
  } else if (user_id && (larubot_public_id || laruseo_public_id)) {
    // Update all sites for this user
    const { data: sites } = await supabase
      .from('sites')
      .select('id, settings_json')
      .eq('user_id', user_id);

    for (const site of sites || []) {
      const updated = {
        ...(site.settings_json as Record<string, unknown>),
        ...(larubot_public_id ? { larubotPublicId: larubot_public_id, larubot: true } : {}),
        ...(laruseo_public_id ? { laruseoPublicId: laruseo_public_id, laruseo: true } : {}),
      };
      await supabase
        .from('sites')
        .update({ settings_json: updated })
        .eq('id', site.id);
    }
  }

  return NextResponse.json({ ok: true });
}
