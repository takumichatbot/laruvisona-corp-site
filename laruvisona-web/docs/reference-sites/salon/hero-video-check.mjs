// 最初の画面の「動く背景」が、決めたとおりに動くこと。
//
//   node docs/reference-sites/salon/hero-video-check.mjs --port 3300
//
// 決めごと（素材が届く前に、道だけ先に確かめておく）:
//   1. 写真が先。動画はあとから重ねる。最初の表示を待たせない
//   2. 音は出さない。画面の中で再生する（全画面にしない）
//   3. 止める手段がある
//   4. 端末が「動きを減らす」設定なら、動画を**取りに行かない**
//   5. 動画が無い／落とせないときは、写真のままで崩れない
//
// 動画そのものは、小さな試験用の映像を使う。
// （tests/fixtures/hero-motion-test.webm / .mp4。ただの色の変化で、店舗の映像ではない）
// この環境のブラウザは H.264 を持たないので、検査では webm を再生させる。
// 実機では mp4 が使われる。順番（webm → mp4）はHTMLの中で確かめる。
// 検査のあいだだけ、その場で立てた小さなサーバから配る。
// 配信物（public/）には何も置かないし、残さない。
// 実際の素材が届いたら public/salon/hero.mp4 に置き、site.json の
// heroVideo を /salon/hero.mp4 にするだけで同じ道が通る。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian', secret: 'test-admin-secret', 'app-root': '.' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;
const ROOT = path.resolve(args['app-root']);
const CLIP_MP4 = path.join(ROOT, 'tests/fixtures/hero-motion-test.mp4');
const CLIP_WEBM = path.join(ROOT, 'tests/fixtures/hero-motion-test.webm');
const CLIP_PORT = Number(args['clip-port'] || 54997);
const VIDEO_URL = `http://127.0.0.1:${CLIP_PORT}/hero.mp4`;
const VIDEO_WEBM_URL = `http://127.0.0.1:${CLIP_PORT}/hero.webm`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

for (const f of [CLIP_MP4, CLIP_WEBM]) {
  if (!fs.existsSync(f)) { console.error(`試験用の映像がありません: ${f}`); process.exit(1); }
}

const read = async () => (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=blocks_json,published_html`)).json())[0];
const before = await read();

/* ヒーローに「動く背景」を設定して、公開HTMLを作り直す */
{
  const b = JSON.parse(JSON.stringify(before.blocks_json));
  const hero = b.pages[0].blocks.find(x => x.type === 'hero');
  if (!hero) { console.error('最初の画面のブロックが見つかりません'); process.exit(1); }
  hero.data.heroVideo = VIDEO_URL;
  hero.data.heroVideoWebm = VIDEO_WEBM_URL;
  await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ blocks_json: b }),
  });
  const r = await fetch(`${BASE}/api/admin/republish-all`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${args.secret}` },
    body: JSON.stringify({ onlyOutdated: false, slug: args.slug }),
  });
  check('動く背景を設定して公開し直せる', r.ok, `HTTP ${r.status}`);
}

/* ── 1. 配られるHTMLそのもの ── */
{
  const html = await (await fetch(`${BASE}/hp/${args.slug}`)).text();
  check('HTMLに <video> を置いていない（最初の表示を待たせない）', !/<video[\s>]/i.test(html));
  check('動画のURLは data 属性で持つだけ', html.includes(`data-src="${VIDEO_URL}"`) && html.includes(`data-src-webm="${VIDEO_WEBM_URL}"`));
  check('写真（poster）は最初から入っている', /class="lhp-hero-img"/.test(html));
  check('先読みの指定を付けていない', !/rel="(preload|prefetch)"[^>]*hero\.mp4/.test(html));
  check('止めるボタンは、最初は隠してある', /data-lhp-vtoggle[^>]*hidden/.test(html));
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const BLOCK = /fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/;

/* 試験用の映像を配る小さなサーバ。
   動画は範囲指定（Range）で取りに来るので、206 と Content-Range を返す。
   これを返さないと、ブラウザは読み込みを進めない。 */
const CLIPS = { '/hero.mp4': { body: fs.readFileSync(CLIP_MP4), type: 'video/mp4' },
                '/hero.webm': { body: fs.readFileSync(CLIP_WEBM), type: 'video/webm' } };
let asksTotal = 0;
const clipServer = http.createServer((req, res) => {
  asksTotal++;
  const hit = CLIPS[(req.url || '').split('?')[0]];
  if (!hit) { res.writeHead(404); res.end(); return; }
  const clip = hit.body;
  const range = req.headers.range;
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m) {
    const start = m[1] ? Number(m[1]) : 0;
    const end = m[2] ? Number(m[2]) : clip.length - 1;
    res.writeHead(206, {
      'content-type': hit.type, 'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${clip.length}`,
      'content-length': String(end - start + 1),
    });
    res.end(clip.subarray(start, end + 1));
    return;
  }
  res.writeHead(200, { 'content-type': hit.type, 'accept-ranges': 'bytes', 'content-length': String(clip.length) });
  res.end(clip);
});
await new Promise(r => clipServer.listen(CLIP_PORT, '127.0.0.1', r));

async function open({ reduced = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'ja-JP',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.route(BLOCK, r => r.abort());
  const asked = [];
  const page = await ctx.newPage();
  page.on('request', r => { if (r.url().startsWith(`http://127.0.0.1:${CLIP_PORT}/`)) asked.push(r.url()); });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  return { ctx, page, asked, errs };
}

/* ── 2. ふつうの端末 ── */
{
  const { ctx, page, asked, errs } = await open();
  await page.goto(`${BASE}/hp/${args.slug}`, { waitUntil: 'load' });

  // 写真が先に出ていること（動画が出る前の時点で）
  const posterReady = await page.locator('.lhp-hero-img').first().evaluate(el => el.complete && el.naturalWidth > 0);
  check('写真が先に出る', posterReady);

  await page.waitForTimeout(2500);
  check('動画を取りに行った', asked.length >= 1, `${asked.length}回`);
  check('軽い形式（webm）を先に選ぶ', asked.every(u => u.endsWith('hero.webm')), asked.map(u => u.split('/').pop()).join(' / '));

  const v = await page.locator('.lhp-hero-media video').first();
  check('動画が作られた', (await v.count()) === 1);
  const state = await v.evaluate(el => ({
    muted: el.muted, loop: el.loop, inline: el.hasAttribute('playsinline'),
    paused: el.paused, hidden: el.getAttribute('aria-hidden'),
  }));
  check('音は出さない', state.muted === true);
  check('繰り返す', state.loop === true);
  check('画面の中で再生する（全画面にしない）', state.inline === true);
  check('読み上げの対象にしない', state.hidden === 'true');
  check('再生が始まっている', state.paused === false);

  const btn = page.locator('[data-lhp-vtoggle]');
  check('止めるボタンが出る', await btn.isVisible());
  await btn.click();
  await page.waitForTimeout(300);
  check('押すと止まる', await v.evaluate(el => el.paused) === true);
  check('ボタンの文言が「再生」に変わる', (await btn.innerText()).includes('再生'));
  check('読み上げ用の説明も変わる', (await btn.getAttribute('aria-label') || '').includes('再生'));
  await btn.click();
  await page.waitForTimeout(300);
  check('もう一度押すと動き出す', await v.evaluate(el => el.paused) === false);

  check('指で押せる大きさ', await btn.evaluate(el => el.getBoundingClientRect().height) >= 32);
  check('画面の例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 3. 「動きを減らす」設定の端末 ── */
{
  const { ctx, page, asked, errs } = await open({ reduced: true });
  await page.goto(`${BASE}/hp/${args.slug}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  check('動きを減らす設定では、動画を取りに行かない', asked.length === 0, `${asked.length}回`);
  check('動きを減らす設定では、動画を作らない', (await page.locator('.lhp-hero-media video').count()) === 0);
  check('動きを減らす設定でも、写真は出る', await page.locator('.lhp-hero-img').first().evaluate(el => el.complete && el.naturalWidth > 0));
  check('動きを減らす設定では、止めるボタンも出さない', !(await page.locator('[data-lhp-vtoggle]').isVisible()));
  check('画面の例外が出ていない（動きを減らす）', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 4. 動画が落とせないとき（素材が届く前のいまの状態） ── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
  await ctx.route(BLOCK, r => r.abort());
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await ctx.route(new RegExp(`127\\.0\\.0\\.1:${CLIP_PORT}`), r => r.abort());   // 落とせない状態にする
  await page.goto(`${BASE}/hp/${args.slug}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  check('落とせなくても、写真のままで崩れない', await page.locator('.lhp-hero-img').first().evaluate(el => el.complete && el.naturalWidth > 0));
  check('落とせないときは、止めるボタンを出さない', !(await page.locator('[data-lhp-vtoggle]').isVisible()));
  check('画面の例外が出ていない（動画が無い）', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

await browser.close();
clipServer.close();
void asksTotal;

/* 元に戻す */
await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ blocks_json: before.blocks_json, published_html: before.published_html }),
});

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('動く背景（写真が先・音なし・止められる・動きを減らす設定では読まない）を確認しました');
