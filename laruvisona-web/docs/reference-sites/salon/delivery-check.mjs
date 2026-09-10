// 画像が「普通に起動しただけ」で配信されること。
//
//   node docs/reference-sites/salon/delivery-check.mjs --port 3300
//
// 以前は画像を docs/…/images/ に置き、READMEの手順で public へ写していた。
// そのため、取得してビルドして起動しただけでは /salon/hero-1600.jpg が
// 404 になっていた（手順を踏んだ人の手元でだけ映る状態）。
// いまは public/salon/ に置いてある。ここでは次を確かめる。
//
//   1. site.json が指している画像が、すべてHTTPで返ること
//   2. 形式（avif / webp / jpg）がそろっていること
//   3. 実際のブラウザが選んで取りに行った画像が、ちゃんと返っていること
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const args = { port: '3300', slug: 'yuian', secret: 'test-admin-secret' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
const HERE = path.dirname(new URL(import.meta.url).pathname);

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

/* ── 1. site.json が指している画像 ── */
const raw = fs.readFileSync(path.join(HERE, 'site.json'), 'utf8');
const urls = [...new Set([...raw.matchAll(/\/salon\/[A-Za-z0-9._-]+\.(?:avif|webp|jpe?g|png)/g)].map(m => m[0]))].sort();
check('site.json が画像を指している', urls.length >= 20, `${urls.length}件`);

const TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
const bad = [];
const kinds = {};
for (const u of urls) {
  const res = await fetch(BASE + u);
  const ext = u.split('.').pop().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  if (res.status !== 200 || buf.length < 500 || !ct.startsWith(TYPES[ext] || 'image/')) {
    bad.push(`${u} → ${res.status} ${ct} ${buf.length}B`);
  }
  kinds[ext] = (kinds[ext] || 0) + 1;
}
check('すべての画像が配信されている', bad.length === 0, bad.slice(0, 3).join(' / '));
check('avif も webp も jpg もそろっている', !!kinds.avif && !!kinds.webp && !!kinds.jpg,
  Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' / '));

/* ── 2. 置いていない画像は 404 のままであること（1の確認が形だけになっていないか）── */
{
  const res = await fetch(`${BASE}/salon/kore-wa-nai.jpg`);
  check('対照: 置いていない画像は 404', res.status === 404, `HTTP ${res.status}`);
}

/* ── 3. ブラウザが実際に選んだ画像 ──
   公開URLを本物のブラウザで開き、src/srcset から選ばれて実際に取りに行った
   画像を見る。並んでいるURLを順に叩くだけでは、端末ごとに選ばれる1枚が
   返っているかは分からない。 */
{
  const r = await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${args.secret}` },
    body: JSON.stringify({ onlyOutdated: false, slug: args.slug }),
  });
  check('公開HTMLを作れる', r.ok, `HTTP ${r.status}`);
}

const b = await chromium.launch();
for (const [label, viewport] of [['パソコン', { width: 1440, height: 900 }], ['スマホ', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport, locale: 'ja-JP', deviceScaleFactor: label === 'スマホ' ? 3 : 1 });
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
  const page = await ctx.newPage();
  const seen = [];
  page.on('response', r => { if (r.url().includes('/salon/')) seen.push({ url: r.url(), status: r.status() }); });
  await page.goto(`${BASE}/hp/${args.slug}`, { waitUntil: 'load' });
  // 下の写真は近づいてから読む作りなので、いちど最後まで送る
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  });
  await page.waitForTimeout(1500);

  check(`${label}: 画像を取りに行っている`, seen.length > 0, `${seen.length}件`);
  const failed = seen.filter(s => s.status >= 400);
  check(`${label}: 取りに行った画像がすべて返っている`, failed.length === 0,
    failed.slice(0, 3).map(f => `${f.url.split('/').pop()} ${f.status}`).join(' / '));
  const heroPick = seen.map(s => s.url.split('/').pop()).find(n => /^hero/.test(n));
  check(`${label}: 最初の写真は軽い形式が選ばれた`, !!heroPick && /\.(avif|webp)$/.test(heroPick), heroPick || 'なし');
  if (label === 'スマホ') {
    check('スマホ: 縦向きの切り出しが選ばれた', !!heroPick && /^hero-sp-/.test(heroPick), heroPick || 'なし');
  }
  await ctx.close();
}
await b.close();

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('普通に起動しただけで画像が配信されることを確認しました');
