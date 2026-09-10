// 通常の利用者による「読み込み → 保存 → 公開 → 表示 → 更新 → 再公開」を、
// 実際のAPIだけを通して確認する。
//
//   node docs/reference-sites/salon/owner-publish-check.mjs --port 3300
//
// 管理者の一括再生成（/api/admin/republish-all）とは別の経路。
// こちらは利用者が自分のサイトを編集して公開するときに通る道:
//   GET  /api/sites/<id> …… ビルダーが読み込む
//   PUT  /api/sites/<id> …… ビルダーの保存
//   POST /api/sites/<id>/publish …… 公開ボタン
//   GET  /hp/<slug> …… 公開URL
//
// fixture（Supabaseの代わり）への直接の書き込みはしない。
// 直接触るのは初期データの読み出しだけで、変更はすべて実際の保存APIを通す。
// 公開URLの確認でもキャッシュは消さない（消さなくても入れ替わることを見る）。
//
// 認証は fixture が受ける。利用者のセッションを cookie で渡し、
// fixture の /auth/v1/user がその利用者を返す。

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

const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const session = {
  access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
const COOKIE = [
  `sb-127-auth-token=${cookieValue}`,
  `sb-localhost-auth-token=${cookieValue}`,
].join('; ');

const asOwner = (path, init = {}) => fetch(`${BASE}${path}`, {
  ...init,
  headers: { 'content-type': 'application/json', cookie: COOKIE, ...(init.headers || {}) },
});

// ── 0. 初期データ（fixtureに入れてある保存済みの状態）──
const seed = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id,user_id,slug`)).json())[0];
check('初期データのサイトがある', !!seed && seed.user_id === OWNER, seed?.id);
if (!seed) process.exit(1);
const ID = seed.id;

// ── 1. ビルダーの読み込み ──
{
  const r = await asOwner(`/api/sites/${ID}`);
  const { site } = await r.json().catch(() => ({}));
  check('所有者はサイトを読み込める', r.ok && !!site, `HTTP ${r.status}`);
  check('保存済みのブロックが読める', (site?.blocks_json?.pages?.[0]?.blocks?.length ?? 0) > 10,
    `${site?.blocks_json?.pages?.[0]?.blocks?.length ?? 0}個`);
  const noAuth = await fetch(`${BASE}/api/sites/${ID}`);
  check('セッションが無ければ読み込めない', noAuth.status === 401, `HTTP ${noAuth.status}`);
}

// 読み込み → 編集 → 保存APIへ、を1つにまとめる（ビルダーがしていることと同じ順序）
const load = async () => (await (await asOwner(`/api/sites/${ID}`)).json()).site;
const save = async (site, edit) => {
  const next = JSON.parse(JSON.stringify(site));
  edit(next);
  const r = await asOwner(`/api/sites/${ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: next.name, blocks_json: next.blocks_json,
      seo_json: next.seo_json, settings_json: next.settings_json,
    }),
  });
  return { res: r, body: await r.json().catch(() => ({})) };
};
const heroOf = s => s.blocks_json.pages[0].blocks.find(b => b.type === 'hero');
// 見出しの改行は、公開HTMLでは <br> になる
const asHtml = t => String(t).replace(/\r?\n/g, '<br>');
const bookingOf = s => s.blocks_json.pages[0].blocks.find(b => b.type === 'booking');
const publish = () => asOwner(`/api/sites/${ID}/publish`, { method: 'POST' });
// キャッシュは消さない。実際の利用者と同じように取りに行くだけ。
const served = async () => (await fetch(`${BASE}/hp/${args.slug}`)).text();

// ── 2. 保存API（認可）──
{
  const noAuth = await fetch(`${BASE}/api/sites/${ID}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }),
  });
  check('セッションが無ければ保存できない', noAuth.status === 401, `HTTP ${noAuth.status}`);
  const noAuthPub = await fetch(`${BASE}/api/sites/${ID}/publish`, { method: 'POST' });
  check('セッションが無ければ公開できない', noAuthPub.status === 401, `HTTP ${noAuthPub.status}`);
}

const original = await load();
const originalHeading = heroOf(original).data.heading;

// ── 3. 保存 → 公開 → 公開URLに出る ──
const marker = `保存の目印 ${Date.now()}`;
{
  const { res } = await save(original, s => { heroOf(s).data.heading = marker; });
  check('保存APIが成功を返す', res.ok, `HTTP ${res.status}`);
  const reread = await load();
  check('読み直すと保存内容になっている', heroOf(reread).data.heading === marker);

  const pub = await publish();
  check('公開ルートが成功を返す', pub.ok, `HTTP ${pub.status}`);
  const html = await served();
  check('公開URLに保存内容が出る（キャッシュ削除なし）', html.includes(marker), marker);
  check('前の内容は残っていない', !html.includes(asHtml(originalHeading)), originalHeading.replace(/\n/g, '⏎'));
  check('選択書体（明朝）が読み込まれる', html.includes('Shippori+Mincho'));
  check('画像は公開URLで配れる形になっている', /\/salon\/hero-\d+\.(avif|webp|jpg)/.test(html));
  check('実際のサイトIDが埋まっている', html.includes(ID) && html.includes('__LHPSID'), ID);
}

// ── 4. もう一度 更新 → 再公開（キャッシュ削除なしで入れ替わる）──
const marker2 = `更新の目印 ${Date.now()}`;
{
  const { res } = await save(await load(), s => { heroOf(s).data.heading = marker2; });
  check('2回目の保存も成功する', res.ok, `HTTP ${res.status}`);
  const pub = await publish();
  check('再公開が成功する', pub.ok, `HTTP ${pub.status}`);
  const html = await served();
  check('再公開で内容が入れ替わる（キャッシュ削除なし）', html.includes(marker2), marker2);
  check('1回目の内容は残っていない', !html.includes(marker), marker);
}

// ── 5. stickyCta を保存APIで切り替えて、公開HTMLに出入りする ──
{
  const { res } = await save(await load(), s => { bookingOf(s).data.stickyCta = false; });
  check('固定CTAを外す保存が成功する', res.ok, `HTTP ${res.status}`);
  await publish();
  const off = await served();
  check('外すと公開HTMLから固定CTAが消える', !off.includes('lhp-sticky-cta"'));

  const back = await save(await load(), s => { bookingOf(s).data.stickyCta = true; });
  check('固定CTAを戻す保存が成功する', back.res.ok, `HTTP ${back.res.status}`);
  await publish();
  const on = await served();
  check('戻すと公開HTMLに固定CTAが出る', on.includes('lhp-sticky-cta"'));
  const reread = await load();
  check('読み直しても設定が保持されている', bookingOf(reread).data.stickyCta === true);
}

// ── 6. 画像が実際に配信される ──
for (const f of ['hero-900.avif', 'hero-sp-780.webp', 'hero-1600.jpg']) {
  const r = await fetch(`${BASE}/salon/${f}`);
  check(`画像の公開URL: ${f}`, r.ok, `HTTP ${r.status} ${r.headers.get('content-length')}B`);
}

// ── 7. 元の見出しへ戻す（戻すのも保存API経由）──
{
  const { res } = await save(await load(), s => { heroOf(s).data.heading = originalHeading; });
  check('元に戻す保存も成功する', res.ok, `HTTP ${res.status}`);
  await publish();
  const html = await served();
  check('元の見出しで公開し直せる', html.includes(asHtml(originalHeading)), originalHeading.replace(/\n/g, '⏎'));
}

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('読み込み → 保存API → 公開 → 表示 → 更新 → 再公開 まで、実APIだけで通りました');
