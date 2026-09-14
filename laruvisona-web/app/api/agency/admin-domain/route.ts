import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';
import { isReservedHost, normalizeDomain } from '@/lib/domain';
import { registerDomain, renderConfig } from '@/lib/render-domains';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // agencyプランのみ
  const { data: profile, error: profileError } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
  if (profileError) return NextResponse.json({ error: '契約を確認できませんでした' }, { status: 503 });
  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  if (!isAdmin && profile?.plan !== 'agency') {
    return NextResponse.json({ error: 'agencyプランが必要です' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 10_000); } catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  if (Object.keys(body).some(key => key !== 'domain') || (body.domain !== null && typeof body.domain !== 'string')) {
    return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  }
  let trimmed: string | null = null;
  if (typeof body.domain === 'string' && body.domain.trim()) {
    const normalized = normalizeDomain(body.domain);
    if (!normalized.ok || isReservedHost(normalized.value.host, process.env.NEXT_PUBLIC_APP_URL)) {
      return NextResponse.json({ error: normalized.ok ? 'このドメインは利用できません' : normalized.error }, { status: 400 });
    }
    trimmed = normalized.value.host;
  }
  const cfg = renderConfig();
  if (trimmed && !cfg) return NextResponse.json({ error: 'ドメイン接続は現在利用できません' }, { status: 503 });

  const service = createServiceClient();
  if (trimmed) {
    // 他サイトの独自ドメイン・他代理店の管理ドメインと重複しないか
    const [{ data: dupSite }, { data: dupProf }] = await Promise.all([
      service.from('sites').select('id').eq('custom_domain', trimmed).limit(1),
      service.from('profiles').select('id').eq('agency_admin_domain', trimmed).neq('id', user.id).limit(1),
    ]);
    if ((dupSite && dupSite.length) || (dupProf && dupProf.length)) {
      return NextResponse.json({ error: 'このドメインは既に使われています' }, { status: 409 });
    }
  }

  const { error, data } = await service.from('profiles').update({ agency_admin_domain: trimmed }).eq('id', user.id).select('id');
  if (error || data?.length !== 1) return NextResponse.json({ error: '管理ドメインを保存できませんでした' }, { status: 503 });

  // Render にカスタムドメイン登録（任意・要 RENDER_API_KEY/SERVICE_ID）
  let renderStatus: string | null = null;
  if (trimmed && cfg) {
    const registered = await registerDomain(cfg, trimmed);
    renderStatus = registered.ok ? (registered.alreadyExisted ? 'already_registered' : 'registered') : registered.code;
    if (!registered.ok) return NextResponse.json({ error: '外部のドメイン登録を完了できませんでした', domain: trimmed, renderStatus }, { status: 502 });
  }

  return NextResponse.json({ ok: true, domain: trimmed, renderStatus });
}
