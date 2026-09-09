import { NextResponse } from 'next/server';
import { verifyDomain } from '@/lib/domain-service';
import { statusLabel, dnsInstructions, DNS_SUPPORT_NOTES } from '@/lib/domain';
import { buildDeps, requireUser, expectedTargets } from '../route';

// POST /api/sites/[id]/domain/verify — 所有確認 → 外部登録 → 到達確認
// 判定と副作用の順序は lib/domain-service.ts の verifyDomain にある。

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const deps = await buildDeps();

  const res = await verifyDomain(deps, {
    siteId: id,
    userId: user.id,
    host: (body as { host?: unknown }).host,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const row = await deps.store.getDomain(id, res.host);
  return NextResponse.json({
    host: res.host,
    status: res.status,
    ...statusLabel(res.status),
    switched: res.switched,
    evidence: res.evidence,
    lastError: res.lastError,
    notes: DNS_SUPPORT_NOTES,
    records: row ? dnsInstructions(res.host, row.verification_token, expectedTargets()) : [],
  });
}

// 副作用のある処理をリンクやプリフェッチで踏ませない
export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
