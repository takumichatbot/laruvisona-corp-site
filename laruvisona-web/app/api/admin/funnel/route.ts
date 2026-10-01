import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { hpFunnel, type SiteRow } from '@/lib/hp-funnel';

/*
  LARU HP の作成 → 編集 → 公開の集計（管理者だけ・読むだけ・数だけ）。2026-10-01。
  5.0（LaruVisona 社内の経営の画面）の計画 #3 が、推測ではなく実データで止まる段階を見るため。
*/
async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminEmail(user.email);
}

export async function GET() {
  const supabase = await createClient();
  if (!await isAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const service = await createServiceClient();

  const internal = new Set<string>();
  let page = 1;
  while (true) {
    const { data } = await service.auth.admin.listUsers({ perPage: 1000, page });
    const users = data?.users ?? [];
    for (const u of users) if (isAdminEmail(u.email)) internal.add(u.id);
    if (users.length < 1000) break;
    page++;
  }
  const { data: sites, error } = await service
    .from('sites')
    .select('user_id, published, created_at, updated_at, slug, custom_domain');
  if (error) return NextResponse.json({ error: 'read_failed' }, { status: 500 });

  return NextResponse.json({
    business: 'laru_hp',
    source: 'laruvisona.jp/api/admin/funnel（sites・auth.users の件数だけ）',
    generated_at: new Date().toISOString(),
    period: 'all_time',
    excluded: '管理者のメール（isAdminEmail）の人のサイト',
    ...hpFunnel((sites ?? []) as SiteRow[], internal),
  });
}
