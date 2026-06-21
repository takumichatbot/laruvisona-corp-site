import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// POST — called by LARUbot to push a completed conversation
export async function POST(req: Request) {
  const secret = req.headers.get('x-laru-secret');
  if (!secret || secret !== process.env.LARU_HP_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as {
    site_id: string;
    session_id?: string;
    messages: Message[];
    summary?: string;
  } | null;

  if (!body?.site_id || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'site_id and messages required' }, { status: 400 });
  }

  const service = await createServiceClient();

  const { error } = await service.from('larubot_conversations').upsert({
    site_id: body.site_id,
    session_id: body.session_id ?? null,
    messages: body.messages,
    summary: body.summary ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'site_id,session_id', ignoreDuplicates: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// GET — fetch conversations for a site (authenticated by user session)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify site ownership (or membership)
  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) {
    // Check membership
    const service = await createServiceClient();
    const { data: member } = await service
      .from('site_members')
      .select('id')
      .eq('site_id', siteId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = await createServiceClient();
  const { data: conversations } = await service
    .from('larubot_conversations')
    .select('id, session_id, messages, summary, created_at, updated_at')
    .eq('site_id', siteId)
    .order('updated_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ conversations: conversations || [] });
}
