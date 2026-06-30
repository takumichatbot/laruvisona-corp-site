import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, signMemberToken } from '@/lib/member-auth';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, email, password } = await req.json().catch(() => ({}));
  if (!siteId || !email || !password) return NextResponse.json({ error: 'メールとパスワードを入力してください' }, { status: 400 });

  const supabase = admin();
  const emailNorm = String(email).trim().toLowerCase();
  const { data: member } = await supabase
    .from('hp_members')
    .select('id, email, name, plan, status, password_hash')
    .eq('site_id', siteId)
    .eq('email', emailNorm)
    .maybeSingle();

  if (!member || !verifyPassword(String(password), member.password_hash)) {
    return NextResponse.json({ error: 'メールまたはパスワードが正しくありません' }, { status: 401 });
  }

  const token = signMemberToken({ id: member.id, siteId, email: emailNorm });
  return NextResponse.json({ token, member: { name: member.name, plan: member.plan, status: member.status } });
}
