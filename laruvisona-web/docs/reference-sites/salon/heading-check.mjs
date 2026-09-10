// ヒーロー見出しが、意味の切れ目で折り返しているかを実測する。
//
//   node docs/reference-sites/salon/heading-check.mjs --url http://127.0.0.1:3300/hp/yuian
//
// 「どう見えるか」ではなく、1行目と2行目に実際に何の文字が入ったかを、
// 文字ごとの座標から数えて出す。390px と 1440px の両方で見る。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';

const args = { url: 'http://127.0.0.1:3300/hp/yuian', 'font-css': '/tmp/salon/mincho.css', 'font-dir': '/tmp/fonts/out/fonts' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const b = await chromium.launch();
for (const [label, vp, dpr] of [['PC 1440px', { width: 1440, height: 900 }, 1], ['スマホ 390px', { width: 390, height: 844 }, 2]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, locale: 'ja-JP' });
  if (fs.existsSync(args['font-css'])) {
    await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: fs.readFileSync(args['font-css']) }));
    await ctx.route(/fonts\.gstatic\.com/, r => {
      const p = args['font-dir'] + '/' + r.request().url().split('/').pop();
      return fs.existsSync(p) ? r.fulfill({ status: 200, headers: { 'content-type': 'font/woff2' }, body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' });
    });
  }
  await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(args.url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const h = document.querySelector('.lhp-hero h1');
    // 文字ごとの上端を見て、行ごとにまとめる
    const lines = [];
    let cur = '', prev = null;
    const walk = node => {
      if (node.nodeType === 3) {
        const r = document.createRange();
        for (let i = 0; i < node.data.length; i++) {
          r.setStart(node, i); r.setEnd(node, i + 1);
          const top = r.getBoundingClientRect().top;
          if (prev !== null && Math.abs(top - prev) > 2) { lines.push(cur); cur = ''; }
          cur += node.data[i]; prev = top;
        }
      } else if (node.nodeName === 'BR') {
        lines.push(cur); cur = ''; prev = null;
      } else { node.childNodes.forEach(walk); }
    };
    h.childNodes.forEach(walk);
    lines.push(cur);
    const cs = getComputedStyle(h);
    const box = h.getBoundingClientRect();
    return { lines, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, width: Math.round(box.width), overflow: Math.round(h.scrollWidth - h.clientWidth) };
  });
  console.log(`--- ${label}  文字 ${info.fontSize} / 字間 ${info.letterSpacing} / 行送り ${info.lineHeight} / 欄の幅 ${info.width}px`);
  info.lines.forEach((l, i) => console.log(`    ${i + 1}行目: 「${l}」`));
  check(`${label}: 2行に収まっている`, info.lines.length === 2, `${info.lines.length}行`);
  check(`${label}: 意味の切れ目で折り返している`, info.lines[0] === '朝、鏡の前で' && info.lines[1] === 'うまくいく髪を。');
  check(`${label}: 横にはみ出していない`, info.overflow <= 0, `${info.overflow}px`);
  await ctx.close();
}
await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('見出しの折り返しを 390px と 1440px で確認しました');
