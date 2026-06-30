import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'change-me';

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

export interface MemberToken { mid: string; sid: string; email: string }

export function signMemberToken(m: { id: string; siteId: string; email: string }): string {
  return jwt.sign({ mid: m.id, sid: m.siteId, email: m.email }, SECRET, { expiresIn: '30d' });
}

export function verifyMemberToken(token: string): MemberToken | null {
  try {
    const p = jwt.verify(token, SECRET) as MemberToken;
    return p && p.mid && p.sid ? p : null;
  } catch {
    return null;
  }
}
