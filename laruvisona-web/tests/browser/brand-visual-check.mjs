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

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log(video || poster
  ? '会社トップの主役ビジュアル（素材あり）を確認しました'
  : '会社トップの主役ビジュアル（素材が入る前の状態）を確認しました');
