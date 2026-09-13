import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw Error(`${label}を確認してください`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw Error(`${label}を確認してください`);
  return result;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error(`${label}を確認してください`);
  return value;
}

export type NewsletterSegment = 'all' | 'new' | 'mid' | 'veteran';

export function newsletterVariantFor(email: string, requestId: string, hasB: boolean): 'A' | 'B' {
  if (!hasB) return 'A';
  return createHash('sha256').update(`${requestId}:${email.toLowerCase()}`).digest()[0] % 2 ? 'B' : 'A';
}

export function parseNewsletterSubscription(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('入力を確認してください');
  const value = input as Record<string, unknown>;
  const email = text(value.email, 'メールアドレス', 254).toLowerCase();
  if (!EMAIL.test(email)) throw Error('メールアドレスを確認してください');
  return { siteId: uuid(value.siteId, 'サイト'), email, name: text(value.name, 'お名前', 100, false) };
}

export function parseNewsletterSend(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('入力を確認してください');
  const value = input as Record<string, unknown>;
  const segment = value.segment == null ? 'all' : value.segment;
  if (!['all', 'new', 'mid', 'veteran'].includes(String(segment))) throw Error('送信対象を確認してください');
  return {
    siteId: uuid(value.siteId, 'サイト'),
    requestId: uuid(value.requestId, '送信識別子'),
    subject: text(value.subject, '件名', 200),
    subjectB: text(value.subjectB, 'B案の件名', 200, false),
    body: text(value.body, '本文', 100_000),
    segment: segment as NewsletterSegment,
  };
}

export function newsletterSubscriberInSegment(subscribedAt: string, segment: NewsletterSegment, now = Date.now()): boolean {
  if (segment === 'all') return true;
  const age = now - Date.parse(subscribedAt);
  if (!Number.isFinite(age) || age < 0) return false;
  if (segment === 'new') return age <= 30 * 86_400_000;
  if (segment === 'mid') return age > 30 * 86_400_000 && age <= 90 * 86_400_000;
  return age > 90 * 86_400_000;
}

export function escapeNewsletterHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

type UnsubscribePayload = { siteId: string; subscriberId: string; expiresAt: number };

export function signNewsletterUnsubscribe(payload: UnsubscribePayload, secret: string): string {
  if (secret.length < 32) throw Error('配信停止用の鍵が設定されていません');
  uuid(payload.siteId, 'サイト');
  uuid(payload.subscriberId, '登録');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyNewsletterUnsubscribe(token: unknown, secret: string, now = Date.now()): UnsubscribePayload | null {
  if (typeof token !== 'string' || token.length > 1000 || secret.length < 32) return null;
  const [encoded, provided, extra] = token.split('.');
  if (!encoded || !provided || extra) return null;
  const expected = createHmac('sha256', secret).update(encoded).digest();
  let actual: Buffer;
  try { actual = Buffer.from(provided, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as UnsubscribePayload;
    if (!UUID.test(payload.siteId) || !UUID.test(payload.subscriberId) || !Number.isFinite(payload.expiresAt) || payload.expiresAt < now) return null;
    return payload;
  } catch { return null; }
}

export async function readNewsletterBody(req: Request, maxBytes = 120_000): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw Error('入力が長すぎます');
  const reader = req.body?.getReader();
  if (!reader) throw Error('入力を確認してください');
  const decoder = new TextDecoder();
  let json = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw Error('入力が長すぎます'); }
    json += decoder.decode(value, { stream: true });
  }
  json += decoder.decode();
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('入力を確認してください');
  return parsed as Record<string, unknown>;
}
