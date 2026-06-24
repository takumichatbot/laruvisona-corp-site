import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  if (!process.env.ADMIN_SECRET || !process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', process.env.ADMIN_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
