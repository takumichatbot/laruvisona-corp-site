import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Simple in-memory rate limiter: max 5 subscribe requests per IP per hour
const _subRateMap = new Map<string, number[]>();
function checkSubscribeRate(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const limit = 5;
  const prev = (_subRateMap.get(ip) ?? []).filter(t => now - t < window);
  if (prev.length >= limit) return false;
  _subRateMap.set(ip, [...prev, now]);
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  if (!checkSubscribeRate(ip)) {
    return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください。' }, { status: 429 });
  }

  const supabase = await createClient();
  const { siteId, email, name } = await req.json() as { siteId?: string; email?: string; name?: string };

  if (!siteId || !email) {
    return NextResponse.json({ error: 'siteId and email required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
    return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
  }

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
