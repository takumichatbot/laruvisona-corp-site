import { NextResponse } from 'next/server';

interface MacEntry { ws: { readyState: number }; name: string }

// 今 relay に接続中のエージェント一覧を返す診断用エンドポイント。
// ブラウザで /api/bridge/status を開けば、render-1 等が見えているか確認できる。
export async function GET() {
  // @ts-ignore
  const macs = global.relayMacs as Map<string, MacEntry> | undefined;
  const list = macs
    ? [...macs.entries()].map(([id, m]) => ({ id, name: m.name, ready: m.ws.readyState === 1 }))
    : [];
  return NextResponse.json({
    relayInitialized: !!macs,
    count: list.length,
    macs: list,
    ts: Date.now(),
  });
}
