import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { readBridgeJson, bridgeText } from '@/lib/bridge-input';
import { verifySharedSecret } from '@/lib/shared-secret';

interface MacEntry { ws: { send: (s: string) => void; readyState: number }; name: string }
interface QuickTask { id: string; project: string; input: string; ts: number }
declare global {
  var relayMacs: Map<string, MacEntry> | undefined;
  var bridgeQuickQueue: QuickTask[] | undefined;
}

function safeSendToMac(mac: MacEntry, data: object) {
  try {
    if (mac.ws.readyState === 1) mac.ws.send(JSON.stringify(data));
  } catch { /* ignore */ }
}

export async function POST(req: Request) {
  try {
    const body = await readBridgeJson(req, 32_000) as { secret?: unknown; project?: unknown; input?: unknown; mac_id?: unknown };
    const adminSecret = process.env.ADMIN_SECRET;
    if (typeof body.secret !== 'string' || !verifySharedSecret(body.secret, adminSecret || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let input: string, project: string, macId: string;
    try {
      input = bridgeText(body.input, 20_000, true);
      project = bridgeText(body.project, 200);
      macId = bridgeText(body.mac_id, 200);
    } catch {
      return NextResponse.json({ error: 'input required' }, { status: 400 });
    }

    const task = { id: crypto.randomUUID(), project, input, ts: Date.now() };

    // Try to forward directly to mac_agent via relay WebSocket (background execution)
    const macs = global.relayMacs as Map<string, MacEntry> | undefined;
    if (macs && macs.size > 0) {
      const targetId = macId && macs.has(macId)
        ? macId
        : [...macs.keys()][0];
      const target = macs.get(targetId);
      if (target && target.ws.readyState === 1) {
        // Select project first (if specified), then send task
        if (task.project) {
          safeSendToMac(target, { type: 'select_project', project: task.project });
        }
        safeSendToMac(target, { type: 'message', content: task.input });
        return NextResponse.json({
          ok: true, taskId: task.id, mode: 'immediate', mac_id: targetId,
          message: '✅ Macに送信しました。完了後に通知が届きます。',
        });
      }
    }

    // Fallback: queue for when Mac reconnects
    if (!global.bridgeQuickQueue) global.bridgeQuickQueue = [];
    global.bridgeQuickQueue = [...global.bridgeQuickQueue, task].slice(-100);
    return NextResponse.json({
      ok: true, taskId: task.id, mode: 'queued',
      message: '⏳ Macがオフラインです。次回接続時に自動実行されます。',
    });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const queue = global.bridgeQuickQueue || [];
  global.bridgeQuickQueue = [];
  return NextResponse.json({ tasks: queue });
}
