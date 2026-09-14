import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';

export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await params;

  // Verify site belongs to user
  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, name, subscribed_at, unsubscribed_at')
    .eq('site_id', siteId)
    .order('subscribed_at', { ascending: false });

  if (error) return NextResponse.json({ error: '登録者を読み込めませんでした' }, { status: 500 });

  return NextResponse.json({ subscribers: data || [] });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteId } = await params;
  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 2_000); } catch { return NextResponse.json({ error: 'メールアドレスを確認してください' }, { status: 400 }); }
  if (Object.keys(body).some(key => key !== 'email')) return NextResponse.json({ error: 'メールアドレスを確認してください' }, { status: 400 });
  const email = body.email;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'メールアドレスを確認してください' }, { status: 400 });
  }

  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .eq('email', email.toLowerCase())
    .select('id');

  if (error || data?.length !== 1) return NextResponse.json({ error: '配信を解除できませんでした' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
