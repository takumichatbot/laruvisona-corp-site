import { createHash, timingSafeEqual } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

function text(value: unknown, label: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw Error(`${label}を確認してください`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw Error(`${label}を確認してください`);
  return result;
}

function siteId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('サイトを確認してください');
  return value;
}

export function validLoyaltyCardId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export type LoyaltyConfigInput = {
  action: 'configure';
  siteId: string;
  maxStamps: number;
  reward: string;
  cardName: string;
};

export type LoyaltyIssueInput = {
  action: 'issue';
  siteId: string;
  customerName: string;
  customerPhone: string;
};

export function parseLoyaltyCommand(input: unknown): LoyaltyConfigInput | LoyaltyIssueInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('入力を確認してください');
  const value = input as Record<string, unknown>;
  const id = siteId(value.siteId);
  if (value.action === 'configure') {
    if (!Number.isInteger(value.maxStamps) || Number(value.maxStamps) < 1 || Number(value.maxStamps) > 50) {
      throw Error('必要ポイント数は1〜50で入力してください');
    }
    return {
      action: 'configure',
      siteId: id,
      maxStamps: Number(value.maxStamps),
      reward: text(value.reward, '特典', 200),
      cardName: text(value.cardName, 'カード名', 80),
    };
  }
  if (value.action === 'issue') {
    return {
      action: 'issue',
      siteId: id,
      customerName: text(value.customerName, 'お名前', 100),
      customerPhone: text(value.customerPhone, '電話番号', 40, false),
    };
  }
  throw Error('操作を確認してください');
}

export async function readLoyaltyBody(req: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
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
    if (bytes > maxBytes) {
      await reader.cancel();
      throw Error('入力が長すぎます');
    }
    json += decoder.decode(value, { stream: true });
  }
  json += decoder.decode();
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('入力を確認してください');
  return parsed as Record<string, unknown>;
}

export function loyaltyTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validLoyaltyToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN.test(token);
}

export function loyaltyTokenMatches(token: unknown, expectedHash: unknown): boolean {
  if (!validLoyaltyToken(token) || typeof expectedHash !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(loyaltyTokenHash(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return timingSafeEqual(actual, expected);
}
