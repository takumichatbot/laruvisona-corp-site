import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, adminPin, createAdminSession,
} from '@/lib/admin-session';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';
import { isAdminRequest } from '@/lib/adminAuth';

// 現在のセッションが有効かを返す（画面のロック状態をサーバー基準にするため）。
export async function GET(req: Request) {
  return NextResponse.json({ ok: await isAdminRequest(req) });
}

// 管理者 PIN の検証。総当たりを防ぐため IP あたり 5回/15分に制限する。
// Cookie には ADMIN_SECRET ではなく、期限付きの署名済みセッションを入れる。
export async function POST(req: Request) {
  const ip = clientIp(req);
  const key = `admin-verify:${ip}`;
  const rl = rateLimit(key, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: '試行回数が多すぎます。しばらく待って再度お試しください。' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const { pin } = await req.json().catch(() => ({ pin: '' }));
  const expected = adminPin();
  if (!expected || !pin || pin !== expected) {
    return NextResponse.json({ error: 'PINが正しくありません' }, { status: 401 });
  }

  const session = await createAdminSession();
  if (!session) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  resetRateLimit(key);
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

// ログアウト（セッション破棄）
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
