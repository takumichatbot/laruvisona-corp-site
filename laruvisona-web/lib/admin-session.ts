// 管理者セッションの署名・検証。
// Edge(proxy) と Node(route handler) の両方で動くよう Web Crypto のみを使う。
//
// 重要な設計:
// - Cookie には ADMIN_SECRET そのものを入れない（漏えい時に即座に管理権限を渡さない）。
// - 有効期限を署名対象に含め、期限切れを検証側で拒否する。
// - PIN と署名鍵を分離できるようにする（ADMIN_PIN / ADMIN_SESSION_SECRET）。

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12時間

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 署名鍵。未設定なら null を返し、呼び出し側は「管理者ではない」として扱う。 */
export function adminSigningKey(): string | null {
  const key = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || '';
  return key ? key : null;
}

/** 画面で入力する PIN。ADMIN_PIN が未設定なら従来どおり ADMIN_SECRET を使う。 */
export function adminPin(): string | null {
  const pin = process.env.ADMIN_PIN || process.env.ADMIN_SECRET || '';
  return pin ? pin : null;
}

async function hmac(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return b64url(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `v1.<expMs>.<sig>` 形式のセッション値を作る。 */
export async function createAdminSession(ttlSec = ADMIN_SESSION_MAX_AGE_SEC): Promise<string | null> {
  const key = adminSigningKey();
  if (!key) return null;
  const exp = Date.now() + ttlSec * 1000;
  const sig = await hmac(key, `admin|${exp}`);
  return `v1.${exp}.${sig}`;
}

/** セッション値を検証する。署名・形式・期限のいずれかが不正なら false。 */
export async function verifyAdminSession(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const key = adminSigningKey();
  if (!key) return false;
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expected = await hmac(key, `admin|${exp}`);
  return timingSafeEqual(parts[2], expected);
}

/** Cookie ヘッダー文字列から admin_session を取り出す（middleware/route 共用）。 */
export function readAdminCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === ADMIN_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}
