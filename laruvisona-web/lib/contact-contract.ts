export type ContactSubmission = {
  siteId: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  type: 'contact' | 'booking';
  extraFields: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, name: string, max: number, required = false): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw Error(`${name}を確認してください`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw Error(`${name}を確認してください`);
  return result;
}

export function parseContactSubmission(input: unknown): ContactSubmission {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('入力を確認してください');
  const v = input as Record<string, unknown>;
  if (typeof v.siteId !== 'string' || !UUID.test(v.siteId)) throw Error('サイトを確認してください');
  const name = text(v.name, 'お名前', 100, true);
  const email = text(v.email, 'メールアドレス', 254, true).toLowerCase();
  if (!EMAIL.test(email)) throw Error('メールアドレスを確認してください');
  const phone = text(v.phone, '電話番号', 40);
  const message = text(v.message, '内容', 10000);
  const type = v.type == null || v.type === 'contact' ? 'contact' : v.type === 'booking' ? 'booking' : null;
  if (!type) throw Error('お問い合わせ種別を確認してください');

  const extraFields: Record<string, string> = {};
  if (v.extraFields != null) {
    if (typeof v.extraFields !== 'object' || Array.isArray(v.extraFields)) throw Error('追加項目を確認してください');
    const entries = Object.entries(v.extraFields as Record<string, unknown>);
    if (entries.length > 20) throw Error('追加項目が多すぎます');
    for (const [key, value] of entries) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) throw Error('追加項目を確認してください');
      extraFields[key] = text(value, '追加項目', 1000);
    }
  }
  return { siteId: v.siteId, name, email, phone, message, type, extraFields };
}

export function validContactId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

type CrmStatus = 'new' | 'in_progress' | 'done' | 'lost';
export function parseContactUpdate(input: unknown): { id: string; updates: Record<string, unknown> } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('入力を確認してください');
  const v = input as Record<string, unknown>;
  if (!validContactId(v.id)) throw Error('問い合わせを確認してください');
  const updates: Record<string, unknown> = {};
  if (v.read !== undefined) {
    if (typeof v.read !== 'boolean') throw Error('既読状態を確認してください');
    updates.read = v.read;
  }
  if (v.crm_status !== undefined) {
    if (!['new', 'in_progress', 'done', 'lost'].includes(String(v.crm_status))) throw Error('対応状態を確認してください');
    updates.crm_status = v.crm_status as CrmStatus;
  }
  if (v.crm_tags !== undefined) {
    if (!Array.isArray(v.crm_tags) || v.crm_tags.length > 20) throw Error('タグを確認してください');
    updates.crm_tags = v.crm_tags.map(tag => text(tag, 'タグ', 40, true));
  }
  if (v.crm_note !== undefined) updates.crm_note = v.crm_note === null ? null : text(v.crm_note, 'メモ', 10000);
  if (v.crm_followup_at !== undefined) {
    if (v.crm_followup_at === null || v.crm_followup_at === '') updates.crm_followup_at = null;
    else if (typeof v.crm_followup_at === 'string' && v.crm_followup_at.length <= 40 && Number.isFinite(Date.parse(v.crm_followup_at))) updates.crm_followup_at = v.crm_followup_at;
    else throw Error('フォロー日時を確認してください');
  }
  if (!Object.keys(updates).length) throw Error('変更内容がありません');
  return { id: v.id, updates };
}

export function escapeContactHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export async function readRequestText(req: Request, maxBytes = 100000): Promise<string> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw Error('too_large');
  const reader = req.body?.getReader();
  if (!reader) throw Error('invalid');
  const decoder = new TextDecoder();
  let json = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw Error('too_large');
    }
    json += decoder.decode(value, { stream: true });
  }
  json += decoder.decode();
  return json;
}

export async function readContactBody(req: Request, maxBytes = 100000): Promise<Record<string, unknown>> {
  const parsed = JSON.parse(await readRequestText(req, maxBytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('invalid');
  return parsed as Record<string, unknown>;
}
