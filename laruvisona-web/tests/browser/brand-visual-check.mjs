// 会社トップの主役ビジュアルが、決めたとおりに動くこと。
//
//   node tests/browser/brand-visual-check.mjs --port 3300
//
// 素材（静止画・動画）が入っているかどうかで、見るところが変わる。
//   ・入っていない（いまの状態）… その場で描く下地が出る。動画は取りに行かない
//   ・入っている            … 写真が先／音なし／画面の中で再生／止められる／
//                              端末が「動きを減らす」設定なら取りに行かない
//
// 素材を入れて確かめるときは、components/BrandVisual.tsx の BRAND_VISUAL に
// 置き場所を書いてビルドしてから実行する。
// 動画の確認だけしたい場合は --video で、その場で立てたサーバのURLを渡せる
// （その場合も BRAND_VISUAL にそのURLを入れてビルドしておく必要がある）。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const args = { port: '3300', 'app-root': '.' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

/* いま素材が入っているかを、部品の中身から読む */
const src = fs.readFileSync(path.join(path.resolve(args['app-root']), 'components/BrandVisual.tsx'), 'utf8');
const decl = src.slice(src.indexOf('export const BRAND_VISUAL'));
const poster = (decl.match(/poster:\s*'([^']*)'/) || [])[1] || '';
const video = (decl.match(/video:\s*'([^']*)'/) || [])[1] || '';
console.log(`素材の指定: poster=${poster || '（なし）'} / video=${video || '（なし）'}\n`);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const BLOCK = /fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/;

async function open(reduced) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 }, locale: 'ja-JP',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await ctx.route(BLOCK, r => r.abort());
  const page = await ctx.newPage();
  const asked = [];
  if (video) page.on('request', r => { if (r.url().includes(video.replace(/^https?:\/\//, '').split('/')[0]) && /\.(mp4|webm)/.test(r.url())) asked.push(r.url()); });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { ctx, page, asked, errs };
}

/* ── 1. ふつうの端末 ── */
{
  const { ctx, page, asked, errs } = await open(false);

  if (!poster && !video) {
    check('素材が無いときは、その場で描く下地が出る',
      (await page.locator('section [aria-hidden="true"] div').first().count()) > 0);
    check('素材が無いときは、動画を作らない', (await page.locator('section video').count()) === 0);
    check('素材が無くても、見出しとボタンは出る',
      (await page.locator('h1').isVisible()) && (await page.locator('a:has-text("相談する")').first().isVisible()));
  } else {
    if (poster) {
      check('写真が先に出る', await page.locator(`img[src="${poster}"]`).first().evaluate(el => el.complete && el.naturalWidth > 0));
    }
    if (video) {
      check('動画を取りに行く', asked.length >= 1, `${asked.length}回`);
      const v = page.locator('section video').first();
      check('動画が作られた', (await v.count()) === 1);
      const st = await v.evaluate(el => ({
        muted: el.muted, loop: el.loop, inline: el.hasAttribute('playsinline'),
        paused: el.paused, hasPoster: !!el.poster, hidden: el.getAttribute('aria-hidden'),
      }));
      check('音は出さない', st.muted === true);
      check('繰り返す', st.loop === true);
      check('画面の中で再生する（全画面にしない）', st.inline === true);
      check('写真を代替表示に持つ', st.hasPoster === true);
      check('読み上げの対象にしない', st.hidden === 'true');
      const btn = page.locator('button[aria-label*="背景の動き"]');
      check('止めるボタンが出る', await btn.isVisible());
      check('指で押せる大きさ', await btn.evaluate(el => el.getBoundingClientRect().height) >= 40);
      await btn.click(); await page.waitForTimeout(300);
      check('押すと止まる', await v.evaluate(el => el.paused) === true);
      await btn.click(); await page.waitForTimeout(300);
      check('もう一度押すと動き出す', await v.evaluate(el => el.paused) === false);
    }
  }

  if (poster && !video) {
    check('静止画だけの段階では、止めるボタンを出さない',
      (await page.locator('button[aria-label*="背景の動き"]').count()) === 0);
  }

  // 素材の有無にかかわらず、場所は先に取れている（読み込みで下がずれない）
  const box = await page.locator('section .aspect-\\[4\\/3\\], section .rounded-2xl').first()
    .evaluate(el => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })
    .catch(() => null);
  check('主役の場所が先に取られている', !!box && box.w > 100 && box.h > 100, box ? `${box.w}×${box.h}` : '取れない');
  check('画面の例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 2. 「動きを減らす」設定の端末 ── */
{
  const { ctx, page, asked, errs } = await open(true);
  check('動きを減らす設定では、動画を取りに行かない', asked.length === 0, `${asked.length}回`);
  check('動きを減らす設定では、動画を作らない', (await page.locator('section video').count()) === 0);
  if (poster) {
    check('動きを減らす設定でも、写真は出る',
      await page.locator(`img[src="${poster}"]`).first().evaluate(el => el.complete && el.naturalWidth > 0));
  }
  check('画面の例外が出ていない（動きを減らす）', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 3. 素材の見え方（静止画が入っているときだけ） ──
   「枠に小さな模型を置いただけ」になっていないか、
   画像の地とページの地に段差が出ていないかを、実際の画素で見る。 */
if (poster) {
  for (const view of [
    { name: 'パソコン', width: 1440, height: 900, wantRatio: 16 / 10, wantKey: 'hero-pc-' },
    { name: 'スマホ', width: 390, height: 844, wantRatio: 4 / 3, wantKey: 'hero-sp-' },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, locale: 'ja-JP', deviceScaleFactor: 1 });
    await ctx.route(BLOCK, r => r.abort());
    const page = await ctx.newPage();
    const got = [];
    page.on('response', r => { if (/\/brand\/hero-/.test(r.url())) got.push(r.url().split('/').pop()); });
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);

    const img = page.locator(`img[src="${poster}"]`).first();
    const info = await img.evaluate(el => ({
      current: el.currentSrc.split('/').pop(),
      natW: el.naturalWidth, natH: el.naturalHeight,
      boxW: Math.round(el.getBoundingClientRect().width),
      boxH: Math.round(el.getBoundingClientRect().height),
      fit: getComputedStyle(el).objectFit,
    }));
    check(`${view.name}：その画面用の切り抜きが選ばれている`, info.current.startsWith(view.wantKey), info.current);
    check(`${view.name}：軽い形式で配っている（原画PNGではない）`, /\.(avif|webp)$/.test(info.current), info.current);
    // 枠と画像の縦横比が同じなら、cover でも切り落としは起きない
    const boxRatio = info.boxW / info.boxH, imgRatio = info.natW / info.natH;
    check(`${view.name}：全面coverで重要部分を切っていない`,
      Math.abs(boxRatio - imgRatio) < 0.02 && Math.abs(boxRatio - view.wantRatio) < 0.02,
      `枠 ${boxRatio.toFixed(3)} / 画像 ${imgRatio.toFixed(3)}`);

    // 主役の大きさ。画像の中で、明るい面（模型）が占める幅を測る
    const subject = await img.evaluate(el => {
      const c = document.createElement('canvas');
      c.width = 240; c.height = Math.round(240 * el.naturalHeight / el.naturalWidth);
      const g = c.getContext('2d');
      g.drawImage(el, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if ((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 > 140) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return { w: (x1 - x0 + 1) / c.width, h: (y1 - y0 + 1) / c.height };
    });
    check(`${view.name}：主役が枠のなかで十分に大きい`, subject.w >= 0.78 && subject.h >= 0.7,
      `幅 ${(subject.w * 100).toFixed(0)}% × 高さ ${(subject.h * 100).toFixed(0)}%`);
    // 見出しと釣り合っているか（写真枠の中の小さな模型になっていないか）
    const h1w = await page.locator('h1').first().evaluate(el => Math.round(el.getBoundingClientRect().width));
    check(`${view.name}：見出しと釣り合う大きさで出ている`, info.boxW * subject.w >= h1w * 0.8,
      `主役 ${Math.round(info.boxW * subject.w)}px / 見出し ${h1w}px`);

    /* 画像の地とページの地の段差。
       画像の上辺をまたぐ帯を撮り、すぐ上（ページ）とすぐ下（画像）を比べる。
       スマホでは左右いっぱいに置くので、外側が残るのは上辺だけ。 */
    const seam = await page.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2) - 20, y: Math.round(r.top) };
    }, `img[src="${poster}"]`);
    const shot = await page.screenshot({ clip: { x: Math.max(0, seam.x), y: Math.max(0, seam.y - 8), width: 40, height: 16 } });
    const px = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const row = (y) => { const s = [0, 0, 0]; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } return s.map(v => Math.round(v / c.width)); };
      return { above: row(1), below: row(c.height - 2) };
    }, shot.toString('base64'));
    const diff = Math.max(...[0, 1, 2].map(i => Math.abs(px.above[i] - px.below[i])));
    check(`${view.name}：画像の地とページの地に段差が出ていない`, diff <= 6,
      `上 rgb(${px.above}) / 下 rgb(${px.below}) 差 ${diff}`);

    check(`${view.name}：必要な枚数だけ取りに行っている`, got.length <= 2, got.join(' / '));
    await ctx.close();
  }
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log(video || poster
  ? '会社トップの主役ビジュアル（素材あり）を確認しました'
  : '会社トップの主役ビジュアル（素材が入る前の状態）を確認しました');
