import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { isAdminRequest } from '@/lib/adminAuth';
import { clientIp } from '@/lib/rate-limit';
import { BRIDGE_JWT_AUDIENCE, BRIDGE_JWT_ISSUER, BRIDGE_JWT_TYP } from '@/lib/bridge-jwt';
import { createServiceClient } from '@/lib/supabase/server';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { readContactBody } from '@/lib/contact-contract';
import { verifySharedSecret } from '@/lib/shared-secret';

// Bridge relay 用トークンの発行。
// 会員用 JWT とは鍵・issuer・audience・用途をすべて分離する（会員トークンで
// 運用リレーに接続できてしまう問題への対処）。BRIDGE_JWT_SECRET が無ければ発行しない。
const ROLES = new Set(['mac', 'client']);

export async function POST(req: Request) {
  const rate = await claimPublicRate(createServiceClient(), 'bridge-token', clientIp(req), 10, 15 * 60);
  if (rate === 'limited') {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  if (rate === 'unavailable') return NextResponse.json({ error: '認証状態を確認できません' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 4096); }
  catch { return NextResponse.json({ error: '認証失敗' }, { status: 401 }); }

  // 管理者セッション（ブラウザ）／ADMIN_SECRET（mac_agent・サーバー間）のどちらか
  const adminSecret = process.env.ADMIN_SECRET || '';
  const bodySecretOk = typeof body.secret === 'string' && verifySharedSecret(body.secret, adminSecret);
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
