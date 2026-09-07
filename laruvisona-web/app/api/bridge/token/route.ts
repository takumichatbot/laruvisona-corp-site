import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { isAdminRequest } from '@/lib/adminAuth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { BRIDGE_JWT_AUDIENCE, BRIDGE_JWT_ISSUER, BRIDGE_JWT_TYP } from '@/lib/bridge-jwt';

// Bridge relay 用トークンの発行。
// 会員用 JWT とは鍵・issuer・audience・用途をすべて分離する（会員トークンで
// 運用リレーに接続できてしまう問題への対処）。BRIDGE_JWT_SECRET が無ければ発行しない。
const ROLES = new Set(['mac', 'client']);

export async function POST(req: Request) {
  const rl = rateLimit(`bridge-token:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // 管理者セッション（ブラウザ）／ADMIN_SECRET（mac_agent・サーバー間）のどちらか
  const adminSecret = process.env.ADMIN_SECRET || '';
  const bodySecretOk = !!adminSecret && body.secret === adminSecret;
  if (!bodySecretOk && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: '認証失敗' }, { status: 401 });
  }

  const bridgeSecret = process.env.BRIDGE_JWT_SECRET || '';
  if (!bridgeSecret) {
    return NextResponse.json(
      { error: 'BRIDGE_JWT_SECRET が未設定です' },
      { status: 503 }
    );
  }

  const role = ROLES.has(String(body.role)) ? String(body.role) : undefined;
  const token = jwt.sign(
    { sub: 'bridge', typ: BRIDGE_JWT_TYP, ...(role ? { role } : {}) },
    bridgeSecret,
    { issuer: BRIDGE_JWT_ISSUER, audience: BRIDGE_JWT_AUDIENCE, expiresIn: '7d' }
  );
  return NextResponse.json({ token });
}
