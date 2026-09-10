// ヒーロー画像が、実際にどれを・何バイト落としたかを測る。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
const URL_ = process.argv[2] || 'http://127.0.0.1:3300/hp/yuian';
const b = await chromium.launch();
for (const [label, vp, dpr, ua] of [
  ['PC 1440px dpr1', { width: 1440, height: 900 }, 1, undefined],
  ['スマホ 390px dpr2', { width: 390, height: 844 }, 2, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, userAgent: ua, locale: 'ja-JP' });
  await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
  const page = await ctx.newPage();
  const bytes = new Map();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', e => bytes.set(e.requestId, { url: e.request.url, n: 0 }));
  cdp.on('Network.loadingFinished', e => { const w = bytes.get(e.requestId); if (w) w.n = e.encodedDataLength || 0; });
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const img = await page.evaluate(() => {
    const i = document.querySelector('.lhp-hero-split-img img');
    return { src: i.currentSrc.split('/').pop(), w: i.clientWidth, h: i.clientHeight, nw: i.naturalWidth, nh: i.naturalHeight };
  });
  const hero = [...bytes.values()].filter(w => /\/salon\/hero/.test(w.url));
  console.log(`--- ${label}: 表示 ${img.w}x${img.h} / 実体 ${img.nw}x${img.nh} / 採用 ${img.src}`);
  for (const h of hero) console.log(`    ${h.url.split('/').pop()}  ${(h.n / 1024).toFixed(1)} KB`);
  console.log(`    ヒーロー合計 ${(hero.reduce((a, x) => a + x.n, 0) / 1024).toFixed(1)} KB / ページ合計 ${([...bytes.values()].reduce((a, x) => a + x.n, 0) / 1024).toFixed(0)} KB`);
  await ctx.close();
}
await b.close();
