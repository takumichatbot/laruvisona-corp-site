import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/pwa — save push subscription endpoint
// DELETE /api/pwa — remove push subscription

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { subscription?: object };
  if (!body.subscription) return NextResponse.json({ error: 'subscription required' }, { status: 400 });

  await supabase.from('profiles').update({
    push_subscription: body.subscription,
  }).eq('id', user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabase.from('profiles').update({ push_subscription: null }).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
