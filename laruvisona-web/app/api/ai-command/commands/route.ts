import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { parseNewCommand, readCommandJson, validSessionId } from '@/lib/ai-command-contract';

export async function GET(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  if (!validSessionId(sessionId)) return NextResponse.json({ error: 'session_id を確認してください' }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from('ai_commands')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return NextResponse.json({ error: '命令の一覧を取得できませんでした' }, { status: 503 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');
  if (!validSessionId(sessionId)) return NextResponse.json({ error: 'session_id を確認してください' }, { status: 400 });
  const service = await createServiceClient();
  const { error } = await service.from('ai_commands').delete().eq('session_id', sessionId);
  if (error) return NextResponse.json({ error: '命令を削除できませんでした' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const input = await readCommandJson(req);
  if (!input.ok) return input.response;
  const body = parseNewCommand(input.value);
  if (!body) return NextResponse.json({ error: '命令の内容を確認してください' }, { status: 400 });
  const service = await createServiceClient();
  const { data, error } = await service
    .from('ai_commands')
    .insert({
      session_id: body.session_id,
      message: body.message,
      image_urls: body.image_urls ?? [],
      auto_approve: body.auto_approve,
      auto_retry: body.auto_retry,
      context_output: body.context_output,
      parent_id: body.parent_id,
      status: 'pending',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
