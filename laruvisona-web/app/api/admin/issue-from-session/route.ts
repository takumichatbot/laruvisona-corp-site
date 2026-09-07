import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, createAdminSession } from '@/lib/admin-session';

// ログイン中の管理者アカウントから管理者セッションを発行する（PIN 入力の代替）。
export async function POST() {
  if (!process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
  if (!user || (user.email || '').toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }
  const session = await createAdminSession();
  if (!session) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });
  return res;
}
