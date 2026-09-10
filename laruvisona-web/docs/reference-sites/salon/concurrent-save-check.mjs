// 設定の一部だけを保存するとき、別の画面が入れた変更を消さないこと。
//
//   node docs/reference-sites/salon/concurrent-save-check.mjs --port 3300
//
// 設定の一部更新は「読む → 重ねる → 書く」の3手になる。読んだあと書くまでのあいだに
// 別の画面が同じ行を更新すると、こちらが読んだ古い値でそれを消せてしまう。
// ここでは、偽のデータベース側で「読んだあと・書く直前」に別の更新を差し込み、
// 消えないことを確かめる。順番に保存するだけでは、この隙間は再現できない。
const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookie = `sb-127-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id`)).json())[0];
const ID = site.id;
const read = async () => (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}&select=settings_json,updated_at`)).json())[0];
const control = (body) => fetch(`${FIX}/__control`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const put = (body) => fetch(`${BASE}/api/sites/${ID}`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });

const ORIGINAL = await read();

/* ── 1. 前提 ── */
{
  const a = await read();
  await new Promise(r => setTimeout(r, 5));
  await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ view_count: 1 }) });
  const b = await read();
  check('前提: 更新すると updated_at が進む', a.updated_at !== b.updated_at, `${a.updated_at} → ${b.updated_at}`);
}

/* ── 2. 読んだあとに別の更新が入っても、それを消さない ── */
{
  await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings_json: { ...ORIGINAL.settings_json, notifyEmail: 'mae@example.com' } }),
  });
  // 「読んだあと・書く直前」に、別の画面が届け先を変える
  await control({ beforeUpdate: { id: ID, settings_json: { notifyEmail: 'betsu-no-gamen@example.com' } } });

  const res = await put({ settings_json_patch: { customCss: '.probe{}' } });
  check('保存そのものは通る', res.status === 200, `HTTP ${res.status}`);

  const after = await read();
  check('あいだに入った別の変更を消さない', after.settings_json.notifyEmail === 'betsu-no-gamen@example.com',
    `notifyEmail=${after.settings_json.notifyEmail}`);
  check('こちらの変更も入っている', after.settings_json.customCss === '.probe{}');
  check('関係のない設定は残っている', after.settings_json.globalFooter !== undefined || ORIGINAL.settings_json.globalFooter === undefined);
}

/* ── 3. ぶつかり続けるときは、黙って上書きせずに知らせる ── */
{
  await control({ beforeUpdate: { id: ID, settings_json: { notifyEmail: 'zutto@example.com' }, times: 20 } });
  const res = await put({ settings_json_patch: { customCss: '.never{}' } });
  const body = await res.json().catch(() => ({}));
  check('ぶつかり続けたら 409 を返す', res.status === 409, `HTTP ${res.status}`);
  check('理由が日本語で返る', typeof body.error === 'string' && body.error.includes('別の画面'), String(body.error).slice(0, 40));
  await control({ beforeUpdate: null });
  const after = await read();
  check('あきらめたときは何も書かない', after.settings_json.customCss !== '.never{}');
}

/* ── 4. 丸ごと置き換え（settings_json）はこれまでどおり ── */
{
  const res = await put({ settings_json: { ...ORIGINAL.settings_json, notifyEmail: 'marugoto@example.com' } });
  check('丸ごと置き換えは通る', res.status === 200, `HTTP ${res.status}`);
  const after = await read();
  check('丸ごと置き換えは送った内容になる', after.settings_json.notifyEmail === 'marugoto@example.com');
}

/* ── 5. 送り方が違うときは断る ── */
{
  const r1 = await put({ settings_json: {}, settings_json_patch: {} });
  check('両方いっしょには送れない', r1.status === 400, `HTTP ${r1.status}`);
  const r2 = await put({ settings_json_patch: [1, 2] });
  check('配列は受け取らない', r2.status === 400, `HTTP ${r2.status}`);
  const r3 = await fetch(`${BASE}/api/sites/${ID}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings_json_patch: { customCss: 'x' } }) });
  check('ログインしていなければ保存できない', r3.status === 401, `HTTP ${r3.status}`);
}

/* 元に戻す */
await control({ failWrites: false, beforeUpdate: null });
await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ settings_json: ORIGINAL.settings_json }),
});

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('設定の一部保存が、あいだに入った更新を消さないことを確認しました');
