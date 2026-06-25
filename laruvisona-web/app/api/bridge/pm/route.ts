import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;

  if (action === 'breakdown') {
    // PM breakdown is handled by Gemini route pm_breakdown action
    const res = await fetch(`${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host')}/api/bridge/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pm_breakdown', ...body }),
    });
    return NextResponse.json(await res.json());
  }

  return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
}
