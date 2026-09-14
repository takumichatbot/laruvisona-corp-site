import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseContactUpdate, readContactBody, validContactId } from '@/lib/contact-contract';

const databaseError = () => NextResponse.json(
  { error: '問い合わせ情報を確認できませんでした', code: 'database_error' },
  { status: 503 },
);

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');

  const { data: sites, error: sitesError } = await supabase.from('sites').select('id').eq('user_id', user.id);
  if (sitesError) return databaseError();
  const siteIds = (sites || []).map(s => s.id);
  if (!siteIds.length) return NextResponse.json({ contacts: [] });

  let query = supabase
    .from('contacts')
    .select('*')
    .in('site_id', siteIds)
    .order('created_at', { ascending: false })
    .limit(200);

  if (siteId) query = query.eq('site_id', siteId);

  const { data, error: contactsError } = await query;
  if (contactsError) return databaseError();
  return NextResponse.json({ contacts: data || [] });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let parsed;
  try {
    parsed = parseContactUpdate(await readContactBody(req, 20_000));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const { id, updates } = parsed;

  const { data: sites, error: sitesError } = await supabase.from('sites').select('id').eq('user_id', user.id);
  if (sitesError) return databaseError();
  const siteIds = (sites || []).map(s => s.id);
  if (!siteIds.length) return NextResponse.json({ error: '問い合わせが見つかりません' }, { status: 404 });

  const { data: updated, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .in('site_id', siteIds)
    .select('id');
  if (error) return databaseError();
  if (!updated || updated.length !== 1) return NextResponse.json({ error: '問い合わせが見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!validContactId(id)) return NextResponse.json({ error: '問い合わせを確認してください' }, { status: 400 });

  const { data: sites, error: sitesError } = await supabase.from('sites').select('id').eq('user_id', user.id);
  if (sitesError) return databaseError();
  const siteIds = (sites || []).map(s => s.id);
  if (!siteIds.length) return NextResponse.json({ error: '問い合わせが見つかりません' }, { status: 404 });

  const { data: deleted, error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id)
    .in('site_id', siteIds)
    .select('id');
  if (error) return databaseError();
  if (!deleted || deleted.length !== 1) return NextResponse.json({ error: '問い合わせが見つかりません' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
