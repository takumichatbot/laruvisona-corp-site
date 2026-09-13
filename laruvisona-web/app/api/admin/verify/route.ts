import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE, ADMIN_SESSION_MAX_AGE_SEC, adminPin, createAdminSession,
} from '@/lib/admin-session';
import { clientIp } from '@/lib/rate-limit';
import { isAdminRequest } from '@/lib/adminAuth';
import { createServiceClient } from '@/lib/supabase/server';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';
import { verifySharedSecret } from '@/lib/shared-secret';

// 現在のセッションが有効かを返す（画面のロック状態をサーバー基準にするため）。
export async function GET(req: Request) {
  return NextResponse.json({ ok: await isAdminRequest(req) });
}

// 管理者 PIN の検証。総当たりを防ぐため IP あたり 5回/15分に制限する。
// Cookie には ADMIN_SECRET ではなく、期限付きの署名済みセッションを入れる。
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rate = await claimPublicRate(createServiceClient(), 'admin-verify', ip, 5, 15 * 60);
  if (rate === 'limited') {
    return NextResponse.json(
      { error: '試行回数が多すぎます。しばらく待って再度お試しください。' },
      { status: 429 }
    );
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '認証状態を確認できません' }, { status: 503 });

  let pin: unknown = '';
  try { pin = (await readContactBody(req, 2048)).pin; } catch { /* 同じ認証失敗を返す */ }
  const expected = adminPin();
  if (typeof pin !== 'string' || !verifySharedSecret(pin, expected || undefined)) {
    return NextResponse.json({ error: 'PINが正しくありません' }, { status: 401 });
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

// ログアウト（セッション破棄）
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
