import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: profile } = await service.from('profiles').select('plan').eq('id', user.id).single();
  if (profile?.plan !== 'agency') {
    return NextResponse.json({ error: 'Agency plan required' }, { status: 403 });
  }

  const { brand_logo_url } = await req.json();
  const { error } = await service
    .from('profiles')
    .update({ brand_logo_url: brand_logo_url || null })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
