import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logError } from '@/lib/api-error';
import { parseNewsletterSubscription, readNewsletterBody, verifyNewsletterUnsubscribe } from '@/lib/newsletter-contract';

const attempts = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter(time => now - time < 3_600_000);
  if (recent.length >= 5) return false;
  attempts.set(ip, [...recent, now]);
  return true;
}

function secret() {
  return process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || process.env.ADMIN_SECRET || '';
}

export async function POST(req: Request) {
  const oneClickToken = new URL(req.url).searchParams.get('token');
  if (oneClickToken) return unsubscribe(oneClickToken);
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  if (!allow(ip)) return NextResponse.json({ error: 'リクエストが多すぎます。しばらくしてから再試行してください' }, { status: 429 });
  let input;
  try { input = parseNewsletterSubscription(await readNewsletterBody(req, 20_000)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '入力を確認してください' }, { status: 400 }); }

  const service = createServiceClient();
  const { data: site, error: siteError } = await service.from('sites').select('id').eq('id', input.siteId).eq('published', true).single();
  if (siteError || !site) return NextResponse.json({ error: '公開中のサイトが見つかりません' }, { status: 404 });
  const { error } = await service.from('newsletter_subscribers').upsert({
    site_id: input.siteId,
    email: input.email,
    name: input.name || null,
    subscribed_at: new Date().toISOString(),
    unsubscribed_at: null,
  }, { onConflict: 'site_id,email' });
  if (error) {
    logError('newsletter/subscribe', error);
    return NextResponse.json({ error: '登録に失敗しました。時間をおいて再度お試しください' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: Request) {
  return unsubscribe(new URL(req.url).searchParams.get('token'));
}

async function unsubscribe(token: string | null) {
  const payload = verifyNewsletterUnsubscribe(token, secret());
  if (!payload) return page('配信停止リンクを確認できませんでした', 'リンクの期限が切れているか、URLが途中で切れています', 400);
  const { data, error } = await createServiceClient().from('newsletter_subscribers')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('id', payload.subscriberId).eq('site_id', payload.siteId).select('id');
  if (error || data?.length !== 1) return page('配信停止を完了できませんでした', '時間をおいてもう一度お試しください', 500);
  return page('配信を停止しました', '今後、このニュースレターは送信されません', 200);
}

function page(title: string, message: string, status: number) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${title}</title></head><body style="margin:0;background:#f8fafc;color:#172033;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="max-width:440px;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:36px;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="font-size:14px;line-height:1.7;color:#64748b;margin:0">${message}</p></section></main></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' } });
}
