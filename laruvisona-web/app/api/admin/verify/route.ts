import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { pin } = await req.json();
  if (!pin || !process.env.ADMIN_SECRET || pin !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'PINが正しくありません' }, { status: 401 });
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
