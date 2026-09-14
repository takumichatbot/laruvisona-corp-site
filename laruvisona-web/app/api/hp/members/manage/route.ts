import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { hpMemberId, hpMemberSiteId } from '@/lib/hp-member-contract';

export const dynamic = 'force-dynamic';

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

// オーナーが自サイトの会員を削除
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let memberId: string, siteId: string;
  try { memberId = hpMemberId(searchParams.get('memberId')); siteId = hpMemberSiteId(searchParams.get('siteId')); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }

  const service = admin();
  const { data: site, error: siteError } = await service.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: deleted, error } = await service.from('hp_members').delete().eq('id', memberId).eq('site_id', siteId).select('id');
  if (error) return NextResponse.json({ error: '会員を削除できませんでした' }, { status: 500 });
  if (deleted?.length !== 1) return NextResponse.json({ error: '会員が見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
