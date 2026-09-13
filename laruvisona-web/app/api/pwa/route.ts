import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type PushSubscriptionInput = {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function parseSubscription(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const sub = value as PushSubscriptionInput;
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) return null;
  let endpoint: URL;
  try { endpoint = new URL(sub.endpoint); } catch { return null; }
  if (endpoint.protocol !== 'https:' || typeof sub.keys?.p256dh !== 'string' || typeof sub.keys.auth !== 'string') return null;
  if (sub.keys.p256dh.length > 512 || sub.keys.auth.length > 256) return null;
  return {
    endpoint: endpoint.toString(),
    expirationTime: typeof sub.expirationTime === 'number' ? sub.expirationTime : null,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const subscription = parseSubscription((raw as { subscription?: unknown })?.subscription);
  if (!subscription) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  const { error } = await supabase.from('hp_push_subscriptions').upsert({
    user_id: user.id, endpoint: subscription.endpoint, subscription, disabled_at: null,
  }, { onConflict: 'user_id,endpoint' });
  if (error) return NextResponse.json({ error: 'Subscription storage unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let endpoint = '';
  try {
    const body = await req.json() as { endpoint?: unknown };
    if (typeof body.endpoint === 'string') endpoint = body.endpoint;
  } catch { /* endpoint省略時はこの利用者の全端末を解除 */ }
  let query = supabase.from('hp_push_subscriptions').delete().eq('user_id', user.id);
  if (endpoint) query = query.eq('endpoint', endpoint);
  const { error } = await query;
  if (error) return NextResponse.json({ error: 'Subscription storage unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
