// 案内ページの組立デモが「見えるまで」「触れるまで」を測る。
//
//   node docs/reference-sites/salon/demo-timing-check.mjs --url http://127.0.0.1:3300/laruHP --slow yes
//
// perf-check.mjs が測っているのは**親のページ**の初回表示（LCP）で、
// デモの中で写真が出た時刻や、触れるようになった時刻ではない。
// デモはページの主役なので、そこは別に記録する。
//
// 測る3つ:
//   1. 枠が置かれるまで（中身の作成が始まった時刻）
//   2. 中の写真が出るまで（画像が読み終わって描かれた時刻）
//   3. 触れるようになるまで（組み上がって、中の操作が効くようになった時刻）
//
// 測り方: 中の入れ物にも同じ計測用スクリプトを入れ、区切りごとに親へ知らせる。
// 時刻は**親の時計**で取る（入れ物の中の performance.now() は基準が別なので混ぜない）。
// 外から50msごとに覗く形だと、CPUを絞った条件では覗く動作そのものが重くなり、
// 3つの時刻が同じ値に丸まってしまう。
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');

const args = { url: 'http://127.0.0.1:3300/laruHP', runs: '3', slow: 'no', 'font-css': '', 'font-dir': '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }

const STAGE = '[title^="お店のサイトの見本"]';
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const fmt = (v) => (v === null || v === undefined ? '—' : `${(v / 1000).toFixed(2)}秒`);

const browser = await chromium.launch();
const out = [];

for (const [label, vp, dpr] of [
  ['PC 1440x900 dpr1', { width: 1440, height: 900 }, 1],
  ['スマホ 390x844 dpr2', { width: 390, height: 844 }, 2],
]) {
  const runs = [];
  for (let i = 0; i < Number(args.runs); i++) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, locale: 'ja-JP' });
    /* 顧客が選んだ書体（結い庵は明朝）を含めて測るとき。
       この環境は外へ出られないので、手元に取ってある同じCSS・同じwoff2を返す。
       指定しなければ、書体は落とさずに測る（比較のため両方取れる）。 */
    if (args['font-css'] && fs.existsSync(args['font-css'])) {
      await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: fs.readFileSync(args['font-css']) }));
      await ctx.route(/fonts\.gstatic\.com/, r => {
        const p = args['font-dir'] + '/' + r.request().url().split('/').pop();
        return fs.existsSync(p) ? r.fulfill({ status: 200, headers: { 'content-type': 'font/woff2' }, body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' });
      });
    } else {
      await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
    }
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
    const page = await ctx.newPage();
    if (args.slow === 'yes') {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150,
        downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.addInitScript(`
      (function () {
        if (window.top === window) {
          /* 親のページ側。区切りの知らせを受けて、親の時計で時刻を残す */
          window.__lcp = 0;
          new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
            .observe({ type: 'largest-contentful-paint', buffered: true });
          window.__probe = {};
          var mark = function (k) { if (!(k in window.__probe)) window.__probe[k] = performance.now(); };
          window.addEventListener('message', function (e) {
            var d = e.data;
            if (d && typeof d.__probe === 'string') mark(d.__probe);
          });
          var watch = function () {
            var f = document.querySelector('[title^="お店のサイトの見本"]');
            if (f && f.getAttribute('srcdoc')) { mark('mounted'); return; }
            requestAnimationFrame(watch);
          };
          requestAnimationFrame(watch);
        } else {
          /* 見本の入れ物の中。区切りに来たら、親へ知らせるだけ */
          var sent = {};
          var send = function (k) {
            if (sent[k]) return;
            sent[k] = 1;
            try { parent.postMessage({ __probe: k }, '*'); } catch (e) {}
          };
          var tick = function () {
            var img = document.querySelector('.lhp-hero img');
            if (img && img.complete && img.naturalWidth > 0) send('photo');
            if (document.documentElement.getAttribute('data-locked') === '0') send('interactive');
            if (!(sent.photo && sent.interactive)) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      })();
    `);

    await page.goto(args.url, { waitUntil: 'commit' });

    const deadline = Date.now() + 30000;
    let t = { mounted: null, photo: null, interactive: null };
    while (Date.now() < deadline) {
      const p = await page.evaluate(() => window.__probe || {}).catch(() => ({}));
      t = { mounted: p.mounted ?? null, photo: p.photo ?? null, interactive: p.interactive ?? null };
      if (t.mounted !== null && t.photo !== null && t.interactive !== null) break;
      await page.waitForTimeout(120);
    }

    const lcp = await page.evaluate(() => window.__lcp).catch(() => 0);
    runs.push({ ...t, lcp });
    await ctx.close();
  }

  out.push({
    label,
    lcp: median(runs.map(r => r.lcp)),
    mounted: median(runs.map(r => r.mounted ?? Infinity)),
    photo: median(runs.map(r => r.photo ?? Infinity)),
    interactive: median(runs.map(r => r.interactive ?? Infinity)),
    runs,
  });
}

await browser.close();

console.log(`対象: ${args.url}`);
console.log(`条件: ${args.slow === 'yes' ? '回線・CPUの遅延あり（1.6Mbps・150ms・CPU 1/4）' : '遅延なし'} / ${args.runs}回の中央値 / 外部計測タグ遮断 / 顧客の選択書体は${args['font-css'] ? '含む' : '含まない'}`);
console.log('');
for (const r of out) {
  console.log(`■ ${r.label}`);
  console.log(`  親ページの初回表示（LCP）      ${fmt(r.lcp)}`);
  console.log(`  デモの枠が置かれるまで          ${fmt(r.mounted)}`);
  console.log(`  デモの写真が出るまで            ${fmt(r.photo)}`);
  console.log(`  デモが触れるようになるまで      ${fmt(r.interactive)}`);
  console.log('');
}
console.log('※ 親ページのLCPは、デモの中の写真が出た時刻ではない。上の3つは別に測っている。');
