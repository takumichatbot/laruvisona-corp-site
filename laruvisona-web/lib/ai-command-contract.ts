import { NextResponse } from 'next/server';

type ObjectInput = Record<string, unknown>;

export async function readCommandJson(req: Request, maxBytes = 32_000): Promise<
  { ok: true; value: ObjectInput } | { ok: false; response: NextResponse }
> {
  const raw = await req.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: '入力が長すぎます' }, { status: 413 }) };
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return { ok: true, value };
  } catch {
    return { ok: false, response: NextResponse.json({ error: '入力を確認してください' }, { status: 400 }) };
  }
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max && !trimmed.includes('\0') ? trimmed : null;
}

export function validSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value);
}

function validImageUrl(value: unknown, storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL || ''): value is string {
  if (typeof value !== 'string' || !storageBase) return false;
  try {
    const url = new URL(value);
    const base = new URL(storageBase);
    const secure = url.protocol === 'https:'
      || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname));
    return secure && url.origin === base.origin
      && url.pathname.startsWith('/storage/v1/object/public/ai-command-images/');
  } catch {
    return false;
  }
}

export function parseNewCommand(value: ObjectInput): {
  session_id: string; message: string; image_urls: string[]; auto_approve: boolean;
  auto_retry: boolean; context_output: string | null; parent_id: string | null;
} | null {
  const sessionId = validSessionId(value.session_id) ? value.session_id : null;
  const message = text(value.message, 12_000);
  const rawImages = value.image_urls === undefined ? [] : value.image_urls;
  if (!sessionId || !message || !Array.isArray(rawImages) || rawImages.length > 6
    || !rawImages.every(url => validImageUrl(url))) return null;
  const context = value.context_output == null ? null : text(value.context_output, 8_000);
  if (value.context_output != null && context == null) return null;
  const parent = value.parent_id == null ? null : text(value.parent_id, 80);
  if (value.parent_id != null && (!parent || !/^[0-9a-f-]{36}$/i.test(parent))) return null;
  return {
    session_id: sessionId,
    message,
    image_urls: rawImages,
    auto_approve: value.auto_approve === true,
    auto_retry: value.auto_retry === true,
    context_output: context,
    parent_id: parent,
  };
}

export function parseSession(value: ObjectInput): {
  id: string; name: string; cwd: string; description: string | null; system_context: string | null; color: string;
} | null {
  const id = validSessionId(value.id) ? value.id : null;
  const name = text(value.name, 100);
  const cwd = text(value.cwd, 1000);
  const description = value.description == null ? null : text(value.description, 1000);
  const systemContext = value.system_context == null ? null : text(value.system_context, 8_000);
  const color = value.color == null ? 'sky' : text(value.color, 24);
  if (!id || !name || !cwd || !cwd.startsWith('/') || !color
    || (value.description != null && description == null)
    || (value.system_context != null && systemContext == null)) return null;
  return { id, name, cwd, description, system_context: systemContext, color };
}
