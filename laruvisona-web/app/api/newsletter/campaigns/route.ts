import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

  // Verify ownership
  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: campaigns, error } = await supabase
    .from('newsletter_campaigns')
    .select('id, subject, variant, sent_count, failed_count, open_count, click_count, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: '送信履歴を読み込めませんでした' }, { status: 500 });
  return NextResponse.json({ campaigns: campaigns || [] });
}
