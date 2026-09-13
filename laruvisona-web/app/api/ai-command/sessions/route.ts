import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { parseSession, readCommandJson, validSessionId } from '@/lib/ai-command-contract';

export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const service = await createServiceClient();
  const { data, error } = await service.from('ai_sessions').select('*').order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const input = await readCommandJson(req);
  if (!input.ok) return input.response;
  const body = parseSession(input.value);
  if (!body) return NextResponse.json({ error: 'セッションの内容を確認してください' }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from('ai_sessions')
    .upsert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!validSessionId(id)) return NextResponse.json({ error: 'idを確認してください' }, { status: 400 });
  const service = await createServiceClient();
  const { error } = await service.from('ai_sessions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
