import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/sites/[id]/versions/[versionId] → restore
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, versionId } = await params;

  // Verify site ownership
  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', id).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get version data
  const { data: version, error: versionError } = await supabase
    .from('site_versions')
    .select('blocks_json, seo_json, settings_json')
    .eq('id', versionId)
    .eq('site_id', id)
    .single();

  if (versionError && versionError.code !== 'PGRST116') return NextResponse.json({ error: '履歴を確認できませんでした' }, { status: 503 });
  if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  // Restore
  const { data: restored, error } = await supabase
    .from('sites')
    .update({
      blocks_json: version.blocks_json,
      seo_json: version.seo_json,
      settings_json: version.settings_json,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id');

  if (error || restored?.length !== 1) return NextResponse.json({ error: '履歴を復元できませんでした' }, { status: 503 });

  return NextResponse.json({ ok: true });
}
