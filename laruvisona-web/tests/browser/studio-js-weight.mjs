// 制作画面（Studio）で読み込む JS の量を、比較を開く前／初めて比較を開いたときに分けて測る。
//   実行: BASES=http://127.0.0.1:3319,http://127.0.0.1:3320 CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-js-weight.mjs
// 同じ fixture・同じ手順で、2つのビルド（変更前・変更後）を測る。
// 量は、読み込まれた JS のURLを記録し、そのビルドの .next/static にあるファイルの大きさ（そのまま／gzip）で数える
// （通信の計測値は同じ条件でも揺れたため）。DIRS は BASES と同じ順のビルドの場所。
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const CANVAS = 'iframe[title="できあがりの見え方"]';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const rows = [];
for (const base of (process.env.BASES || 'http://127.0.0.1:3319').split(',')) {
  for (const run of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
    await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
    await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    const reqs = new Map(); let phase = 'before';
    const scripts = { before: new Set(), compare: new Set() }; const attempts = { fontCss: 0, img: 0 };
    cdp.on('Network.requestWillBeSent', (e) => {
      if (/\/_next\/static\/.*\.js(\?|$)/.test(e.request.url)) scripts[phase].add(new URL(e.request.url).pathname);
    });
    // 比較の枠（srcdoc の iframe）の中の要求は、別プロセスになりページの CDP に出ないので、context 全体で数える
    ctx.on('request', (r) => {
      if (phase !== 'compare') return;
      if (/fonts\.googleapis\.com/.test(r.url())) attempts.fontCss++; else if (r.resourceType() === 'image') attempts.img++;
    });
    const tally = { before: { js: 0, jsFiles: 0, jsRaw: 0 }, compare: { js: 0, jsFiles: 0, jsRaw: 0, fontCss: 0, img: 0, other: 0 } };
    cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type, phase }));
    cdp.on('Network.loadingFinished', (e) => {
      const r = reqs.get(e.requestId); if (!r) return;
      const t = tally[r.phase];
      if (r.type === 'Script') { t.js += e.encodedDataLength; t.jsFiles++; }
      else if (r.phase === 'compare') { if (/fonts\.googleapis/.test(r.url)) t.fontCss++; else if (r.type === 'Image') t.img++; else t.other++; }
    });
    await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.removeItem('laruhp.studio.draft:new'); } catch {} });
    await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
    await p.getByLabel('店名・屋号', { exact: false }).first().fill('足立ホーム工房');
    await p.getByLabel('活動している地域', { exact: false }).first().fill('東京都足立区');
    await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
    await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
    await p.locator('.se-editor').waitFor();
    await p.frameLocator(CANVAS).locator('h1').waitFor();
    await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
    await p.locator('.de-editor').waitFor();
    await p.waitForLoadState('networkidle');
    const iframesBefore = await p.locator('iframe').count();
    phase = 'compare';
    const t0 = Date.now();
    await p.locator('.de-editor').getByRole('button', { name: /写真で惹きつける/ }).click();
    await p.locator('.dr-dialog').waitFor();
    await p.frameLocator('iframe[title^="採用前の"]').locator('h1').waitFor();  // 変更前は「採用前の構成案」
    const openMs = Date.now() - t0;
    await p.waitForTimeout(2500);
    const iframesOpen = await p.locator('iframe').count();
    const srcdocBytes = await p.evaluate(() => [...document.querySelectorAll('.dr-dialog iframe')].reduce((n, f) => n + (f.getAttribute('srcdoc') || '').length, 0));
    const dir = (process.env.DIRS || '').split(',')[(process.env.BASES || '').split(',').indexOf(base)] || '.';
    const size = (set) => [...set].reduce((a, f) => { const file = `${dir}/.next${f.replace(/^\/_next/, '')}`; if (!fs.existsSync(file)) return a; const b = fs.readFileSync(file); return { raw: a.raw + b.length, gz: a.gz + zlib.gzipSync(b).length, n: a.n + 1 }; }, { raw: 0, gz: 0, n: 0 });
    const sb = size(scripts.before), sc = size([...scripts.compare].filter((f) => !scripts.before.has(f)));
    rows.push({ base, run, disk_before: { files: sb.n, rawKB: +(sb.raw / 1024).toFixed(1), gzipKB: +(sb.gz / 1024).toFixed(1) }, disk_compareNew: { files: sc.n, rawKB: +(sc.raw / 1024).toFixed(1), gzipKB: +(sc.gz / 1024).toFixed(1) }, compareFontCssRequests: attempts.fontCss, compareImageRequests: attempts.img, beforeJsKB: +(tally.before.js / 1024).toFixed(1), beforeJsFiles: tally.before.jsFiles, compareJsKB: +(tally.compare.js / 1024).toFixed(1), compareJsFiles: tally.compare.jsFiles, compareFontCssReq: tally.compare.fontCss, compareImgReq: tally.compare.img, iframesBefore, iframesOpen, srcdocKB: +(srcdocBytes / 1024).toFixed(1), openToPreviewMs: openMs });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(rows, null, 1));
