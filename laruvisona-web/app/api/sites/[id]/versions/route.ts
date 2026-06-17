import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const { data: site } = await supabase.from('sites').select('id').eq('id', id).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: versions } = await supabase
    .from('site_versions')
    .select('id, label, created_at')
    .eq('site_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ versions: versions || [] });
}
