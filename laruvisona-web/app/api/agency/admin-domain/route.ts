import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // agencyプランのみ
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single();
  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  if (!isAdmin && profile?.plan !== 'agency') {
    return NextResponse.json({ error: 'agencyプランが必要です' }, { status: 403 });
  }

  const { domain } = await req.json().catch(() => ({}));
  const trimmed = (domain as string | undefined)?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') || null;
  if (trimmed && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return NextResponse.json({ error: 'ドメイン形式が正しくありません（例: admin.example.com）' }, { status: 400 });
  }

  const service = admin();
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

  const { error } = await service.from('profiles').update({ agency_admin_domain: trimmed }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Render にカスタムドメイン登録（任意・要 RENDER_API_KEY/SERVICE_ID）
  let renderStatus: string | null = null;
  if (trimmed && process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
    try {
      const r = await fetch(`https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/custom-domains`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RENDER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const rd = await r.json() as { verificationStatus?: string; message?: string };
      renderStatus = r.ok ? (rd.verificationStatus || 'registered') : (rd.message || 'render_error');
    } catch { renderStatus = 'render_unreachable'; }
  }

  return NextResponse.json({ ok: true, domain: trimmed, renderStatus });
}
