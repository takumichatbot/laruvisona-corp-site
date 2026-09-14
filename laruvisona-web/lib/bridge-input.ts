import { readContactBody } from './contact-contract';

export const readBridgeJson = (req: Request, maxBytes = 128_000) => readContactBody(req, maxBytes);

async function readBytes(req: Request, maxBytes: number) {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Error('too_large');
  const reader = req.body?.getReader();
  if (!reader) throw Error('invalid');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw Error('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total);
}

export async function readBridgeForm(req: Request, maxBytes: number) {
  const contentType = req.headers.get('content-type') || '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw Error('invalid');
  const bytes = await readBytes(req, maxBytes);
  return new Request('http://bridge.local/', {
    method: 'POST', headers: { 'content-type': contentType }, body: bytes,
  }).formData();
}

export function bridgeText(value: unknown, max: number, required = false) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw Error('invalid');
  }
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\u0000]/.test(result)) throw Error('invalid');
  return result;
}
