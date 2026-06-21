import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// Returns last 20 contacts that had a webhook delivery attempt for this site
export async function GET(_req: Request, { params }: Params) {
  const { id: siteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: site } = await supabase.from('sites').select('id').eq('id', siteId).eq('user_id', user.id).single();
  if (!site) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: rows } = await supabase
    .from('contacts')
    .select('id, name, email, type, created_at, extra_fields')
    .eq('site_id', siteId)
    .not('extra_fields->webhook_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const logs = (rows || []).map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    type: r.type,
    created_at: r.created_at,
    webhook_status: r.extra_fields?.webhook_status,
    webhook_at: r.extra_fields?.webhook_at,
    webhook_code: r.extra_fields?.webhook_code,
  }));

  return NextResponse.json({ logs });
}
