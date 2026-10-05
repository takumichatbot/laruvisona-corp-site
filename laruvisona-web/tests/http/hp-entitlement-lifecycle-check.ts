// HP バンドルの権利同期（/api/hp/entitlement）を、実際のサーバー（:3319）・偽DB（:54999）・LARUbot の代わり（:54997）で確かめる。
// LARUbot の代わりは apply_event と同じ判定（applied / duplicate / stale・site_mismatch）で、呼ばれた瞬間の公開先の状態も記録する。
// 前提: publication-target-lifecycle-check.ts と同じ環境変数で起動したビルド。この確認も同じ環境変数で動かす。
//   node --import ./tests/_resolve-ts.mjs tests/http/hp-entitlement-lifecycle-check.ts
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterBillingChange, beforeBillingChange, beforeCancel } from '../../lib/publication-target-sync';
import { postEntitlement, ENT_KEY } from '../../lib/hp-entitlement-sync';

const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999', mock = 'http://127.0.0.1:54997';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const results: boolean[] = [];
const check = (name: string, ok: unknown, detail: unknown = '') => { results.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };
const post = (u: string, b: unknown) => fetch(u, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const control = (b: unknown) => post(fixture + '/__control', b);
type EntCall = { body: Record<string, string>; auth: boolean; ptState: string | null; at: number };
type Company = { plan: string | null; seo: boolean; state: string; event_at: string };
const ent = async (): Promise<{ calls: EntCall[]; companies: Record<string, Company> }> => (await fetch(mock + '/__ent')).json();
const pt = async (): Promise<{ calls: { action: string; at: number; body: Record<string, string> }[]; registered: Record<string, { state: string; canonical_base: string }> }> => (await fetch(mock + '/__pt')).json();
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const asOwner = (path: string, method: string, body?: unknown) => fetch(base + path, { method, headers: { cookie, origin: base, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) as Record<string, unknown> }));
const siteRow = async (id: string) => (await (await fetch(`${fixture}/rest/v1/sites?id=eq.${id}`)).json())[0];
const rec = async (id: string) => (await siteRow(id))?.settings_json?.[ENT_KEY];
const db = createClient(fixture, 'service-stub', { auth: { persistSession: false } });
const profile = (plan: string | null, status: string) => control({ patchProfile: { id: OWNER, patch: { plan, subscription_status: status } } });
const T = (n: number) => `2026-10-05T0${n}:00:00.000Z`;
const PUB = { target_type: 'internal_blog', canonical_base: 'https://larubot.tokyo', article_path: '/blog/{slug}', canonical_policy: 'single_primary' };
const item = { id: 1, slug: 'a-1', title: '記事1', meta_description: '説明', target_keyword: '', thumbnail_url: null, published_at: '2026-10-01T00:00:00', updated_at: '2026-10-01T00:00:00', canonical_url: 'https://larubot.tokyo/blog/a-1' };
const adminSecret = readFileSync('/tmp/claude-0/admin-stub', 'utf8').trim();

try {
  await profile('hp-bot', 'active');
  await control({ patchSite: { id: 'id-a', patch: { user_id: OWNER, custom_domain: null, published: true, settings_json: { larubotPublicId: 'pidA', laruseoPublicId: 'pidA', laruseo: true } } } });
  await control({ patchSite: { id: 'id-b', patch: { user_id: OWNER, custom_domain: null, published: true, settings_json: { larubotPublicId: 'pidB', laruseoPublicId: 'pidB', laruseo: true } } } });
  await post(mock + '/__state', { tenants: { pidA: { publication: PUB, items: [item] }, pidB: { publication: PUB, items: [item] } } });
  await post(mock + '/__pt', { mode: 'ok', reset: true });
  await post(mock + '/__ent', { mode: 'ok', reset: true });

  /* 1. アップグレード（SEO 追加）：entitlement → そのあと公開先（未登録なので register） */
  await profile('hp-bot-seo', 'active');
  await afterBillingChange(db, OWNER, { plan: 'hp-bot', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'upgrade', { eventAt: T(1) });
  let e = await ent(), p = await pt();
  check('アップグレード：会社ごとに entitlement（plan=hp-bot-seo・event_at 固定・鍵ヘッダー）', e.calls.length === 2 && e.calls.every((c) => c.body.plan === 'hp-bot-seo' && c.body.state === 'active' && c.body.event_at === T(1) && c.auth && c.body.user_id === OWNER), e.calls.map((c) => c.body));
  check('アップグレード：LARUbot 側は starter + SEO', e.companies.pidA?.plan === 'starter' && e.companies.pidA?.seo === true);
  check('順番：entitlement が成功してから公開先（reactivate → 未登録なので register）', p.calls.length >= 2 && Math.min(...p.calls.map((c) => c.at)) >= Math.max(...e.calls.map((c) => c.at)) && p.registered.pidA?.state === 'active', p.calls.map((c) => c.action));
  check('控え：synced・applied・event_at', (await rec('id-a'))?.status === 'synced' && (await rec('id-a'))?.result === 'applied' && (await rec('id-a'))?.event_at === T(1));

  /* 2. 重複・順序の逆転 */
  const again = await postEntitlement({ publicId: 'pidA', siteId: 'id-a', userId: OWNER, plan: 'hp-bot-seo', state: 'active', eventAt: T(1), event: 'resend' });
  check('同じ時刻・同じ内容の再送 → duplicate（正常）', again.kind === 'done' && again.result === 'duplicate');
  const old = await postEntitlement({ publicId: 'pidA', siteId: 'id-a', userId: OWNER, plan: 'hp', state: 'active', eventAt: T(0), event: 'late' });
  check('古い時刻（順序の逆転）→ stale（正常・権利は変わらない）', old.kind === 'done' && old.result === 'stale' && (await ent()).companies.pidA.seo === true);
  let n = (await ent()).calls.length;
  await afterBillingChange(db, OWNER, { plan: 'hp-bot', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'upgrade_resend', { eventAt: T(1) });
  check('同じ通知がもう一度来ても、控えが synced なら送り直さない', (await ent()).calls.length === n);

  /* 3. ダウングレード（SEO を外す）：公開先を先に止め、entitlement hp-bot。Bot は残る */
  await beforeBillingChange(db, OWNER, { plan: 'hp-bot-seo', status: 'active' }, { plan: 'hp-bot', status: 'active' }, 'downgrade');
  await profile('hp-bot', 'active');
  n = (await ent()).calls.length;
  await afterBillingChange(db, OWNER, { plan: 'hp-bot-seo', status: 'active' }, { plan: 'hp-bot', status: 'active' }, 'downgrade', { eventAt: T(2) });
  e = await ent();
  check('SEO を外す：entitlement hp-bot（呼んだ時点で公開先は inactive）・Bot は残り SEO は止まる', e.calls.slice(n).every((c) => c.body.plan === 'hp-bot' && c.ptState === 'inactive') && e.companies.pidA.plan === 'starter' && e.companies.pidA.seo === false, e.calls.slice(n).map((c) => [c.body.plan, c.ptState]));

  /* 4. Bot Lite（lite）と Standard（hp-bot）は別の値 */
  await profile('lite', 'active');
  await afterBillingChange(db, OWNER, { plan: 'hp-bot', status: 'active' }, { plan: 'lite', status: 'active' }, 'to_lite', { eventAt: T(3) });
  check('Standard → Bot Lite：plan=lite を送り、LARUbot 側は lite（starter と区別）', (await ent()).companies.pidA.plan === 'lite');

  /* 5. Bot を外す（HP 単体） */
  await profile('hp', 'active');
  await afterBillingChange(db, OWNER, { plan: 'lite', status: 'active' }, { plan: 'hp', status: 'active' }, 'to_hp', { eventAt: T(4) });
  check('Bot を外す：plan=hp → Bot も止まる（public_id は残る）', (await ent()).companies.pidA.plan === null && (await siteRow('id-a')).settings_json.larubotPublicId === 'pidA');

  /* 6. SEO の再追加：entitlement が成功してから reactivate（公開先は自動では戻らない） */
  await profile('hp-bot-seo', 'active');
  const ptBefore = (await pt()).calls.length;
  await afterBillingChange(db, OWNER, { plan: 'hp', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'readd', { eventAt: T(5) });
  e = await ent(); p = await pt();
  const react = p.calls.slice(ptBefore).filter((c) => c.action === 'reactivate');
  check('SEO 再追加：entitlement（SEO 再開）→ そのあと reactivate → 公開先 active', e.companies.pidA.seo === true && react.length === 2 && react.every((c) => c.at >= e.calls[e.calls.length - 1].at) && p.registered.pidA.state === 'active', p.calls.slice(ptBefore).map((c) => c.action));
  check('reactivate は いまの canonical_base で戻す', react[0]?.body.canonical_base?.startsWith('https://laruvisona.jp/hp/site-'));

  /* 7. 同期の失敗：5xx は再送待ち（決済は止めない）→ 再送の口で同じ event_at のまま届く。4xx は再送しない */
  await post(mock + '/__ent', { mode: 'fail503' });
  await profile('hp-bot', 'active');
  await afterBillingChange(db, OWNER, { plan: 'hp-bot-seo', status: 'active' }, { plan: 'hp-bot', status: 'active' }, 'down_fail', { eventAt: T(6) });
  const pend = await rec('id-a');
  check('5xx：例外なく戻り、控えは pending（next_at 付き・event_at はそのまま）', pend?.status === 'pending' && pend?.event_at === T(6) && !!pend?.next_at && pend?.attempts === 1, pend);
  await post(mock + '/__ent', { mode: 'ok' });
  const notDue = await fetch(base + '/api/cron/hp-entitlement-retry', { method: 'POST', headers: { Authorization: `Bearer ${adminSecret}` } }).then((r) => r.json());
  check('再送の口：時刻前（1 分後）のものは送らない', notDue.due === 0, notDue);
  for (const id of ['id-a', 'id-b']) {
    const row = await siteRow(id);
    await control({ patchSite: { id, patch: { settings_json: { ...row.settings_json, [ENT_KEY]: { ...row.settings_json[ENT_KEY], next_at: '2026-01-01T00:00:00.000Z' } } } } });
  }
  n = (await ent()).calls.length;
  const due = await fetch(base + '/api/cron/hp-entitlement-retry', { method: 'POST', headers: { Authorization: `Bearer ${adminSecret}` } }).then((r) => r.json());
  e = await ent();
  check('再送の口：時刻を過ぎたものを、控えた event_at のまま送る → synced', due.done === 2 && e.calls.slice(n).every((c) => c.body.event_at === T(6)) && (await rec('id-a'))?.status === 'synced', due);
  check('再送の口：鍵なしは 401', (await fetch(base + '/api/cron/hp-entitlement-retry', { method: 'POST' })).status === 401);
  await post(mock + '/__ent', { mode: 'fail409' });
  await profile('lite', 'active');
  await afterBillingChange(db, OWNER, { plan: 'hp-bot', status: 'active' }, { plan: 'lite', status: 'active' }, 'mismatch', { eventAt: T(7) });
  const f = await rec('id-a');
  check('409：再送しない（failed・next_at なし・運営へ）', f?.status === 'failed' && f?.next_at === null && f?.last_http === 409, f);
  await post(mock + '/__ent', { mode: 'ok' });
  await profile('hp-bot-seo', 'active');
  await afterBillingChange(db, OWNER, { plan: 'lite', status: 'active' }, { plan: 'hp-bot-seo', status: 'active' }, 'up_again', { eventAt: T(8) });

  /* 8. 編集画面の保存・履歴の復元で控えと public_id を消さない */
  const put = await asOwner('/api/sites/id-a', 'PUT', { settings_json: { laruseo: true } });
  const after = (await siteRow('id-a')).settings_json;
  check('編集画面の保存：控え・public_id はサーバーの値のまま', put.status === 200 && after[ENT_KEY]?.event_at === T(8) && after.larubotPublicId === 'pidA', { status: put.status, keys: Object.keys(after) });

  /* 9. 解約：公開先を retire してから cancelled（契約が終わった時刻） */
  n = (await ent()).calls.length;
  await beforeCancel(db, OWNER, 'hp-bot-seo', 'cancel', { eventAt: '2026-10-05T09:30:00.000Z' });
  e = await ent();
  check('解約：cancelled（plan は最後のもの）・呼んだ時点で公開先は retired・Bot/SEO とも止まる', e.calls.slice(n).length === 2 && e.calls.slice(n).every((c) => c.body.state === 'cancelled' && c.body.plan === 'hp-bot-seo' && c.ptState === 'retired') && e.companies.pidA.state === 'cancelled', e.calls.slice(n).map((c) => [c.body.state, c.ptState]));
  check('解約のあとも public_id・記事の設定は残る', (await siteRow('id-a')).settings_json.laruseoPublicId === 'pidA');

  /* 10. 再契約：新しい event_at で active → reactivate で公開先を戻す（同じ public_id） */
  await profile('hp-bot-seo', 'active');
  const ptN = (await pt()).calls.length;
  await afterBillingChange(db, OWNER, { plan: null, status: 'canceled' }, { plan: 'hp-bot-seo', status: 'active' }, 'recontract', { eventAt: '2026-10-05T10:00:00.000Z' });
  e = await ent(); p = await pt();
  check('再契約：同じ public_id で active・SEO 再開 → reactivate で公開先 active', e.companies.pidA.state === 'active' && e.companies.pidA.seo === true && p.calls.slice(ptN).some((c) => c.action === 'reactivate') && p.registered.pidA.state === 'active');

  /* 11. サイト削除：届かなければ保留、届けば site_deleted → 削除 */
  await post(mock + '/__ent', { mode: 'fail503' });
  let r = await asOwner('/api/sites/id-b', 'DELETE');
  check('サイト削除：site_deleted が届かない（5xx）→ 削除を保留（503）・サイトは残る', r.status === 503 && r.json.code === 'entitlement_pending' && !!(await siteRow('id-b')));
  await post(mock + '/__ent', { mode: 'ok' });
  n = (await ent()).calls.length;
  r = await asOwner('/api/sites/id-b', 'DELETE');
  e = await ent();
  const del = e.calls.slice(n);
  check('サイト削除：公開先 retire → site_deleted（pidB だけ）→ 削除', r.status === 200 && del.length === 1 && del[0].body.state === 'site_deleted' && del[0].body.public_id === 'pidB' && del[0].ptState === 'retired' && !(await siteRow('id-b')) && e.companies.pidA.state === 'active', del.map((c) => c.body));

  check('送った本文に鍵の値が入っていない', !JSON.stringify((await ent()).calls.map((c) => c.body)).includes('local-test-secret'));
} catch (err) {
  check('例外なく終わる', false, String(err));
}
console.log(`\n${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
