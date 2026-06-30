import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hashPassword, signMemberToken } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, email, password, name, _hp } = await req.json().catch(() => ({}));
  if (_hp) return NextResponse.json({ ok: true });
  if (!siteId || !email || !password) return NextResponse.json({ error: 'メールとパスワードを入力してください' }, { status: 400 });
  if (String(password).length < 6) return NextResponse.json({ error: 'パスワードは6文字以上にしてください' }, { status: 400 });

  const supabase = admin();
  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('published', true).single();
  if (!site) return NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 });

  const emailNorm = String(email).trim().toLowerCase();
  const { data: existing } = await supabase.from('hp_members').select('id').eq('site_id', siteId).eq('email', emailNorm).maybeSingle();
  if (existing) return NextResponse.json({ error: 'このメールは既に登録されています' }, { status: 409 });

  const { data: member, error } = await supabase.from('hp_members').insert({
    site_id: siteId,
    email: emailNorm,
    password_hash: hashPassword(String(password)),
    name: name || null,
    plan: 'free',
    status: 'active',
  }).select('id, email, name, plan, status').single();

  if (error || !member) {
    if ((error as { code?: string })?.code === '23505') return NextResponse.json({ error: 'このメールは既に登録されています' }, { status: 409 });
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
  }

  const token = signMemberToken({ id: member.id, siteId, email: emailNorm });
  return NextResponse.json({ token, member: { name: member.name, plan: member.plan, status: member.status } });
}
