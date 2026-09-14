import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { readAnalyticsJson, verifyAnalyticsSite } from '@/lib/analytics-contract';
import { claimPublicRate } from '@/lib/public-rate-limit';
import { clientIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  let input: { slug: string; variant: 'a' | 'b' };
  try {
    const raw = await readAnalyticsJson(req, 2048);
    if (!raw || typeof raw !== 'object') throw new Error('invalid_input');
    const value = raw as Record<string, unknown>;
    const slug = typeof value.slug === 'string' ? value.slug.trim() : '';
    const variant = value.variant === 'a' || value.variant === 'b' ? value.variant : null;
    const token = req.headers.get('x-laruhp-analytics') || '';
    if (!slug || slug.length > 160 || !variant || !verifyAnalyticsSite(slug, token)) throw new Error('invalid_input');
    input = { slug, variant };
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const service = createServiceClient();
  const rate = await claimPublicRate(service, 'ab-view', `${input.slug}:${clientIp(req)}`, 120);
  if (rate === 'limited') return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  if (rate === 'unavailable') return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 });

  const result = await service.rpc('laruhp_ab_increment', { p_slug: input.slug, p_variant: input.variant });
  if (result.error || result.data !== true) return NextResponse.json({ error: 'Analytics unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true });
}
