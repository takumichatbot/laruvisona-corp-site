import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, readAdminCookie, verifyAdminSession } from './admin-session';
import { verifySharedSecret } from './shared-secret';

/**
 * 管理者リクエストかを判定する。
 * 1) 署名付き admin_session Cookie（人が PIN を入力して得たセッション）
 * 2) Authorization: Bearer <ADMIN_SECRET>（server.js / mac_agent などサーバー間呼び出し用）
 *
 * ADMIN_SECRET 未設定なら常に false。既知のフォールバック秘密は用意しない。
 */
export async function isAdminRequest(req?: Request): Promise<boolean> {
  if (req && (await isAdminBearer(req))) return true;

  // Cookie は req 優先（route handler で明示的に渡せる）、無ければ next/headers から
  const fromReq = req ? readAdminCookie(req.headers.get('cookie')) : null;
  if (fromReq) return verifyAdminSession(fromReq);

  try {
    const store = await cookies();
    return await verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
  } catch {
    return false;
  }
}

/** サーバー間呼び出し用の Bearer 認証（ADMIN_SECRET 直渡し）。 */
export async function isAdminBearer(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) return false;
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (verifySharedSecret(bearer, secret)) return true;
  const header = req.headers.get('x-admin-secret') || '';
  return verifySharedSecret(header, secret);
}

/**
 * 管理者でなければ 401 レスポンスを返す。route handler の先頭で使う。
 * 使い方: `const denied = await requireAdmin(req); if (denied) return denied;`
 */
export async function requireAdmin(req?: Request): Promise<NextResponse | null> {
  if (await isAdminRequest(req)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * ログイン中の利用者が管理者か。
 *
 * `user.email === process.env.ADMIN_EMAIL` と裸で比べてはいけない。
 * ADMIN_EMAIL が未設定だと右辺は undefined になり、メールを持たない
 * アカウント（左辺も undefined）が管理者として通ってしまう。
 * 未設定なら必ず false、比較は小文字・前後の空白を落としてから行う。
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const allowed = [process.env.ADMIN_EMAIL, process.env.NEXT_PUBLIC_ADMIN_EMAIL]
    .filter(Boolean).join(',')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length) return false;
  const actual = (email || '').trim().toLowerCase();
  return !!actual && allowed.includes(actual);
}
