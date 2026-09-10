// 自社の2ページ（会社トップ・LARU HP 案内）を、実際のブラウザで見る。
//
//   node tests/browser/pages-check.mjs --port 3300
//
// 見るのは、読む人が困る形になっていないか。
//   ・最初の画面で「何を出しているか」「誰のどの困りごとか」が言葉になっているか
//   ・横に食み出していないか（390px / 1440px）
//   ・押すところが指で届く大きさか
//   ・出している画面写真が、実在するファイルとして返るか
//   ・画面の例外が出ていないか
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');

const args = { port: '3300' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const browser = await chromium.launch();

const PAGES = [
  {
    path: '/', label: '会社トップ',
    mustSay: ['ホームページ', '受託開発', '相談'],
    firstScreen: ['手が足りないところに', '相談する'],
  },
  {
    path: '/laruHP', label: 'LARU HP 案内',
    mustSay: ['1枚のサイトになる', '作りはじめる'],
    firstScreen: ['作りはじめる'],
  },
];

for (const spec of PAGES) {
  for (const [label, vw, vh] of [['パソコン', 1440, 900], ['スマホ', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, locale: 'ja-JP', deviceScaleFactor: vw < 700 ? 3 : 1 });
    await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
    const page = await ctx.newPage();
    const errs = [], bad = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).origin === BASE) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });

    await page.goto(BASE + spec.path, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);

    const tag = `${spec.label}（${label}）`;

    check(`${tag}: 横に食み出していない`,
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      await page.evaluate(() => `${document.documentElement.scrollWidth} / ${document.documentElement.clientWidth}`));

    const text = await page.evaluate(() => document.body.innerText);
    const missing = spec.mustSay.filter(w => !text.includes(w));
    check(`${tag}: 出しているものが言葉になっている`, missing.length === 0, missing.join(' / '));

    if (label === 'スマホ') {
      const above = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('h1, a, button').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.height > 0) out.push((el.textContent || '').trim().slice(0, 24));
        });
        return out.join(' | ');
      });
      const shown = spec.firstScreen.filter(w => above.includes(w));
      check(`${tag}: 最初の画面に入口がある`, shown.length === spec.firstScreen.length, above.slice(0, 90));

      const small = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('a, button').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.height < 34) bad.push((el.textContent || '').trim().slice(0, 16));
        });
        return bad;
      });
      check(`${tag}: 押すところが指で届く`, small.length === 0, small.slice(0, 4).join(' / '));
    }

    check(`${tag}: 返らなかったものが無い`, bad.length === 0, [...new Set(bad)].slice(0, 4).join(' / '));
    check(`${tag}: 画面の例外が出ていない`, errs.length === 0, errs.slice(0, 2).join(' / '));

    await ctx.close();
  }
}

/* 会社トップの「同じ形のカードの連続」をやめたこと */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);

  // 同じ見た目の枠が3つ以上続く並びが残っていないか
  const runs = await page.evaluate(() => {
    const key = (el) => {
      const s = getComputedStyle(el);
      return [s.borderRadius, s.borderTopWidth, s.backgroundColor, s.padding].join('|');
    };
    let worst = 0;
    document.querySelectorAll('div, ul, ol').forEach(parent => {
      const kids = [...parent.children].filter(c => c.getBoundingClientRect().height > 40);
      if (kids.length < 3) return;
      const boxed = kids.filter(c => {
        const s = getComputedStyle(c);
        return parseFloat(s.borderRadius) >= 12 && parseFloat(s.borderTopWidth) > 0;
      });
      if (boxed.length >= 3 && new Set(boxed.map(key)).size === 1) worst = Math.max(worst, boxed.length);
    });
    return worst;
  });
  check('会社トップ: 同じ枠のカードが3つ以上並んでいない', runs === 0, `${runs}個の並びが残っている`);

  // 実際に動かして撮った画面が、大きく出ているか
  const shot = await page.evaluate(() => {
    const img = [...document.querySelectorAll('img')].find(i => /work-salon-pc/.test(i.currentSrc || i.src));
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { w: Math.round(r.width), natural: img.naturalWidth };
  });
  check('会社トップ: 作った画面を大きく見せている', !!shot && shot.w >= 400, shot ? `${shot.w}px` : '見つからない');
  check('会社トップ: その画像が実在する', !!shot && shot.natural > 0, shot ? `naturalWidth=${shot.natural}` : '-');
  await ctx.close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('自社の2ページを確認しました');
