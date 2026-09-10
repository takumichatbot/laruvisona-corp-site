// フォント配布の比較を、同じ内容・同じ条件で実測する。
//
// 比較するのは2つだけ:
//   now … 現状。共通レイアウトが全ページに日本語Webフォントを配る
//   b   … 採用実装。ブランドを見せる画面だけが読み込む
// どちらも「顧客が選んだ書体」は読み込む（顧客サイトのみ）。
//
// 顧客が選んだ書体は Google Fonts から読まれる。計測環境から
// fonts.googleapis.com / fonts.gstatic.com へは出られないので、
// 本番ビルドで生成された同じ実ファイル（Noto Sans JP の woff2 と
// unicode-range 付き @font-face）をローカルから返す。
// CSSは gzip して返す（Googleも圧縮して配るため）。
//   ※ 本番は 400;500;700;900 の4ウェイト。手元にあるのは 400/500/700 の
//     3ウェイトなので、顧客書体の分は実際よりやや小さく出る。
//
// 外部ホスト（LARUbot・CDN）は両案とも遮断して条件を揃える。
import { createRequire } from 'node:module';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const VARIANT = process.argv[2];
const PORT = process.argv[3] || '3200';
const RUNS = Number(process.argv[4] || 3);
const OUT = `/tmp/measure2/${VARIANT}`;
fs.mkdirSync(OUT, { recursive: true });

const CUSTOMER_CSS_RAW = fs.readFileSync('/tmp/fonts/customer-noto.css');
const CUSTOMER_CSS = CUSTOMER_CSS_RAW;
const CUSTOMER_CSS_GZ_LEN = zlib.gzipSync(CUSTOMER_CSS_RAW).length;
const FONT_DIR = '/tmp/fonts/out/fonts';

const PAGES = [
  { key: 'hp',  path: '/hp/site-a', label: '顧客サイト' },
  { key: 'top', path: '/',          label: '会社トップ' },
  { key: 'lp',  path: '/lp-next',   label: '新LP' },
];
const VIEWPORTS = [
  { key: 'pc',     width: 1440, height: 900, dsf: 1 },
  { key: 'mobile', width: 390,  height: 844, dsf: 2 },
];

const browser = await chromium.launch();
const samples = [];

for (const vp of VIEWPORTS) {
  for (const pg of PAGES) {
    for (let run = 1; run <= RUNS; run++) {
      // 毎回まっさらな context（空のキャッシュ・空のストレージ）で開く
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf,
        userAgent: vp.key === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : undefined,
        locale: 'ja-JP',
      });

      // 顧客が選んだ書体（Google Fonts）を、同じ実ファイルで返す
      await ctx.route(/fonts\.googleapis\.com/, route =>
        route.fulfill({ status: 200, headers: { 'content-type': 'text/css; charset=utf-8', 'timing-allow-origin': '*', 'access-control-allow-origin': '*' }, body: CUSTOMER_CSS }));
      await ctx.route(/fonts\.gstatic\.com/, route => {
        const file = path.basename(new URL(route.request().url()).pathname);
        const p = path.join(FONT_DIR, file);
        if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, headers: { 'content-type': 'font/woff2', 'timing-allow-origin': '*', 'access-control-allow-origin': '*' }, body: fs.readFileSync(p) });
      });
      // 両案で条件を揃えるため、届かない外部は明示的に遮断する
      await ctx.route(/larubot\.tokyo/, r => r.abort());
      await ctx.route(/cdnjs\.cloudflare\.com/, r => r.abort());
      await ctx.route(/googletagmanager\.com/, r => r.abort());
      await ctx.route(/clarity\.ms/, r => r.abort());

      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');

      // 転送量はブラウザ自身の集計（CDPのencodedDataLength）で数える。
      // Resource Timing は別オリジンの一部を数えないため、
      // 顧客が選んだ書体（fonts.gstatic.com）が0件に見えてしまう。
      const wire = new Map();   // requestId -> { url, bytes }
      cdp.on('Network.requestWillBeSent', e => wire.set(e.requestId, { url: e.request.url, bytes: 0 }));
      cdp.on('Network.loadingFinished', e => {
        const w = wire.get(e.requestId);
        if (w) w.bytes = e.encodedDataLength || 0;
      });
      cdp.on('Network.loadingFailed', e => { wire.delete(e.requestId); });
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, downloadThroughput: 1500 * 1024, uploadThroughput: 750 * 1024, latency: 70,
      });
      await page.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0;
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
          .observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(l => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });

      await page.goto(`http://127.0.0.1:${PORT}${pg.path}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(3500);

      const data = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const loaded = {};
        for (const f of document.fonts) if (f.status === 'loaded') loaded[f.family] = (loaded[f.family] || 0) + 1;
        return {
          lcp: window.__lcp, cls: window.__cls,
          h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
          bodyFont: getComputedStyle(document.body).fontFamily,
          loadedFaces: loaded,
        };
      });
      const resources = [...wire.values()].map(w => ({ name: w.url, enc: w.bytes }));
      data.resources = resources;
      data.html = 0;   // HTML自身も resources に含まれる

      const b = { appFont: 0, customerFont: 0, appFontCss: 0, customerFontCss: 0, css: 0, js: 0, img: 0, other: 0 };
      let appFontFiles = 0, customerFontFiles = 0;
      const navUrl = `http://127.0.0.1:${PORT}${pg.path}`;
      for (const r of data.resources) {
        const bytes = r.enc || 0;
        if (r.name === navUrl) { data.html = bytes; continue; }
        const isCustomer = /fonts\.gstatic\.com|fonts\.googleapis\.com/.test(r.name);
        if (/\.woff2?(\?|$)/.test(r.name) || (isCustomer && /gstatic/.test(r.name))) {
          if (isCustomer) { b.customerFont += bytes; customerFontFiles++; }
          else { b.appFont += bytes; appFontFiles++; }
        } else if (isCustomer) {
          b.customerFontCss += bytes;
        } else if (/\.css(\?|$)/.test(r.name)) {
          b.css += bytes;
          if (/\/fonts\/(noto|space)\.css/.test(r.name)) b.appFontCss += bytes;
        } else if (/\.m?js(\?|$)/.test(r.name)) b.js += bytes;
        else if (/\.(png|jpe?g|webp|avif|svg|gif|mp4|webm)(\?|$)/.test(r.name)) b.img += bytes;
        else b.other += bytes;
      }
      const total = data.html + b.appFont + b.customerFont + b.appFontCss + b.customerFontCss + b.css + b.js + b.img + b.other;

      if (run === 1) {
        await page.screenshot({ path: `${OUT}/${pg.key}-${vp.key}.png` });
      }

      samples.push({
        variant: VARIANT, page: pg.key, label: pg.label, viewport: vp.key, run,
        total, html: data.html,
        appFont: b.appFont, appFontFiles, appFontCss: b.appFontCss,
        customerFont: b.customerFont, customerFontFiles, customerFontCss: b.customerFontCss,
        css: b.css, js: b.js, img: b.img, other: b.other,
        customerFontCssGzipRef: b.customerFontCss ? CUSTOMER_CSS_GZ_LEN : 0,
        lcp: Math.round(data.lcp), cls: Number(data.cls.toFixed(4)),
        h1Font: data.h1Font, bodyFont: data.bodyFont, loadedFaces: data.loadedFaces,
      });
      await ctx.close();
    }
  }
}
await browser.close();

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const groups = new Map();
for (const s of samples) {
  const k = `${s.page}|${s.viewport}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(s);
}
const summary = [];
for (const [k, arr] of groups) {
  const f = arr[0];
  summary.push({
    variant: VARIANT, page: f.page, label: f.label, viewport: f.viewport, runs: arr.length,
    total: median(arr.map(x => x.total)),
    appFont: median(arr.map(x => x.appFont)), appFontFiles: f.appFontFiles, appFontCss: median(arr.map(x => x.appFontCss)),
    customerFont: median(arr.map(x => x.customerFont)), customerFontFiles: f.customerFontFiles,
    customerFontCss: median(arr.map(x => x.customerFontCss)),
    css: median(arr.map(x => x.css)), js: median(arr.map(x => x.js)),
    customerFontCssGzipRef: f.customerFontCssGzipRef,
    lcp: median(arr.map(x => x.lcp)), lcpAll: arr.map(x => x.lcp),
    cls: median(arr.map(x => x.cls)), clsAll: arr.map(x => x.cls),
    h1Font: f.h1Font, bodyFont: f.bodyFont, loadedFaces: f.loadedFaces,
  });
}
fs.writeFileSync(`${OUT}/samples.json`, JSON.stringify(samples, null, 2));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
const kb = n => String(Math.round(n / 1024)).padStart(5);
for (const r of summary) {
  console.log(`${r.variant.padEnd(4)} ${r.viewport.padEnd(6)} ${r.label.padEnd(6)} 合計${kb(r.total)}KB  アプリ${kb(r.appFont)}KB(${r.appFontFiles})+CSS${kb(r.appFontCss)}KB  顧客${kb(r.customerFont)}KB(${r.customerFontFiles})+CSS${kb(r.customerFontCss)}KB  LCP${String(r.lcp).padStart(5)}ms  CLS${r.cls}`);
}
