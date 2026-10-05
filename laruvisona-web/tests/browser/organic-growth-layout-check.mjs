// Organic Growth（2026-10-06）で触ったページの見え方：320/390/430・PC 1280 で横のはみ出し・押す場所の大きさ・H1 が見えるか。
// 前提: fixture 向けビルドが :3319（ホスト名を 127.0.0.1:3319 へ向けて開く）。
//   CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... [SHOTS=<保存先>] node tests/browser/organic-growth-layout-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const PAGES = [
  ['laruvisona.jp', '/services', '#services'],
  ['laruhp.com', '/', null],
  ['laruhp.com', '/plans', null],
  ['laruhp.com', '/construction', 'h2'],
  ['laruhp.com', '/articles/hp-mitsumori-mikata', null],
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--host-resolver-rules=MAP laruhp.com 127.0.0.1:3319, MAP laruvisona.jp 127.0.0.1:3319'] });
for (const [w, h] of [[320, 640], [390, 844], [430, 932], [1280, 800]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.route(/^https?:\/\/(?!laruhp\.com|laruvisona\.jp)/, (r) => r.abort());
  const p = await ctx.newPage();
  for (const [host, path] of PAGES) {
    const res = await p.goto(`http://${host}:80${path}`.replace(':80', ''), { waitUntil: 'load' });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const over = document.scrollingElement.scrollWidth - innerWidth;
      const h1 = document.querySelector('h1');
      const hb = h1?.getBoundingClientRect();
      // 今回足した・変えた所の押す場所（既存の文中リンク・パンくずは対象外）
      const block = (t) => [...document.querySelectorAll('h2, h3')].find((x) => x.textContent.includes(t))?.parentElement;
      const touched = [block('月額の自社サービスで済むご相談'), block('先に読んでおくと迷わないもの')].filter(Boolean);
      const small = touched.flatMap((b) => [...b.querySelectorAll('a')]).filter((a) => a.getBoundingClientRect().height < 44).map((a) => a.textContent.trim().slice(0, 14));
      const routes = touched.flatMap((b) => [...b.querySelectorAll('a')]).map((a) => Math.round(a.getBoundingClientRect().height));
      return { over, h1: !!h1, h1Visible: !!hb && hb.top < innerHeight * 1.5, small: small.slice(0, 6), routes };
    });
    const name = `${w}px ${host}${path}`;
    check(`${name}：200・横のはみ出しなし・H1 が最初の画面付近`, res.status() === 200 && r.over <= 1 && r.h1 && r.h1Visible, JSON.stringify(r));
    check(`${name}：今回変えた所の押す場所が 44px 以上`, r.small.length === 0, r.small.join('/'));
    if (path === '/services') check(`${name}：自社サービスへの行き先が押しやすい（44px 以上）`, r.routes.length === 4 && r.routes.every((x) => x >= 44), JSON.stringify(r.routes));
    if (SHOTS && (path === '/services' || path === '/construction')) {
      const sel = path === '/services' ? 'text=月額の自社サービスで済むご相談' : 'text=先に読んでおくと迷わないもの';
      await p.locator(sel).first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SHOTS}/${w}-${path.replace(/\//g, '_')}.png` });
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
