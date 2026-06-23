import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

export async function GET(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

export async function POST(req: Request) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      status: 'pending',
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
