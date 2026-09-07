import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// 顧客サイトの会員機能用トークン。
// 運用系（Bridge relay = lib/bridge-jwt.ts / server.js）とは鍵・issuer・audience・用途を
// すべて分離する。同じ鍵・用途チェック無しだと、会員トークンで運用リレーに接続できたり、
// パスワード再設定用トークンが通常ログインとして通ってしまう。
const MEMBER_ISSUER = 'laruvisona-members';
const MEMBER_AUDIENCE = 'site-members';
const TYP_SESSION = 'member';
const TYP_RESET = 'member-reset';

/** 会員用の署名鍵。未設定なら既知のフォールバックを使わず例外にする。 */
function secret(): string {
  const s = process.env.MEMBER_JWT_SECRET || process.env.JWT_SECRET || '';
  if (!s) throw new Error('MEMBER_JWT_SECRET (または JWT_SECRET) が未設定です');
  return s;
}

const VERIFY_OPTS: jwt.VerifyOptions = {
  issuer: MEMBER_ISSUER,
  audience: MEMBER_AUDIENCE,
  algorithms: ['HS256'],
};

// パスワードハッシュ（scrypt・ソルト付き。外部依存なし）
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * 現在のパスワードハッシュの指紋。再設定トークンに埋め込むことで、
 * 一度パスワードが変わった時点で古い再設定リンクを無効にする（使い捨て化）。
 */
export function passwordFingerprint(passwordHash: string | null | undefined): string {
  return crypto.createHash('sha256').update(String(passwordHash || '')).digest('hex').slice(0, 32);
}

export interface MemberToken { mid: string; sid: string; email: string }

export function signMemberToken(m: { id: string; siteId: string; email: string }): string {
  return jwt.sign(
    { mid: m.id, sid: m.siteId, email: m.email, typ: TYP_SESSION },
    secret(),
    { issuer: MEMBER_ISSUER, audience: MEMBER_AUDIENCE, expiresIn: '30d' }
  );
}

export function verifyMemberToken(token: string): MemberToken | null {
  try {
    const p = jwt.verify(token, secret(), VERIFY_OPTS) as unknown as MemberToken & { typ?: string };
    if (p?.typ !== TYP_SESSION) return null;
    return p.mid && p.sid ? { mid: p.mid, sid: p.sid, email: p.email } : null;
  } catch {
    return null;
  }
}

// パスワードリセット用トークン（短命・専用タイプ・現在のパスワードに紐付け）
export function signResetToken(memberId: string, siteId: string, passwordHash: string): string {
  return jwt.sign(
    { mid: memberId, sid: siteId, typ: TYP_RESET, pwv: passwordFingerprint(passwordHash) },
    secret(),
    { issuer: MEMBER_ISSUER, audience: MEMBER_AUDIENCE, expiresIn: '1h' }
  );
}

export function verifyResetToken(token: string): { mid: string; sid: string; pwv: string } | null {
  try {
    const p = jwt.verify(token, secret(), VERIFY_OPTS) as unknown as {
      mid?: string; sid?: string; typ?: string; pwv?: string;
    };
    if (p?.typ !== TYP_RESET || !p.mid || !p.sid || !p.pwv) return null;
    return { mid: p.mid, sid: p.sid, pwv: p.pwv };
  } catch {
    return null;
  }
}
