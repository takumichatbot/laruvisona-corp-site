// フォント配布の比較を、同じ内容・同じ条件で実測する。
//
//   node docs/font-measurement/measure.mjs --variant now --port 3200 --runs 3 \
//     --brand-fonts ./public/fonts --customer-css ./tmp/customer.css --out ./tmp/measure
//
// 引数（すべて省略可。既定値は下の DEFAULTS）:
//   --variant       この計測につける名前（now / b など）。出力先の名前にもなる
//   --port          next start が待ち受けているポート
//   --runs          同じ条件で何回測るか。表に出すのは中央値
//   --brand-fonts   会社のブランド書体の woff2 が入っているディレクトリ。
//                   fonts.gstatic.com への要求にこの中のファイルを返す
//   --customer-css  顧客が選んだ書体の CSS。
//                   fonts.googleapis.com への要求にこの中身を返す
//   --out           出力先ディレクトリ
//   --playwright-from  playwright の解決基点（グローバル導入のとき）
//
// 前提: この計測は「顧客が選んだ書体は読み込む」条件で行う。
//       必要な資産の作り方は docs/font-comparison-2026-09-10.md の
//       「必要な資産」を参照。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  variant: 'now',
  port: '3200',
  runs: '3',
  'brand-fonts': './public/fonts',
  'customer-css': './tmp/customer-font.css',
  out: './tmp/measure',
  'playwright-from': '',
};

function parseArgs(argv) {
  const out = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (!(k in DEFAULTS)) throw new Error(`知らない引数です: ${a}`);
    out[k] = argv[++i];
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));

const VARIANT = args.variant;
const PORT = args.port;
const RUNS = Number(args.runs);
const FONT_DIR = path.resolve(args['brand-fonts']);
const CUSTOMER_CSS_PATH = path.resolve(args['customer-css']);
const OUT = path.resolve(args.out, VARIANT);

for (const [label, p] of [['--brand-fonts', FONT_DIR], ['--customer-css', CUSTOMER_CSS_PATH]]) {
  if (!fs.existsSync(p)) {
    console.error(`${label} が見つかりません: ${p}`);
    console.error('docs/font-comparison-2026-09-10.md の「必要な資産」を参照してください。');
    process.exit(2);
  }
}
fs.mkdirSync(OUT, { recursive: true });

// playwright はプロジェクト内でもグローバルでも動くようにする
const require = createRequire(args['playwright-from']
  ? path.resolve(args['playwright-from']) + '/'
  : import.meta.url);
const { chromium } = require('playwright');

const CUSTOMER_CSS = fs.readFileSync(CUSTOMER_CSS_PATH);

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
      // 毎回まっさらな context（キャッシュ空・ストレージ空）で開く
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dsf,
        userAgent: vp.key === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : undefined,
        locale: 'ja-JP',
      });

      // 顧客が選んだ書体（Google Fonts）を、同じ実ファイルで返す。
      // timing-allow-origin を付けないと計測から漏れる。
      await ctx.route(/fonts\.googleapis\.com/, route => route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/css; charset=utf-8', 'timing-allow-origin': '*', 'access-control-allow-origin': '*' },
        body: CUSTOMER_CSS,
      }));
      await ctx.route(/fonts\.gstatic\.com/, route => {
        const file = path.basename(new URL(route.request().url()).pathname);
        const p = path.join(FONT_DIR, file);
        if (!fs.existsSync(p)) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({
          status: 200,
          headers: { 'content-type': 'font/woff2', 'timing-allow-origin': '*', 'access-control-allow-origin': '*' },
          body: fs.readFileSync(p),
        });
      });
      // 届かない外部は明示的に遮断して、案ごとの待ち時間の差をなくす
      await ctx.route(/larubot\.tokyo|cdnjs\.cloudflare\.com|googletagmanager\.com|clarity\.ms/, r => r.abort());

      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, downloadThroughput: 1500 * 1024, uploadThroughput: 750 * 1024, latency: 70,
      });

      // 転送量はブラウザ自身の集計（encodedDataLength）で数える。
      // Resource Timing は別オリジンの一部を数え落とす。
      const wire = new Map();
      cdp.on('Network.requestWillBeSent', e => wire.set(e.requestId, { url: e.request.url, bytes: 0 }));
      cdp.on('Network.loadingFinished', e => {
        const w = wire.get(e.requestId);
        if (w) w.bytes = e.encodedDataLength || 0;
      });
      cdp.on('Network.loadingFailed', e => { wire.delete(e.requestId); });

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

      const view = await page.evaluate(() => {
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

      // ── 集計 ──
      // 1リクエストは必ず1つの区分にだけ入れる。
      // appFontCss は css の「内訳」であって、合計には css として一度だけ入る
      // （別枠でも足すと二重計上になる。2026-09-10 の初回集計はこれで
      //  各ページを約101KB多く数えていた）。
      const navUrl = `http://127.0.0.1:${PORT}${pg.path}`;
      const b = { appFont: 0, customerFont: 0, customerFontCss: 0, css: 0, js: 0, img: 0, other: 0 };
      let html = 0, appFontFiles = 0, customerFontFiles = 0, appFontCss = 0;

      for (const w of wire.values()) {
        const name = w.url, bytes = w.bytes || 0;
        if (name === navUrl) { html += bytes; continue; }
        const isCustomer = /fonts\.gstatic\.com|fonts\.googleapis\.com/.test(name);
        if (isCustomer) {
          if (/\.woff2?(\?|$)/.test(name)) { b.customerFont += bytes; customerFontFiles++; }
          else { b.customerFontCss += bytes; }
        } else if (/\.woff2?(\?|$)/.test(name)) {
          b.appFont += bytes; appFontFiles++;
        } else if (/\.css(\?|$)/.test(name)) {
          b.css += bytes;
          if (/\/fonts\/(noto|space)\.css/.test(name)) appFontCss += bytes;   // css の内訳
        } else if (/\.m?js(\?|$)/.test(name)) b.js += bytes;
        else if (/\.(png|jpe?g|webp|avif|svg|gif|mp4|webm)(\?|$)/.test(name)) b.img += bytes;
        else b.other += bytes;
      }
      const total = html + b.appFont + b.customerFont + b.customerFontCss + b.css + b.js + b.img + b.other;

      if (run === 1) await page.screenshot({ path: `${OUT}/${pg.key}-${vp.key}.png` });

      samples.push({
        variant: VARIANT, page: pg.key, label: pg.label, viewport: vp.key, run,
        total, html,
        appFont: b.appFont, appFontFiles, appFontCss,
        customerFont: b.customerFont, customerFontFiles, customerFontCss: b.customerFontCss,
        css: b.css, js: b.js, img: b.img, other: b.other,
        lcp: Math.round(view.lcp), cls: Number(view.cls.toFixed(4)),
        h1Font: view.h1Font, bodyFont: view.bodyFont, loadedFaces: view.loadedFaces,
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
for (const arr of groups.values()) {
  const f = arr[0];
  summary.push({
    variant: VARIANT, page: f.page, label: f.label, viewport: f.viewport, runs: arr.length,
    total: median(arr.map(x => x.total)),
    appFont: median(arr.map(x => x.appFont)), appFontFiles: f.appFontFiles,
    appFontCss: median(arr.map(x => x.appFontCss)),
    customerFont: median(arr.map(x => x.customerFont)), customerFontFiles: f.customerFontFiles,
    customerFontCss: median(arr.map(x => x.customerFontCss)),
    css: median(arr.map(x => x.css)), js: median(arr.map(x => x.js)),
    lcp: median(arr.map(x => x.lcp)), lcpAll: arr.map(x => x.lcp),
    cls: median(arr.map(x => x.cls)), clsAll: arr.map(x => x.cls),
    h1Font: f.h1Font, bodyFont: f.bodyFont, loadedFaces: f.loadedFaces,
  });
}

const meta = {
  variant: VARIANT,
  measuredAt: new Date().toISOString(),
  runs: RUNS,
  cache: '毎回まっさらな browser context（キャッシュ空・ストレージ空・Service Workerなし）。すべて初回訪問',
  network: 'CDPで固定: 下り1500KB/s（約12Mbps）／上り750KB/s／遅延70ms',
  bytes: 'CDP Network.loadingFinished の encodedDataLength。1リクエストを1区分にだけ数える',
  note: 'appFontCss は css の内訳。合計には css として一度だけ含む',
  assets: { brandFonts: FONT_DIR, customerCss: CUSTOMER_CSS_PATH },
};
fs.writeFileSync(`${OUT}/samples.json`, JSON.stringify({ ...meta, rows: samples }, null, 2));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ ...meta, rows: summary }, null, 2));

const kb = n => String(Math.round(n / 1024)).padStart(5);
for (const r of summary) {
  console.log(`${r.variant.padEnd(4)} ${r.viewport.padEnd(6)} ${r.label.padEnd(6)} 合計${kb(r.total)}KB  会社${kb(r.appFont)}KB(${r.appFontFiles})+CSS${kb(r.appFontCss)}KB  顧客${kb(r.customerFont)}KB(${r.customerFontFiles})+CSS${kb(r.customerFontCss)}KB  LCP${String(r.lcp).padStart(5)}ms  CLS${r.cls}`);
}
console.log(`\n出力: ${OUT}`);
