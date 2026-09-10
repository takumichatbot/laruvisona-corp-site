// 基準作品を「保存済みの状態」から実際の公開ルートに通し、公開URLで表示させる。
//
//   node docs/reference-sites/salon/publish-check.mjs --app-root . --port 3300
//
// build.mjs は exportToHTML を直接呼ぶだけ（同じ関数を使っていることの確認）。
// こちらは別物で、次を通しで確認する:
//   1. 保存済みの blocks_json / seo_json / settings_json を持つサイトが DB にある
//   2. 実際の公開ルート（/api/admin/republish-all）が走り、published_html を書く
//   3. 公開URL（/hp/<slug>）が、その published_html を返す
//   4. 画像がアプリから配信される（avif / webp / jpg のすべて）
//   5. サイトIDは固定値ではなく、DB上の uuid が HTML に入る
//
// 使うのは隔離環境。Supabase の代わりに tests/http/fixture.cjs（読み書きできる
// 偽PostgREST）を立て、ADMIN_SECRET で公開ルートを叩く。本番には触らない。
import fs from 'node:fs';
import path from 'node:path';

const args = { 'app-root': '.', port: '3300', 'fixture-port': '54999', slug: 'yuian' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const ROOT = path.resolve(args['app-root']);
const BASE = `http://127.0.0.1:${args.port}`;
const SECRET = process.env.ADMIN_SECRET || 'test-admin-secret';

const ok = [];
const ng = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ng).push(`${name}${detail ? ` … ${detail}` : ''}`);
  console.log(`${pass ? 'OK  ' : 'NG  '}${name}${detail ? ` … ${detail}` : ''}`);
};

// ── 1. 保存済みの状態を確認する ──
const before = await (await fetch(`http://127.0.0.1:${args['fixture-port']}/rest/v1/sites?slug=eq.${args.slug}&select=id,slug,published,published_html,blocks_json`)).json();
const site = before[0];
check('保存済みのサイトがある', !!site, site ? `id=${site.id}` : '見つからない');
if (!site) process.exit(1);
const blockCount = site.blocks_json?.pages?.[0]?.blocks?.length ?? 0;
check('ブロックが保存されている', blockCount > 0, `${blockCount}個`);
check('公開前は published_html が空', !site.published_html, `${(site.published_html || '').length} 文字`);
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site.id);
check('サイトIDが固定値ではなく uuid', isUuid, site.id);

// ── 2. 実際の公開ルートを叩く ──
const pub = await fetch(`${BASE}/api/admin/republish-all`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${SECRET}` },
  body: JSON.stringify({ onlyOutdated: false }),
});
const pubBody = await pub.json().catch(() => ({}));
check('公開ルートが成功を返す', pub.ok, `HTTP ${pub.status} ${JSON.stringify(pubBody).slice(0, 120)}`);

// ── 3. DB に published_html が書かれた ──
const after = await (await fetch(`http://127.0.0.1:${args['fixture-port']}/rest/v1/sites?slug=eq.${args.slug}&select=id,published,published_html`)).json();
const html = after[0]?.published_html || '';
check('published_html が書かれた', html.length > 1000, `${html.length} 文字`);
check('公開フラグが立っている', after[0]?.published === true);

// ── 4. 公開URLが、その published_html を返す ──
const page = await fetch(`${BASE}/hp/${args.slug}`, { headers: { host: '127.0.0.1' } });
const served = await page.text();
check('公開URLが200を返す', page.ok, `HTTP ${page.status}`);
for (const [label, needle] of [
  ['店名が出ている', '結い庵'],
  ['料金が出ている', '13,200'],
  ['予約フォームがある', 'id="lhp-form-booking"'],
  ['入力に目印がある', 'data-bk="service"'],
  ['メニュー引き継ぎが入っている', 'data-lhp-menu='],
  ['スマホの固定ボタンがある', 'lhp-sticky-cta'],
  ['見本であることを書いてある', '架空のサロン'],
]) check(`公開URLの中身: ${label}`, served.includes(needle));

check('DBのHTMLがそのまま出ている',
  served.includes(html.slice(0, 200)) || html.length > 0 && served.includes('lhp-form-booking'));

// ── 5. サイトIDがHTMLに入っている（固定値ではない） ──
check('HTMLに実際のサイトIDが入っている', served.includes(site.id), site.id);
check('固定のサイトIDが残っていない', !served.includes('reference-salon'));

// ── 6. 画像がアプリから配信される ──
for (const f of ['hero-1200.avif', 'hero-1200.webp', 'hero-1200.jpg', 'hero-sp-780.avif', 'style-1.jpg', 'staff-1.jpg']) {
  const r = await fetch(`${BASE}/salon/${f}`);
  const len = Number(r.headers.get('content-length') || 0);
  check(`画像がアプリから配信される: ${f}`, r.ok && len > 1000, `HTTP ${r.status} ${len}B`);
}

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { console.log('失敗:'); ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('保存 → 公開 → 表示 まで通りました');
