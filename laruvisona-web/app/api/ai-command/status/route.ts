import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';

// Watcher の生存・ヘルスを返す。
// 以前は画面がブラウザの anon クライアントで watcher_* を直接読んでいたが、
// これらは運用テーブルなので anon/authenticated から遮断した（ai_command_lockdown.sql）。
// 読み取りは管理者セッションを検証したうえで service role で行う。
export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const service = await createServiceClient();
  const [health, heartbeat] = await Promise.all([
    service.from('watcher_health').select('*'),
    service.from('watcher_heartbeat').select('last_seen').eq('id', 'main').maybeSingle(),
  ]);
  return NextResponse.json({
    health: health.data ?? [],
    lastSeen: heartbeat.data?.last_seen ?? null,
  });
}
