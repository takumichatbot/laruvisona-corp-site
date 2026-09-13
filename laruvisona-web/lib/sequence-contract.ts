import { randomUUID } from 'node:crypto';

export type SequenceTrigger = 'contact_form' | 'booking' | 'manual';
export type SequenceStep = { delay: number; subject: string; body: string };
export type SequenceRecord = {
  id: string;
  name: string;
  trigger: SequenceTrigger;
  steps: SequenceStep[];
  active: boolean;
  enrolledCount: number;
  createdAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringValue(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw Error(`${label}を確認してください`);
  const result = value.trim();
  if (!result || result.length > max) throw Error(`${label}を確認してください`);
  return result;
}

export function sequenceSiteId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('サイトを確認してください');
  return value;
}

export function sequenceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw Error('シーケンスを確認してください');
  return value;
}

export function parseSequenceSteps(value: unknown): SequenceStep[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw Error('メールステップを確認してください');
  return value.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw Error('メールステップを確認してください');
    const item = step as Record<string, unknown>;
    const delay = Number(item.delay);
    if (!Number.isInteger(delay) || delay < 0 || delay > 24 * 365 || (index === 0 && delay !== 0)) {
      throw Error(index === 0 ? '最初のメールは即時送信にしてください' : '送信間隔を確認してください');
    }
    return {
      delay,
      subject: stringValue(item.subject, `メール${index + 1}の件名`, 200),
      body: stringValue(item.body, `メール${index + 1}の本文`, 50_000),
    };
  });
}

export function parseSequenceCreate(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('入力を確認してください');
  const item = value as Record<string, unknown>;
  const trigger = item.trigger ?? 'contact_form';
  if (!['contact_form', 'booking', 'manual'].includes(String(trigger))) throw Error('開始条件を確認してください');
  return {
    siteId: sequenceSiteId(item.siteId),
    id: randomUUID(),
    name: stringValue(item.name, 'シーケンス名', 100),
    trigger: trigger as SequenceTrigger,
    steps: parseSequenceSteps(item.steps),
  };
}

export function parseSequencePatch(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('入力を確認してください');
  const item = value as Record<string, unknown>;
  const allowed = new Set(['name', 'trigger', 'steps', 'active']);
  if (Object.keys(item).some(key => !allowed.has(key)) || Object.keys(item).length === 0) throw Error('変更内容を確認してください');
  const result: { name?: string; trigger?: SequenceTrigger; steps?: SequenceStep[]; active?: boolean } = {};
  if ('name' in item) result.name = stringValue(item.name, 'シーケンス名', 100);
  if ('trigger' in item) {
    if (!['contact_form', 'booking', 'manual'].includes(String(item.trigger))) throw Error('開始条件を確認してください');
    result.trigger = item.trigger as SequenceTrigger;
  }
  if ('steps' in item) result.steps = parseSequenceSteps(item.steps);
  if ('active' in item) {
    if (typeof item.active !== 'boolean') throw Error('有効状態を確認してください');
    result.active = item.active;
  }
  return result;
}

export function escapeSequenceHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderSequenceBody(template: string, name: string | null): string {
  return escapeSequenceHtml(template.replace(/\{\{name\}\}/g, name?.trim() || 'お客様')).replace(/\r?\n/g, '<br>');
}

export async function readSequenceBody(req: Request, maxBytes = 1_100_000): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw Error('入力が長すぎます');
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw Error('入力が長すぎます');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('入力を確認してください');
  return value as Record<string, unknown>;
}
