// LARU SEO Publication Target の自動同期を、実際のサーバー（:3319）・偽DB（:54999）・LARUbot の代わり（:54997）で確かめる。
// 代わりの LARUbot は、呼ばれた瞬間に HP の記事一覧（/hp/<slug>/articles）の状態を記録する。これで順番を証明する：
//   register の時点で記事一覧が 200／deactivate・retire の時点ではまだ 200、そのあと 404。
// 前提: LARU_HP_API_SECRET=local-test-secret LARUBOT_API_URL=http://127.0.0.1:54997 HP_ARTICLES_READY_ORIGIN=http://127.0.0.1:3319
//       で起動した fixture 向けビルド。この確認も同じ環境変数で動かす（請求・独自ドメインの関数は直接呼ぶ）。
//   node --import ./tests/_resolve-ts.mjs tests/http/publication-target-lifecycle-check.ts
import { createClient } from '@supabase/supabase-js';
import {
  afterBillingChange, afterDomainChange, beforeBillingChange, beforeCancel, beforePrimaryDomainRelease,
} from '../../lib/publication-target-sync';

const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999', mock = 'http://127.0.0.1:54997';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const TEST_PID = 'f509753a-e62f-46e1-927e-d721dd934d1f';
const results: boolean[] = [];
const check = (name: string, ok: unknown, detail: unknown = '') => { results.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', name, typeof detail === 'string' ? detail : JSON.stringify(detail)); };
const post = (u: string, b: unknown) => fetch(u, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const control = (b: unknown) => post(fixture + '/__control', b);
type Call = { action: string; body: Record<string, string>; auth: boolean; articlesStatus: number | null };
const pt = async (): Promise<{ calls: Call[]; registered: Record<string, { state: string; site_id: string; canonical_base: string }> }> => (await fetch(mock + '/__pt')).json();
const ptMode = (mode: string, reset = false) => post(mock + '/__pt', { mode, reset });
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
const asOwner = (path: string, method: string) => fetch(base + path, { method, headers: { cookie, origin: base, 'content-type': 'application/json' } })
  .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) as Record<string, unknown> }));
const articles = (slug: string) => fetch(`${base}/hp/${slug}/articles`, { headers: { host: 'laruvisona.jp' }, redirect: 'manual' }).then((r) => r.status);
const siteRow = async (id: string) => (await (await fetch(`${fixture}/rest/v1/sites?id=eq.${id}`)).json())[0];
const db = createClient(fixture, 'service-stub', { auth: { persistSession: false } });
const since = async (n: number) => (await pt()).calls.slice(n);

const item = { id: 1, slug: 'a-1', title: '記事1', meta_description: '説明', target_keyword: '', thumbnail_url: null, published_at: '2026-10-01T00:00:00', updated_at: '2026-10-01T00:00:00', canonical_url: 'https://larubot.tokyo/blog/a-1' };
const PUB = { target_type: 'internal_blog', canonical_base: 'https://larubot.tokyo', article_path: '/blog/{slug}', canonical_policy: 'single_primary' };

try {
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
  await control({ patchSite: { id: 'id-a', patch: { user_id: OWNER, custom_domain: null, published: true, settings_json: { laruseoPublicId: 'pidA', laruseo: true } } } });
  await control({ patchSite: { id: 'id-b', patch: { user_id: OWNER, custom_domain: null, published: true, settings_json: { laruseoPublicId: 'pidB', laruseo: true } } } });
  await post(mock + '/__state', { tenants: { pidA: { publication: PUB, items: [item] }, pidB: { publication: PUB, items: [item] } } });
  await ptMode('ok', true);
  check('準備：公開中・LARU SEO あり → 記事一覧 200', (await articles('site-a')) === 200);

  /* 1. 非公開（未登録）→ 先に deactivate（未登録なので changed:false）→ そのあと記事一覧は 404 */
  let r = await asOwner('/api/sites/id-a/publish', 'DELETE');
  let c = await since(0);
  check('非公開（未登録）：deactivate site_unpublished を先に呼ぶ・呼んだ時点の記事一覧は 200', r.status === 200 && c.length === 1 && c[0].action === 'deactivate' && c[0].body.reason === 'site_unpublished' && c[0].articlesStatus === 200, { status: r.status, c });
  check('非公開のあと：記事一覧 404・サイトは非公開', (await articles('site-a')) === 404 && (await siteRow('id-a')).published === false);

  /* 2. 公開 → 記事一覧 200 を確かめてから register */
  r = await asOwner('/api/sites/id-a/publish', 'POST');
  c = await since(1);
  check('公開：register を呼ぶ・呼んだ時点の記事一覧は 200（順番）', r.status === 200 && r.json.seoPublication === 'done' && c.length === 1 && c[0].action === 'register' && c[0].articlesStatus === 200, { status: r.status, sp: r.json.seoPublication, c });
  check('register の中身：public_id・site_id・canonical_base（パス形式）・article_path・鍵ヘッダ',
    c[0].body.public_id === 'pidA' && c[0].body.site_id === 'id-a' && c[0].body.canonical_base === 'https://laruvisona.jp/hp/site-a' && c[0].body.article_path === '/articles/{slug}' && c[0].auth === true, c[0].body);
  check('LARUbot 側の状態：active（旧 URL は HP へ 301）', (await pt()).registered.pidA?.state === 'active');

  /* 3. もう一度公開 → 同じ register（冪等・枠を増やさない） */
  r = await asOwner('/api/sites/id-a/publish', 'POST');
  check('再公開（公開中）：同じ register・登録は 1 件のまま', r.status === 200 && (await since(2)).length === 1 && Object.keys((await pt()).registered).length === 1);

  /* 4. 止められないとき：非公開を保留 */
  await ptMode('fail503');
  let n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a/publish', 'DELETE');
  c = await since(n);
  check('5xx：3 回まで再試行（計 4 回）→ 非公開を保留（503 publication_target_pending）', r.status === 503 && r.json.code === 'publication_target_pending' && c.length === 4, { status: r.status, calls: c.length });
  check('保留中：サイトは公開のまま・記事一覧 200', (await siteRow('id-a')).published === true && (await articles('site-a')) === 200);
  await ptMode('fail401');
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a/publish', 'DELETE');
  check('401：再試行しない（1 回）→ 非公開を保留', r.status === 503 && (await since(n)).length === 1 && (await siteRow('id-a')).published === true);
  await ptMode('fail409');
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a/publish', 'DELETE');
  check('409 site_in_use：再試行しない・301 は来ていないので非公開へ進む', r.status === 200 && (await since(n)).length === 1 && (await siteRow('id-a')).published === false);

  /* 5. 正常な非公開 → 再公開（同じ target を active に戻す） */
  await ptMode('ok');
  await asOwner('/api/sites/id-a/publish', 'POST');
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a/publish', 'DELETE');
  c = await since(n);
  check('非公開（登録済み）：deactivate を先に・呼んだ時点で記事一覧 200・状態 inactive', r.status === 200 && c.length === 1 && c[0].articlesStatus === 200 && (await pt()).registered.pidA.state === 'inactive', c);
  check('非公開のあと：記事一覧 404', (await articles('site-a')) === 404);
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a/publish', 'POST');
  c = await since(n);
  check('再公開：register（同じ public_id・site_id）→ active に戻る・呼んだ時点で記事一覧 200', c.length === 1 && c[0].action === 'register' && c[0].articlesStatus === 200 && (await pt()).registered.pidA.state === 'active' && Object.keys((await pt()).registered).length === 1);

  /* 6. 呼ばない：運営の一時テストサイト・LARU SEO の無い契約 */
  await control({ patchSite: { id: 'id-b', patch: { settings_json: { laruseoPublicId: TEST_PID, laruseo: true } } } });
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-b/publish', 'POST');
  check('運営の一時テストサイト（f509753a…）：登録しない', r.status === 200 && r.json.seoPublication === 'skipped:excluded' && (await since(n)).length === 0);
  await control({ patchSite: { id: 'id-b', patch: { settings_json: { laruseoPublicId: 'pidB', laruseo: true } } } });

  /* 7. 独自ドメインの追加・切替：同じ hp_site_id のまま新しい base で register（新 URL 200 のあと）。外す前はパス形式へ先に戻す */
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: 'salon-a.example' } } });
  n = (await pt()).calls.length;
  const dom = await afterDomainChange(OWNER, 'id-a', 'domain_primary_set');
  c = await since(n);
  const reg = (await pt()).registered;
  check('独自ドメイン設定後：register（新 base https://salon-a.example・同じ site_id）・呼んだ時点で記事一覧 200', dom?.kind === 'done' && c.length === 1 && c[0].body.canonical_base === 'https://salon-a.example' && c[0].body.site_id === 'id-a' && c[0].articlesStatus === 200, c);
  check('枠は二重にならない（登録 1 件・同じ public_id を更新）', Object.keys(reg).filter((k) => reg[k].site_id === 'id-a').length === 1 && reg.pidA.canonical_base === 'https://salon-a.example');
  n = (await pt()).calls.length;
  const released = await beforePrimaryDomainRelease(OWNER, 'id-a', 'salon-a.example');
  c = await since(n);
  check('独自ドメインを外す前：パス形式の base へ先に register → 解除してよい', released === true && c.length === 1 && c[0].body.canonical_base === 'https://laruvisona.jp/hp/site-a');
  check('別のホスト（主でない）を外すときは呼ばない', (await beforePrimaryDomainRelease(OWNER, 'id-a', 'other.example')) === true && (await since(n + 1)).length === 0);
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: null } } });
  await ptMode('fail503');
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: 'salon-a.example' } } });
  check('独自ドメインを外す前に切り替えられない（5xx）→ 解除を保留', (await beforePrimaryDomainRelease(OWNER, 'id-a', 'salon-a.example')) === false);
  await control({ patchSite: { id: 'id-a', patch: { custom_domain: null } } });
  await ptMode('ok');
  await afterDomainChange(OWNER, 'id-a', 'domain_reset');

  /* 8. ダウングレード（LARU SEO なしへ）：記事ページが消える前に deactivate seo_disabled。戻したら register */
  n = (await pt()).calls.length;
  const from = { plan: 'hp-bot-seo', status: 'active' }, to = { plan: 'hp-bot', status: 'active' };
  const okDown = await beforeBillingChange(db, OWNER, from, to, 'test_downgrade');
  c = await since(n);
  check('ダウングレード前：公開中の対象サイトへ deactivate seo_disabled・呼んだ時点で記事一覧 200', okDown === true && c.length === 2 && c.every((x) => x.action === 'deactivate' && x.body.reason === 'seo_disabled' && x.articlesStatus === 200), c.map((x) => [x.body.site_id, x.action, x.articlesStatus]));
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp-bot' } } });
  check('ダウングレード後：記事一覧 404', (await articles('site-a')) === 404);
  n = (await pt()).calls.length;
  check('プランに関係ない変更（同じプランのまま）では呼ばない', (await beforeBillingChange(db, OWNER, to, to, 'noop')) === true && (await since(n)).length === 0);
  await control({ patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo' } } });
  n = (await pt()).calls.length;
  await afterBillingChange(db, OWNER, to, from, 'test_upgrade');
  c = await since(n);
  check('LARU SEO ありへ戻した後：reactivate（記事一覧 200 の後。未登録なら register）', c.length >= 1 && c.every((x) => (x.action === 'reactivate' || x.action === 'register') && x.articlesStatus === 200) && (await pt()).registered.pidA.state === 'active', c.map((x) => [x.body.site_id, x.action, x.articlesStatus]));
  await ptMode('fail503');
  check('ダウングレード前に止められない（5xx）→ 保留（false）', (await beforeBillingChange(db, OWNER, from, to, 'test_downgrade_fail')) === false);
  await ptMode('ok');

  /* 9. 解約：公開停止の前に retire plan_cancelled */
  n = (await pt()).calls.length;
  const okCancel = await beforeCancel(db, OWNER, 'hp-bot-seo', 'test_cancel');
  c = await since(n);
  check('解約前：retire plan_cancelled・呼んだ時点で記事一覧 200', okCancel === true && c.length === 2 && c.every((x) => x.action === 'retire' && x.body.reason === 'plan_cancelled' && x.articlesStatus === 200) && (await pt()).registered.pidA.state === 'retired', c.map((x) => [x.body.site_id, x.action, x.articlesStatus]));
  n = (await pt()).calls.length;
  check('LARU SEO の無いプランの解約では呼ばない', (await beforeCancel(db, OWNER, 'hp-bot', 'test_cancel_nonseo')) === true && (await since(n)).length === 0);

  /* 10. サイト削除：消す前に retire site_deleted。止められなければ削除を保留 */
  await asOwner('/api/sites/id-a/publish', 'POST');
  await ptMode('fail503');
  r = await asOwner('/api/sites/id-a', 'DELETE');
  check('削除前に止められない（5xx）→ 削除を保留（503）・サイトは残る', r.status === 503 && !!(await siteRow('id-a')));
  await ptMode('ok');
  n = (await pt()).calls.length;
  r = await asOwner('/api/sites/id-a', 'DELETE');
  c = await since(n);
  check('サイト削除：retire site_deleted を先に・呼んだ時点で記事一覧 200・そのあとサイトは無い', r.status === 200 && c.length === 1 && c[0].action === 'retire' && c[0].body.reason === 'site_deleted' && c[0].articlesStatus === 200 && !(await siteRow('id-a')), { status: r.status, c });
  check('削除のあと：記事一覧 404', (await articles('site-a')) === 404);

  /* 11. 鍵の値をログやレスポンスに出さない */
  const all = JSON.stringify((await pt()).calls.map((x) => x.body));
  check('送った本文に鍵の値が入っていない', !all.includes('local-test-secret'));
} catch (e) {
  check('例外なく終わる', false, String(e));
}
console.log(`\n${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
