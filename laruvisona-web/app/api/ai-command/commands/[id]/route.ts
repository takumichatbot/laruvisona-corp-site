import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { readContactBody } from '@/lib/contact-contract';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'idを確認してください' }, { status: 400 });
  const body = await readContactBody(req, 1_000).catch(() => null);
  if (!body || body.status !== 'cancelled' || Object.keys(body).some(key => key !== 'status')) {
    return NextResponse.json({ error: '取り消し以外の更新はできません' }, { status: 400 });
  }
  const service = await createServiceClient();
  const { data, error } = await service
    .from('ai_commands')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['pending', 'running'])
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
