import { NextResponse } from 'next/server';

interface MacEntry { ws: { send: (s: string) => void; readyState: number }; name: string }

function safeSendToMac(mac: MacEntry, data: object) {
  try {
    if (mac.ws.readyState === 1) mac.ws.send(JSON.stringify(data));
  } catch { /* ignore */ }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { secret?: string; project?: string; input?: string; mac_id?: string };
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || body.secret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!body.input?.trim()) {
      return NextResponse.json({ error: 'input required' }, { status: 400 });
    }

    const task = { id: Date.now().toString(), project: body.project || '', input: body.input.trim(), ts: Date.now() };

    // Try to forward directly to mac_agent via relay WebSocket (background execution)
    // @ts-ignore
    const macs = global.relayMacs as Map<string, MacEntry> | undefined;
    if (macs && macs.size > 0) {
      const targetId = body.mac_id && macs.has(body.mac_id)
        ? body.mac_id
        : [...macs.keys()][0];
      const target = macs.get(targetId);
      if (target && target.ws.readyState === 1) {
        // Select project first (if specified), then send task
        if (task.project) {
          safeSendToMac(target, { type: 'select_project', project: task.project });
        }
        safeSendToMac(target, { type: 'message', content: task.input });
        return NextResponse.json({ ok: true, taskId: task.id, mode: 'immediate', mac_id: targetId });
      }
    }

    // Fallback: queue for when Bridge client reconnects
    // @ts-ignore
    if (!global.bridgeQuickQueue) global.bridgeQuickQueue = [];
    // @ts-ignore
    global.bridgeQuickQueue.push(task);
    return NextResponse.json({ ok: true, taskId: task.id, mode: 'queued' });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

export async function GET() {
  // @ts-ignore
  const queue = global.bridgeQuickQueue || [];
  // @ts-ignore
  global.bridgeQuickQueue = [];
  return NextResponse.json({ tasks: queue });
}
