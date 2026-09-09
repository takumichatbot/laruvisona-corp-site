import { NextResponse } from 'next/server';
import { setPrimaryDomain } from '@/lib/domain-service';
import { buildDeps, requireUser } from '../route';

// POST /api/sites/[id]/domain/primary — 確認済みのドメインを「主な公開URL」にする。
//
// 旧ドメインを先に解除しなくても切り替えられる。
// 「接続確認済み」と「主な公開URL」を分けているのは、
// apex と www の両方を接続したときに、確認した順で正規URLが
// 入れ替わってしまわないようにするため。

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const deps = await buildDeps();

  const res = await setPrimaryDomain(deps, {
    siteId: id,
    userId: user.id,
    host: (body as { host?: unknown }).host,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, host: res.host });
}
