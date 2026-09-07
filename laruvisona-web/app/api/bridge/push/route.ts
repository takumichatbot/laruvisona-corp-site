import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '@/lib/adminAuth';

// Push subscription を /tmp/bridge_push_sub.json に永続化（Render の ephemeral FS で十分）
const SUB_FILE = path.join('/tmp', 'bridge_push_sub.json');

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { subscription } = await req.json();
  if (!subscription) return NextResponse.json({ error: 'subscription required' }, { status: 400 });
  fs.writeFileSync(SUB_FILE, JSON.stringify(subscription));
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const sub = JSON.parse(fs.readFileSync(SUB_FILE, 'utf-8'));
    return NextResponse.json({ subscription: sub });
  } catch {
    return NextResponse.json({ subscription: null });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try { fs.unlinkSync(SUB_FILE); } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
