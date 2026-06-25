import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { secret?: string; project?: string; input?: string };
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || body.secret !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!body.input?.trim()) {
      return NextResponse.json({ error: 'input required' }, { status: 400 });
    }
    const task = { id: Date.now().toString(), project: body.project || '', input: body.input, ts: Date.now() };
    // @ts-ignore
    if (!global.bridgeQuickQueue) global.bridgeQuickQueue = [];
    // @ts-ignore
    global.bridgeQuickQueue.push(task);
    return NextResponse.json({ ok: true, taskId: task.id });
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
