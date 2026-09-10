// 通常の利用者による「保存 → 公開 → 表示」を、隔離環境で通しで確認する。
//
//   node docs/reference-sites/salon/owner-publish-check.mjs --port 3300
//
// 管理者の一括再生成（/api/admin/republish-all）とは別の経路。
// こちらは利用者が自分のサイトを保存して公開するときに通る道:
//   PATCH /rest/v1/sites …… ビルダーの保存に相当（blocks_json を書く）
//   POST  /api/sites/<id>/publish …… 公開ボタン
//   GET   /hp/<slug> …… 公開URL
//
// 認証は Supabase の代わりに fixture が受ける。利用者のセッションを
// cookie で渡し、fixture の /auth/v1/user がその利用者を返す。
import fs from 'node:fs';

const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;

const ok = [], ng = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ng).push(name);
  console.log(`${pass ? 'OK  ' : 'NG  '}${name}${detail ? ` … ${detail}` : ''}`);
};

const session = {
  access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
  user: { id: 'u-owner', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
const COOKIE = [
  `sb-127-auth-token=${cookieValue}`,
  `sb-localhost-auth-token=${cookieValue}`,
].join('; ');

const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id,user_id,slug,published,published_html`)).json())[0];
check('対象のサイトがある', !!site, site?.id);
if (!site) process.exit(1);

// ── 1. ビルダーの保存に相当する書き込み ──
const marker = `保存の目印 ${Date.now()}`;
const saved = await (await fetch(`${FIX}/rest/v1/sites?id=eq.${site.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ published_html: '' }),
})).json();
check('保存で published_html を空に戻せる', (saved[0]?.published_html ?? '') === '');

// ── 2. 公開ボタンの経路 ──
const res = await fetch(`${BASE}/api/sites/${site.id}/publish`, {
  method: 'POST', headers: { cookie: COOKIE },
});
const body = await res.json().catch(() => ({}));
check('利用者の公開ルートが成功を返す', res.ok, `HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`);

// 認可がちゃんと効いているか（cookie 無しは通らない）
const noAuth = await fetch(`${BASE}/api/sites/${site.id}/publish`, { method: 'POST' });
check('セッションが無ければ公開できない', noAuth.status === 401, `HTTP ${noAuth.status}`);

// ── 3. 公開URLに出る ──
const after = (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${site.id}&select=published,published_html`)).json())[0];
check('published_html が書かれた', (after?.published_html || '').length > 1000, `${(after?.published_html || '').length} 文字`);

const page = await fetch(`${BASE}/hp/${args.slug}`);
const html = await page.text();
check('公開URLが200', page.ok, `HTTP ${page.status}`);
check('選択書体（明朝）が読み込まれる', html.includes('Shippori+Mincho'), 'Shippori Mincho');
check('画像は公開URLで配れる形になっている', /\/salon\/hero-\d+\.(avif|webp|jpg)/.test(html));
check('実際のサイトIDが埋まっている', html.includes(site.id), site.id);
check('予約データの紐付け（siteId）が入っている', html.includes(`__LHPSID`) && html.includes(site.id));

// 画像が実際に配信される
for (const f of ['hero-900.avif', 'hero-sp-780.webp', 'hero-1600.jpg']) {
  const r = await fetch(`${BASE}/salon/${f}`);
  check(`画像の公開URL: ${f}`, r.ok, `HTTP ${r.status} ${r.headers.get('content-length')}B`);
}

// ── 4. 更新 → 再公開で内容が入れ替わる ──
const blocks = (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${site.id}&select=blocks_json`)).json())[0].blocks_json;
const first = blocks.pages[0].blocks.find(b => b.type === 'hero');
const original = first.data.heading;
first.data.heading = marker;
await fetch(`${FIX}/rest/v1/sites?id=eq.${site.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ blocks_json: blocks }),
});
const res2 = await fetch(`${BASE}/api/sites/${site.id}/publish`, { method: 'POST', headers: { cookie: COOKIE } });
check('更新後の再公開が成功する', res2.ok, `HTTP ${res2.status}`);
const page2 = await fetch(`${BASE}/hp/${args.slug}`, { headers: { 'cache-control': 'no-cache' } });
const html2 = await page2.text();
check('再公開で内容が入れ替わる', html2.includes(marker), marker);
check('前の内容は残っていない', !html2.includes(original), original);

// 元に戻す
first.data.heading = original;
await fetch(`${FIX}/rest/v1/sites?id=eq.${site.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ blocks_json: blocks }),
});
await fetch(`${BASE}/api/sites/${site.id}/publish`, { method: 'POST', headers: { cookie: COOKIE } });

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('通常の保存 → 公開 → 表示 → 更新 → 再公開 まで通りました');
