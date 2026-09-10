// 初回表示の速さと、読み込み中のズレを測る。
//
//   node docs/reference-sites/salon/perf-check.mjs --url http://127.0.0.1:3300/hp/yuian
//
// 測るのは LCP（大きい要素が出るまで）と CLS（読み込み中に画面がずれる量）。
// 条件は毎回そろえる: 毎回まっさらな状態（キャッシュ・保存領域なし）、
// 同じ画面サイズ、外部の計測タグは遮断、3回まわして中央値を出す。
// 回線とCPUの遅延は入れていない（入れる場合は --slow yes）。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';

const args = { url: 'http://127.0.0.1:3300/hp/yuian', runs: '3', slow: 'no', 'font-css': '', 'font-dir': '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }

const COLLECT = `
window.__lcp = 0; window.__cls = 0; window.__lcpEl = '';
new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = (e.element && (e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : ''))) || e.url || ''; } })
  .observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
  .observe({ type: 'layout-shift', buffered: true });
`;

const b = await chromium.launch();
const out = [];
for (const [label, vp, dpr, ua] of [
  ['PC 1440x900 dpr1', { width: 1440, height: 900 }, 1, undefined],
  ['スマホ 390x844 dpr2', { width: 390, height: 844 }, 2, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
]) {
  const runs = [];
  for (let i = 0; i < Number(args.runs); i++) {
    // 毎回まっさらな入れ物にする（前回の控えを使わせない）
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, userAgent: ua, locale: 'ja-JP' });
    if (args['font-css'] && fs.existsSync(args['font-css'])) {
      await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: fs.readFileSync(args['font-css']) }));
      await ctx.route(/fonts\.gstatic\.com/, r => {
        const p = args['font-dir'] + '/' + r.request().url().split('/').pop();
        return fs.existsSync(p) ? r.fulfill({ status: 200, headers: { 'content-type': 'font/woff2' }, body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' });
      });
    }
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
    const page = await ctx.newPage();
    await page.addInitScript(COLLECT);
    if (args.slow === 'yes') {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.goto(args.url, { waitUntil: 'load' });
    await page.waitForTimeout(2600);
    const m = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls, el: window.__lcpEl }));
    runs.push(m);
    await ctx.close();
  }
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const lcp = med(runs.map(r => r.lcp)), cls = med(runs.map(r => r.cls));
  out.push({ label, lcp, cls, el: runs[0].el, runs });
  console.log(`${label}`);
  console.log(`  LCP 中央値 ${(lcp / 1000).toFixed(2)}秒  （${runs.map(r => (r.lcp / 1000).toFixed(2)).join(' / ')}）  対象: ${runs[0].el}`);
  console.log(`  CLS 中央値 ${cls.toFixed(4)}  （${runs.map(r => r.cls.toFixed(4)).join(' / ')}）`);
}
await b.close();
const bad = out.filter(o => o.lcp > 2500 || o.cls > 0.1);
console.log(`\n目安: LCP 2.5秒以内 / CLS 0.1以下`);
console.log(bad.length ? `届いていない条件: ${bad.map(o => o.label).join(', ')}` : 'どちらも目安の内側です');
console.log(`測定条件: ローカルの隔離環境 / 毎回まっさらな入れ物 / 外部計測タグ遮断 / 回線・CPUの遅延${args.slow === 'yes' ? 'あり（1.6Mbps・150ms・CPU 1/4）' : 'なし'} / ${args.runs}回の中央値`);
