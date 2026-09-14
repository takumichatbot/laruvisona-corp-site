import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readContactBody } from '@/lib/contact-contract';

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

  let raw: Record<string, unknown>;
  try { raw = await readContactBody(req, 20_000); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (Object.keys(raw).some(key => key !== 'subscription')) return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  const subscription = parseSubscription(raw.subscription);
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

  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 4_000); } catch { return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 }); }
  if (Object.keys(body).some(key => key !== 'endpoint') || typeof body.endpoint !== 'string' || body.endpoint.length > 2_048) {
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  }
  let endpoint: URL;
  try { endpoint = new URL(body.endpoint); } catch { return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 }); }
  if (endpoint.protocol !== 'https:') return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  const query = supabase.from('hp_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint.toString());
  const { error } = await query;
  if (error) return NextResponse.json({ error: 'Subscription storage unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
