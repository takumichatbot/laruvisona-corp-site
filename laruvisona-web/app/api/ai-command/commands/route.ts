import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';

export async function GET(req: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id が必要です' }, { status: 400 });
  const service = await createServiceClient();
  const { data } = await service
    .from('ai_commands')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id が必要です' }, { status: 400 });
  const service = await createServiceClient();
  await service.from('ai_commands').delete().eq('session_id', sessionId);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  if (!body.session_id || !body.message) return NextResponse.json({ error: 'session_id, message が必要です' }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from('ai_commands')
    .insert({
      session_id: body.session_id,
      message: body.message,
      image_urls: body.image_urls ?? [],
      auto_approve: body.auto_approve ?? true,
      auto_retry: body.auto_retry ?? false,
      context_output: body.context_output ?? null,
      parent_id: body.parent_id ?? null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
