import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  const { action } = body;

  if (action === 'breakdown') {
    // PM breakdown is handled by Gemini route pm_breakdown action
    // 自ホストではなくループバックへ呼ぶ（Host ヘッダーを信用しない）。
    // 管理者認証は ADMIN_SECRET の Bearer で引き継ぐ。
    const base = process.env.NEXT_PUBLIC_APP_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
    const res = await fetch(`${base}/api/bridge/gemini`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ADMIN_SECRET ? { 'x-admin-secret': process.env.ADMIN_SECRET } : {}),
      },
      body: JSON.stringify({ action: 'pm_breakdown', ...body }),
    });
    return NextResponse.json(await res.json());
  }

  return NextResponse.json({ error: '不明なアクション' }, { status: 400 });
}
