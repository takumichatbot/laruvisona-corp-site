import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');

  const { data: sites } = await supabase.from('sites').select('id').eq('user_id', user.id);
  const siteIds = (sites || []).map(s => s.id);
  if (!siteIds.length) return NextResponse.json({ contacts: [] });

  let query = supabase
    .from('contacts')
    .select('*')
    .in('site_id', siteIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (siteId) query = query.eq('site_id', siteId);

  const { data } = await query;
  return NextResponse.json({ contacts: data || [] });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, read, crm_status, crm_tags, crm_note, crm_followup_at } = body;

  const { data: sites } = await supabase.from('sites').select('id').eq('user_id', user.id);
  const siteIds = (sites || []).map(s => s.id);

  const updates: Record<string, unknown> = {};
  if (read !== undefined) updates.read = read;
  if (crm_status !== undefined) updates.crm_status = crm_status;
  if (crm_tags !== undefined) updates.crm_tags = crm_tags;
  if (crm_note !== undefined) updates.crm_note = crm_note;
  if (crm_followup_at !== undefined) updates.crm_followup_at = crm_followup_at || null;

  await supabase.from('contacts').update(updates).eq('id', id).in('site_id', siteIds);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: sites } = await supabase.from('sites').select('id').eq('user_id', user.id);
  const siteIds = (sites || []).map(s => s.id);

  await supabase.from('contacts').delete().eq('id', id).in('site_id', siteIds);
  return NextResponse.json({ ok: true });
}
