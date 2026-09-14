import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const { data: site, error: siteError } = await supabase.from('sites').select('id').eq('id', id).eq('user_id', user.id).single();
  if (siteError && siteError.code !== 'PGRST116') return NextResponse.json({ error: 'サイトを確認できませんでした' }, { status: 503 });
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: versions, error: versionsError } = await supabase
    .from('site_versions')
    .select('id, label, created_at')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (versionsError) return NextResponse.json({ error: '履歴を読み込めませんでした' }, { status: 503 });

  return NextResponse.json({ versions: versions || [] });
}
