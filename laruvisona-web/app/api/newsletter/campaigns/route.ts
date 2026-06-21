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
  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: campaigns } = await supabase
    .from('newsletter_campaigns')
    .select('id, subject, sent_count, open_count, click_count, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ campaigns: campaigns || [] });
}
