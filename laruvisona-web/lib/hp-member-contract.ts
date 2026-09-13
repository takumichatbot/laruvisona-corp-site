const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('入力を確認してください');
  return value as Record<string, unknown>;
}

export function hpMemberSiteId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('サイトを確認してください');
  return value;
}

export function hpMemberId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('会員を確認してください');
  return value;
}

export function hpMemberEmail(value: unknown): string {
  if (typeof value !== 'string') throw Error('メールアドレスを確認してください');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw Error('メールアドレスを確認してください');
  return email;
}

export function hpMemberPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw Error('パスワードは8〜128文字で入力してください');
  return value;
}

export function parseHpMemberSignup(value: unknown) {
  const item = record(value);
  if (item._hp) return { honeypot: true as const };
  if (Object.keys(item).some(key => !['siteId', 'email', 'password', 'name', '_hp'].includes(key))) throw Error('入力を確認してください');
  const name = item.name == null ? '' : String(item.name).trim();
  if (name.length > 100) throw Error('お名前を100文字以内で入力してください');
  return { honeypot: false as const, siteId: hpMemberSiteId(item.siteId), email: hpMemberEmail(item.email), password: hpMemberPassword(item.password), name };
}

export function parseHpMemberLogin(value: unknown) {
  const item = record(value);
  if (Object.keys(item).some(key => !['siteId', 'email', 'password'].includes(key))) throw Error('入力を確認してください');
  return { siteId: hpMemberSiteId(item.siteId), email: hpMemberEmail(item.email), password: typeof item.password === 'string' && item.password.length <= 128 ? item.password : '' };
}

export function parseHpMemberReset(value: unknown) {
  const item = record(value);
  if (typeof item.token !== 'string' || !item.token || item.token.length > 4096) throw Error('再設定リンクを確認してください');
  return { token: item.token, password: hpMemberPassword(item.password) };
}

export function parseHpMemberSubscribe(value: unknown) {
  const item = record(value);
  if (Object.keys(item).some(key => !['siteId', 'token', 'priceId', 'returnUrl'].includes(key))) throw Error('入力を確認してください');
  if (typeof item.token !== 'string' || !item.token || item.token.length > 4096) throw Error('ログインが必要です');
  if (typeof item.priceId !== 'string' || !/^price_[A-Za-z0-9]+$/.test(item.priceId)) throw Error('価格を確認してください');
  if (item.returnUrl != null && (typeof item.returnUrl !== 'string' || item.returnUrl.length > 2048)) throw Error('戻り先を確認してください');
  return { siteId: hpMemberSiteId(item.siteId), token: item.token, priceId: item.priceId, returnUrl: item.returnUrl || undefined };
}

export function parseHpMemberPortal(value: unknown) {
  const item = record(value);
  if (Object.keys(item).some(key => !['siteId', 'token', 'returnUrl'].includes(key))) throw Error('入力を確認してください');
  if (typeof item.token !== 'string' || !item.token || item.token.length > 4096) throw Error('ログインが必要です');
  if (item.returnUrl != null && (typeof item.returnUrl !== 'string' || item.returnUrl.length > 2048)) throw Error('戻り先を確認してください');
  return { siteId: hpMemberSiteId(item.siteId), token: item.token, returnUrl: item.returnUrl || undefined };
}

export function parseHpMemberContent(value: unknown) {
  const item = record(value);
  if (Object.keys(item).some(key => !['siteId', 'token', 'blockId'].includes(key))) throw Error('入力を確認してください');
  if (typeof item.token !== 'string' || !item.token || item.token.length > 4096) throw Error('ログインが必要です');
  if (typeof item.blockId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(item.blockId)) throw Error('コンテンツを確認してください');
  return { siteId: hpMemberSiteId(item.siteId), token: item.token, blockId: item.blockId };
}

export async function readHpMemberBody(req: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Error('入力が長すぎます');
  if (!req.body) throw Error('入力を確認してください');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw Error('入力が長すぎます');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return record(JSON.parse(raw));
}
