import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { siteId, email, name } = await req.json() as { siteId?: string; email?: string; name?: string };

  if (!siteId || !email) {
    return NextResponse.json({ error: 'siteId and email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { site_id: siteId, email: normalizedEmail, name: name || null, unsubscribed_at: null },
      { onConflict: 'site_id,email' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('siteId');
  const email = searchParams.get('email');

  if (!siteId || !email) return NextResponse.json({ error: 'siteId and email required' }, { status: 400 });

  await supabase
    .from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('site_id', siteId)
    .eq('email', email.toLowerCase());

  return NextResponse.json({ ok: true });
}
