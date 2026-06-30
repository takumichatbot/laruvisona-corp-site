import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyResetToken, hashPassword, signMemberToken } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  if (String(password).length < 6) return NextResponse.json({ error: 'パスワードは6文字以上にしてください' }, { status: 400 });

  const payload = verifyResetToken(token);
  if (!payload) return NextResponse.json({ error: 'リンクが無効か期限切れです。もう一度お試しください。' }, { status: 400 });

  const supabase = admin();
  const { data: member, error } = await supabase
    .from('hp_members')
    .update({ password_hash: hashPassword(String(password)) })
    .eq('id', payload.mid)
    .eq('site_id', payload.sid)
    .select('id, email, name, plan, status')
    .single();
  if (error || !member) return NextResponse.json({ error: '再設定に失敗しました' }, { status: 500 });

  const newToken = signMemberToken({ id: member.id, siteId: payload.sid, email: member.email });
  return NextResponse.json({ token: newToken, member: { name: member.name, plan: member.plan, status: member.status } });
}
