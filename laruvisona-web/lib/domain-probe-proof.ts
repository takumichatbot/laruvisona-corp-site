// 独自ドメインの「このサービスに届いているか」を、偽装できない形で確かめる。
//
// 以前は固定の marker と Host を返すだけだった。どちらも公開情報なので、
// 別のサーバーで同じJSONを返せば「到達できた」と誤判定させられる。
//
// そこで、確認する側が毎回 nonce と期限を作って署名し、
// 確認される側（＝このサービス）が共有鍵でしか作れない応答署名を返す形にした。
// 鍵を持たないサーバーは応答を作れない。
//
// 鍵は DOMAIN_PROBE_SECRET。未設定なら到達確認は「できない」を返し、
// 接続済みの判断は Render 側の確認に委ねる（lib/domain.ts の deriveStatus）。

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CHALLENGE_TTL_MS = 120_000;

export function probeSecret(): string | null {
  const s = process.env.DOMAIN_PROBE_SECRET;
  return s && s.length >= 16 ? s : null;
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export interface Challenge {
  host: string;
  nonce: string;
  exp: number;
  sig: string;
}

export function createChallenge(secret: string, host: string, now = Date.now()): Challenge {
  const nonce = randomBytes(16).toString('hex');
  const exp = now + CHALLENGE_TTL_MS;
  return { host, nonce, exp, sig: sign(secret, `req|${host}|${nonce}|${exp}`) };
}

/** 受け取り側（/api/domain-probe）の検証 */
export function verifyChallenge(
  secret: string,
  c: { host?: string | null; nonce?: string | null; exp?: string | null; sig?: string | null },
  actualHost: string,
  now = Date.now(),
): { ok: true; proof: string } | { ok: false; reason: string } {
  const host = (c.host || '').toLowerCase();
  const nonce = c.nonce || '';
  const expRaw = c.exp || '';
  const sig = c.sig || '';
  if (!host || !nonce || !expRaw || !sig) return { ok: false, reason: 'missing' };
  if (!/^[0-9a-f]{32}$/.test(nonce)) return { ok: false, reason: 'bad_nonce' };

  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'bad_exp' };
  if (exp < now) return { ok: false, reason: 'expired' };
  if (exp > now + CHALLENGE_TTL_MS * 2) return { ok: false, reason: 'bad_exp' };

  if (!safeEqual(sig, sign(secret, `req|${host}|${nonce}|${exp}`))) return { ok: false, reason: 'bad_sig' };

  // 要求された host と、実際にこの応答を返しているホストが一致すること。
  // 別のホスト名で受けた要求に答えて、到達したことにさせない。
  if (host !== actualHost.toLowerCase()) return { ok: false, reason: 'host_mismatch' };

  return { ok: true, proof: sign(secret, `res|${host}|${nonce}|${exp}`) };
}

/** 確認する側の検証 */
export function verifyProof(secret: string, c: Challenge, proof: string): boolean {
  if (!proof) return false;
  return safeEqual(proof, sign(secret, `res|${c.host}|${c.nonce}|${c.exp}`));
}
