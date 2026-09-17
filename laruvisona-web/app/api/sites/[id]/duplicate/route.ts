import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { siteCreationAccess } from '@/lib/site-creation-access';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: original, error: originalError } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (originalError && originalError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('plan,subscription_status').eq('id', user.id).single();
  if (profileError || !profile) return NextResponse.json({ error: 'ご契約を確認できませんでした' }, { status: 503 });
  const access = siteCreationAccess(user.email, profile?.plan ?? null, profile?.subscription_status ?? null,
    [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]);
  // 複製も、止めるのは数だけ。契約の有無で門前払いはしない（作成と同じ）。

  const slugBase = String(original.slug || 'site').slice(0, 42).replace(/-+$/, '') || 'site';
  const slug = `${slugBase}-copy-${Date.now().toString(36)}`;
  const copyName = `${String(original.name || 'サイト').slice(0, 114)} (コピー)`;

  const result = await createServiceClient().rpc('laruhp_create_site', {
    p_user: user.id, p_limit: access.limit, p_name: copyName, p_slug: slug,
    p_industry: typeof original.industry === 'string' ? original.industry.slice(0, 80) : null, p_blocks: original.blocks_json,
    p_seo: original.seo_json, p_settings: original.settings_json,
  });
  if (result.error || !result.data || typeof result.data !== 'object') {
    return NextResponse.json({ error: 'サイトを複製できませんでした' }, { status: 503 });
  }
  const outcome = result.data as { ok?: boolean; reason?: string; site?: unknown; count?: number };
  if (!outcome.ok && outcome.reason === 'site_limit') {
    return NextResponse.json({
      error: access.paying
        ? `現在のプランではサイトを${access.limit}件まで作成できます`
        : `無料でお試しいただけるサイトは${access.limit}つです。公開するときにプランをお選びください。`,
      code: 'site_limit', limit: access.limit, current: outcome.count, free: !access.paying,
    }, { status: 403 });
  }
  if (!outcome.ok || !outcome.site) return NextResponse.json({ error: 'サイトを複製できませんでした' }, { status: 503 });
  return NextResponse.json({ site: outcome.site }, { status: 201 });
}
