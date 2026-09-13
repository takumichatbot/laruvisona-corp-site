const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN = /^[0-9a-f]{48}$/;

export function siteMemberSiteId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('サイトを確認してください');
  return value;
}

export function siteMemberEmail(value: unknown): string {
  if (typeof value !== 'string') throw Error('メールアドレスを確認してください');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw Error('メールアドレスを確認してください');
  return email;
}

export function siteMemberToken(value: unknown): string {
  if (typeof value !== 'string' || !TOKEN.test(value)) throw Error('招待リンクを確認してください');
  return value;
}

export async function readSiteMemberBody(req: Request, maxBytes = 4_096): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Error('入力が長すぎます');
  if (!req.body) throw Error('入力を確認してください');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw Error('入力が長すぎます');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('入力を確認してください');
  return parsed as Record<string, unknown>;
}

export function escapeInviteHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
