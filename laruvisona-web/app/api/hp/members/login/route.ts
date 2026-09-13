import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, signMemberToken } from '@/lib/member-auth';
import { clientIp } from '@/lib/rate-limit';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { parseHpMemberLogin, readHpMemberBody } from '@/lib/hp-member-contract';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  let input;
  try { input = parseHpMemberLogin(await readHpMemberBody(req)); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const { siteId, email: emailNorm, password } = input;
  if (!password) return NextResponse.json({ error: 'メールまたはパスワードが正しくありません' }, { status: 401 });

  const supabase = admin();

  // 総当たり対策。IP単位（同一IPから多数のアカウントを試す）と
  // アカウント単位（多数のIPから1アカウントを試す）の両方を止める。
  const ip = clientIp(req);
  const [ipRate, accountRate] = await Promise.all([
    claimPublicRate(supabase, 'member-login-ip', ip, 30, 600),
    claimPublicRate(supabase, 'member-login-account', `${siteId}:${emailNorm}`, 8, 600),
  ]);
  if (ipRate === 'limited' || accountRate === 'limited') {
    return NextResponse.json(
      { error: '試行回数が多すぎます。しばらくしてからお試しください。' },
      { status: 429 },
    );
  }
  if (ipRate === 'unavailable' || accountRate === 'unavailable') return NextResponse.json({ error: 'ログイン状態を確認できませんでした' }, { status: 503 });
  const { data: member, error } = await supabase
    .from('hp_members')
    .select('id, email, name, plan, status, password_hash')
    .eq('site_id', siteId)
    .eq('email', emailNorm)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'ログイン状態を確認できませんでした' }, { status: 500 });
  if (!member || member.status !== 'active' || !verifyPassword(password, member.password_hash)) {
    return NextResponse.json({ error: 'メールまたはパスワードが正しくありません' }, { status: 401 });
  }

  const token = signMemberToken({ id: member.id, siteId, email: emailNorm });
  return NextResponse.json({ token, member: { name: member.name, plan: member.plan, status: member.status } });
}
