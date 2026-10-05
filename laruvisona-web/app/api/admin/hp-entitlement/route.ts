import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/adminAuth';
import { readContactBody } from '@/lib/contact-contract';
import { fetchLarubotStatus } from '@/lib/larubot-seo';
import { laruEntitlement } from '@/lib/laru-entitlement';
import { companyPublicId, ENT_KEY, entitlementPlan, syncSiteEntitlement, type EntRecord, type EntState } from '@/lib/hp-entitlement-sync';

/**
 * HP バンドルの権利の照合（運営だけ）。
 *   GET  … 読むだけ。LARUbot の会社に紐付いたサイトごとに、HP 側の契約・送るべき権利・控え・LARUbot の status.entitlement を並べる
 *   POST {site_id, confirm:true, event_at?} … 1 件だけ初回同期する
 *        event_at は控えにある値、無ければ運営が LARUbot 担当と決めた値（body）だけを使う。どちらも無ければ送らない（時刻を作らない）
 *        持ち主が運営アカウント（契約なしで公開を許している）なら送らない（契約状態を推測して止めない）
 * ⚠️ 共有鍵は出さない。識別子は site_id 以外は頭 8 文字だけ返す。メールは返さない。
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const short = (v: unknown) => (typeof v === 'string' && v ? `${v.slice(0, 8)}…` : null);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdminEmail(user.email);
}

type Row = { id: string; user_id: string; slug: string | null; custom_domain: string | null; published: boolean; settings_json: Record<string, unknown> | null };
type Prof = { id: string; plan: string | null; subscription_status: string | null; stripe_subscription_id: string | null; contract_starts_at: string | null; contract_ends_at: string | null };

/** HP 側の記録から、いま送るべき権利。決められないときは理由を返す */
function hpRight(p: Prof | undefined, ownerIsOperator: boolean): { plan: string; state: EntState } | { unknown: string } {
  if (ownerIsOperator && !p?.stripe_subscription_id) return { unknown: 'operator_account_no_contract' };
  if (!p) return { unknown: 'no_profile' };
  const live = ['active', 'trialing', 'past_due'].includes(p.subscription_status ?? '');
  if (live) {
    const plan = entitlementPlan(p.plan);
    return plan ? { plan, state: 'active' } : { unknown: `unknown_plan:${p.plan ?? 'null'}` };
  }
  if (p.subscription_status === 'canceled') return { plan: entitlementPlan(p.plan) ?? 'hp', state: 'cancelled' };
  return { unknown: `status:${p.subscription_status ?? 'null'}` };
}

async function load(siteId?: string) {
  const db = createServiceClient();
  const q = db.from('sites').select('id, user_id, slug, custom_domain, published, settings_json');
  const { data: sites, error } = siteId ? await q.eq('id', siteId) : await q;
  if (error) throw new Error('sites');
  const linked = ((sites ?? []) as Row[]).filter((s) => companyPublicId(s.settings_json));
  const userIds = [...new Set(linked.map((s) => s.user_id))];
  const { data: profs } = userIds.length
    ? await db.from('profiles').select('id, plan, subscription_status, stripe_subscription_id, contract_starts_at, contract_ends_at').in('id', userIds)
    : { data: [] };
  const byId = new Map(((profs ?? []) as Prof[]).map((p) => [p.id, p]));
  const operator = new Map<string, boolean>();
  for (const id of userIds) {
    const { data } = await db.auth.admin.getUserById(id);
    operator.set(id, isAdminEmail(data?.user?.email));
  }
  return { db, linked, byId, operator };
}

function view(s: Row, p: Prof | undefined, isOperator: boolean, status: Record<string, unknown> | null) {
  const right = hpRight(p, isOperator);
  const rec = (s.settings_json?.[ENT_KEY] ?? null) as EntRecord | null;
  const display = laruEntitlement(p?.plan, p?.subscription_status, isOperator);
  return {
    site_id: s.id, user_id: short(s.user_id), public_id: short(companyPublicId(s.settings_json)), published: s.published,
    hp_contract: { plan: p?.plan ?? null, status: p?.subscription_status ?? null, stripe_subscription: !!p?.stripe_subscription_id,
      contract_starts_at: p?.contract_starts_at ?? null, contract_ends_at: p?.contract_ends_at ?? null, operator_account: isOperator },
    hp_display: display,
    entitlement_to_send: 'unknown' in right ? null : right,
    cannot_decide: 'unknown' in right ? right.unknown : null,
    event_at: rec?.event_at ?? null,
    record: rec ? { status: rec.status, plan: rec.plan, state: rec.state, event_at: rec.event_at, result: rec.result, last_http: rec.last_http, last_code: rec.last_code } : null,
    larubot: status ? { entitlement: status.entitlement ?? null, is_hp_bundle: status.is_hp_bundle ?? null } : null,
  };
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { linked, byId, operator } = await load();
    const rows = [];
    for (const s of linked) rows.push(view(s, byId.get(s.user_id), !!operator.get(s.user_id), await fetchLarubotStatus(companyPublicId(s.settings_json)!)));
    return NextResponse.json({ sites: rows });
  } catch {
    return NextResponse.json({ error: '読めませんでした' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await readContactBody(req, 2048); } catch { return NextResponse.json({ error: '入力を確認してください' }, { status: 400 }); }
  const siteId = typeof body.site_id === 'string' ? body.site_id : '';
  if (!siteId || body.confirm !== true) return NextResponse.json({ error: 'site_id と confirm:true が要ります' }, { status: 400 });
  const { db, linked, byId, operator } = await load(siteId);
  const site = linked[0];
  if (!site) return NextResponse.json({ error: 'LARUbot の会社に紐付いたサイトではありません' }, { status: 404 });
  const p = byId.get(site.user_id);
  const isOperator = !!operator.get(site.user_id);
  const right = hpRight(p, isOperator);
  if ('unknown' in right) return NextResponse.json({ error: '契約状態を決められないため送りません', code: right.unknown, site: view(site, p, isOperator, null) }, { status: 409 });
  const rec = (site.settings_json?.[ENT_KEY] ?? null) as EntRecord | null;
  const eventAt = rec?.event_at ?? (typeof body.event_at === 'string' && ISO.test(body.event_at) ? body.event_at : null);
  if (!eventAt) return NextResponse.json({ error: '状態になった時刻が分からないため送りません（LARUbot 担当と決めた event_at を指定）', code: 'event_at_unknown' }, { status: 409 });
  const outcome = await syncSiteEntitlement(db, site, { ...right, eventAt, event: 'admin_initial_sync' });
  const status = await fetchLarubotStatus(companyPublicId(site.settings_json)!);
  return NextResponse.json({ outcome, larubot: status ? { entitlement: status.entitlement ?? null } : null });
}
