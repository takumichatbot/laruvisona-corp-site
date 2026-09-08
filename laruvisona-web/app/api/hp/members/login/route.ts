import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, signMemberToken } from '@/lib/member-auth';
import { rateLimit, resetRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
  const { siteId, email, password } = await req.json().catch(() => ({}));
  if (!siteId || !email || !password) return NextResponse.json({ error: 'メールとパスワードを入力してください' }, { status: 400 });

  const supabase = admin();
  const emailNorm = String(email).trim().toLowerCase();

  // 総当たり対策。IP単位（同一IPから多数のアカウントを試す）と
  // アカウント単位（多数のIPから1アカウントを試す）の両方を止める。
  const ip = clientIp(req);
  const ipKey = `member-login-ip:${ip}`;
  const acctKey = `member-login-acct:${siteId}:${emailNorm}`;
  const ipRl = rateLimit(ipKey, 30, 10 * 60 * 1000);
  const acctRl = rateLimit(acctKey, 8, 10 * 60 * 1000);
  if (!ipRl.ok || !acctRl.ok) {
    const retry = Math.max(ipRl.retryAfterSec, acctRl.retryAfterSec);
    return NextResponse.json(
      { error: '試行回数が多すぎます。しばらくしてからお試しください。' },
      { status: 429, headers: { 'Retry-After': String(retry) } },
    );
  }
  const { data: member } = await supabase
    .from('hp_members')
    .select('id, email, name, plan, status, password_hash')
    .eq('site_id', siteId)
    .eq('email', emailNorm)
    .maybeSingle();

  if (!member || !verifyPassword(String(password), member.password_hash)) {
    return NextResponse.json({ error: 'メールまたはパスワードが正しくありません' }, { status: 401 });
  }

  // 成功したら、この人のぶんのカウントは戻す
  resetRateLimit(ipKey);
  resetRateLimit(acctKey);

  const token = signMemberToken({ id: member.id, siteId, email: emailNorm });
  return NextResponse.json({ token, member: { name: member.name, plan: member.plan, status: member.status } });
}
