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

  const { id, read } = await req.json();

  const { data: sites } = await supabase.from('sites').select('id').eq('user_id', user.id);
  const siteIds = (sites || []).map(s => s.id);

  await supabase.from('contacts').update({ read }).eq('id', id).in('site_id', siteIds);
  return NextResponse.json({ ok: true });
}
