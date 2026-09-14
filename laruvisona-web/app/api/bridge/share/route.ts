import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/adminAuth';
import { bridgeText, readBridgeJson } from '@/lib/bridge-input';

declare global {
  var bridgeShares: Map<string, { content: string; ts: number }> | undefined;
}

// メモリストア（サーバー再起動で消える）
if (!global.bridgeShares) global.bridgeShares = new Map<string, { content: string; ts: number }>();

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let content: string;
  try { content = bridgeText((await readBridgeJson(req, 16_000)).content, 10_000, true); }
  catch { return NextResponse.json({ error: 'content required' }, { status: 400 }); }
  const shares = global.bridgeShares!;
  const now = Date.now();
  for (const [key, value] of shares) if (now - value.ts > 3_600_000) shares.delete(key);
  while (shares.size >= 100) shares.delete(shares.keys().next().value as string);
  const id = randomBytes(6).toString('hex');
  shares.set(id, { content, ts: now });
  return NextResponse.json({ id, url: `/bridge/share/${id}` });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !/^[a-f0-9]{12}$/.test(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const share = global.bridgeShares?.get(id);
  if (!share || Date.now() - share.ts > 3_600_000) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ content: share.content, ts: share.ts });
}
