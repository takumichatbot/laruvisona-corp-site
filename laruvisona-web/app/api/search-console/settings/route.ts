import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// PATCH { siteUrl } — save selected GSC property
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { siteUrl } = await req.json() as { siteUrl: string };
  const service = await createServiceClient();
  await service.from('profiles').update({ search_console_site_url: siteUrl || null }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}

// DELETE — disconnect Google account
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  await service
    .from('profiles')
    .update({ google_refresh_token: null, search_console_site_url: null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
