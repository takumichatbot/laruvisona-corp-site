import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readNewsletterBody } from '@/lib/newsletter-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ownerSite(siteId: string) {
  const userDb = await createClient();
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'ログインしてください' }, { status: 401 }) };
  const { data: site, error } = await userDb.from('sites').select('id,settings_json').eq('id', siteId).eq('user_id', user.id).single();
  if (error || !site) return { response: NextResponse.json({ error: 'サイトが見つかりません' }, { status: 404 }) };
  return { user, site };
}

export async function GET(req: Request) {
  const siteId = new URL(req.url).searchParams.get('siteId') || '';
  if (!UUID.test(siteId)) return NextResponse.json({ error: 'サイトを確認してください' }, { status: 400 });
  const auth = await ownerSite(siteId);
  if (auth.response) return auth.response;
  const settings = auth.site!.settings_json as Record<string, unknown> | null;
  return NextResponse.json({ paused: settings?.newsletter_paused === true });
}

export async function POST(req: Request) {
  let body;
  try { body = await readNewsletterBody(req, 5_000); } catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  if (typeof body.siteId !== 'string' || !UUID.test(body.siteId) || typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: '入力を確認してください' }, { status: 400 });
  }
  const auth = await ownerSite(body.siteId);
  if (auth.response) return auth.response;
  const { data, error } = await createServiceClient().rpc('laruhp_newsletter_set_paused', {
    p_site: body.siteId, p_owner: auth.user!.id, p_paused: body.paused,
  });
  if (error || !(data as { ok?: boolean } | null)?.ok) return NextResponse.json({ error: '設定を保存できませんでした' }, { status: 500 });
  return NextResponse.json({ ok: true, paused: body.paused });
}
