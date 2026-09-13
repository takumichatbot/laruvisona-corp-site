import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readRequestText } from '@/lib/contact-contract';
import { verifySharedSecret } from '@/lib/shared-secret';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

// POST — called by LARUbot to push a completed conversation
export async function POST(req: Request) {
  const secret = req.headers.get('x-laru-secret');
  if (!verifySharedSecret(secret, process.env.LARU_HP_API_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readRequestText(req, 512_000).then(text => JSON.parse(text)).catch(() => null) as {
    site_id: string;
    session_id?: string;
    messages: Message[];
    summary?: string;
  } | null;

  const validMessage = (message: unknown): message is Message => {
    if (!message || typeof message !== 'object') return false;
    const item = message as Record<string, unknown>;
    return (item.role === 'user' || item.role === 'assistant')
      && typeof item.content === 'string' && item.content.length > 0 && item.content.length <= 8_000;
  };
  if (!body || typeof body.site_id !== 'string' || !UUID.test(body.site_id)
      || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 500
      || !body.messages.every(validMessage)
      || (body.session_id !== undefined && (typeof body.session_id !== 'string' || !SESSION_ID.test(body.session_id)))
      || (body.summary !== undefined && (typeof body.summary !== 'string' || body.summary.length > 10_000))) {
    return NextResponse.json({ error: 'site_id and messages required' }, { status: 400 });
  }

  const service = createServiceClient();
  const site = await service.from('sites').select('id').eq('id', body.site_id).maybeSingle();
  if (site.error) return NextResponse.json({ error: 'site lookup failed' }, { status: 503 });
  if (!site.data) return NextResponse.json({ error: 'site not found' }, { status: 404 });

  const { error } = await service.from('larubot_conversations').upsert({
    site_id: body.site_id,
    session_id: body.session_id ?? null,
    messages: body.messages,
    summary: body.summary ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'site_id,session_id', ignoreDuplicates: false });

  if (error) return NextResponse.json({ error: 'conversation could not be saved' }, { status: 503 });

  return NextResponse.json({ ok: true });
}

// GET — fetch conversations for a site (authenticated by user session)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) {
    const service = await createServiceClient();
    const [{ data: owned, error: ownedError }, { data: memberships, error: memberError }] = await Promise.all([
      service.from('sites').select('id, name').eq('user_id', user.id),
      service.from('site_members').select('site_id').eq('user_id', user.id).eq('status', 'active'),
    ]);
    if (ownedError || memberError) return NextResponse.json({ error: 'サイトを読み込めませんでした' }, { status: 500 });
    const memberIds = [...new Set((memberships || []).map(item => item.site_id as string))];
    const { data: shared, error: sharedError } = memberIds.length
      ? await service.from('sites').select('id, name').in('id', memberIds)
      : { data: [], error: null };
    if (sharedError) return NextResponse.json({ error: 'サイトを読み込めませんでした' }, { status: 500 });
    return NextResponse.json({ sites: [
      ...(owned || []).map(site => ({ ...site, access: 'owner' as const })),
      ...(shared || []).filter(site => !(owned || []).some(item => item.id === site.id)).map(site => ({ ...site, access: 'viewer' as const })),
    ] });
  }

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
