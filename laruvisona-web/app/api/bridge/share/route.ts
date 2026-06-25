import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// メモリストア（サーバー再起動で消える）
// @ts-ignore
if (!global.bridgeShares) global.bridgeShares = new Map<string, { content: string; ts: number }>();

export async function POST(req: Request) {
  const { content } = await req.json() as { content: string };
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });
  const id = randomBytes(6).toString('hex');
  // @ts-ignore
  global.bridgeShares.set(id, { content: content.slice(0, 10000), ts: Date.now() });
  // 1時間で期限切れ
  setTimeout(() => {
    // @ts-ignore
    global.bridgeShares.delete(id);
  }, 3600000);
  return NextResponse.json({ id, url: `/bridge/share/${id}` });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  // @ts-ignore
  const share = global.bridgeShares?.get(id);
  if (!share) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ content: share.content, ts: share.ts });
}
