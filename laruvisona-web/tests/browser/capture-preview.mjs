// 提出用のプレビュー（画面と、操作の短い動画）を撮る。
//
//   node tests/browser/capture-preview.mjs --port 3300 --out /tmp/preview
//
// 撮るもの:
//   会社トップ   … パソコン／スマホの最初の画面（主役ビジュアルの入り方）
//   LARU HP 案内 … デモの初期状態／見せ方を選んだあと（パソコン・スマホ）
//   動画         … 選ぶ → 組み上がる → 予約まで試す、の一続き（パソコン・スマホ）
//
// 計測ではないので、回線とCPUの遅延は入れない（操作の見え方を撮るため）。
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');

const args = { port: '3300', out: '/tmp/preview', video: 'yes', shots: 'yes' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
mkdirSync(args.out, { recursive: true });

const BLOCK = /fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/;
const browser = await chromium.launch();
const VIEWS = [
  { key: 'pc', width: 1440, height: 900, dpr: 1 },
  { key: 'sp', width: 390, height: 844, dpr: 2 },
];

async function ctxFor(v, video) {
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, locale: 'ja-JP',
    hasTouch: v.width < 700,
    ...(video ? { recordVideo: { dir: `${args.out}/video-${v.key}`, size: { width: v.width, height: v.height } } } : {}),
  });
  await ctx.route(BLOCK, r => r.abort());
  return ctx;
}

/* ── 1. 会社トップ ── */
for (const v of (args.shots === 'yes' ? VIEWS : [])) {
  const ctx = await ctxFor(v, false);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${args.out}/top-${v.key}.png` });
  await ctx.close();
  console.log(`top-${v.key}.png`);
}

/* ── 2. LARU HP 案内：デモの初期状態と、選んだあと ── */
for (const v of (args.shots === 'yes' ? VIEWS : [])) {
  const ctx = await ctxFor(v, false);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/laruHP`, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  const demo = page.locator('[data-lhp-demo]');
  await demo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${args.out}/demo-${v.key}-1-initial.png` });
  const radios = page.locator('[role="radiogroup"] [role="radio"]');
  await radios.nth(2).click();          // やわらかい
  await page.waitForTimeout(260);
  await page.screenshot({ path: `${args.out}/demo-${v.key}-2-updating.png` });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${args.out}/demo-${v.key}-3-picked.png` });
  await radios.nth(1).click();          // 落ち着いた
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${args.out}/demo-${v.key}-4-picked2.png` });
  await page.locator('button:has-text("このお店の予約フォームまで試す")').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${args.out}/demo-${v.key}-5-booking.png` });
  await ctx.close();
  console.log(`demo-${v.key}-*.png`);
}

/* ── 3. 操作の動画 ── */
if (args.video === 'yes') {
  for (const v of VIEWS) {
    const ctx = await ctxFor(v, true);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/laruHP`, { waitUntil: 'load' });
    await page.waitForTimeout(2600);
    await page.locator('[data-lhp-demo]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);

    const radios = page.locator('[role="radiogroup"] [role="radio"]');
    await radios.nth(2).click(); await page.waitForTimeout(2600);   // やわらかい
    await radios.nth(1).click(); await page.waitForTimeout(2600);   // 落ち着いた
    await radios.nth(0).click(); await page.waitForTimeout(2600);   // 上質

    // ばらす → 組み上げる（選択は保たれたまま）
    await page.locator('button:has-text("もう一度ばらす")').first().click();
    await page.waitForTimeout(1800);
    await page.locator('button:has-text("組み上げる")').first().click();
    await page.waitForTimeout(1800);

    // 予約まで試す
    await page.locator('button:has-text("このお店の予約フォームまで試す")').click();
    await page.waitForTimeout(1600);
    const f = page.locator('[title^="お店のサイトの見本"]').contentFrame();
    await f.locator('#lhp-form-booking').scrollIntoViewIfNeeded().catch(() => {});
    const box = await page.locator('[title^="お店のサイトの見本"]').boundingBox();
    if (box) await page.mouse.wheel(0, box.height * 0.55);
    await page.waitForTimeout(900);
    await f.locator('input[type="text"]').first().fill('齋藤 匠');
    await page.waitForTimeout(500);
    await f.locator('input[type="email"]').first().fill('sample@example.com');
    await page.waitForTimeout(500);
    /* 入れ物は縮めて置いてあるので、外から座標で押すと届かないことがある。
       中で押す（送信の扱いは同じ） */
    await f.locator('button[type="submit"], button:has-text("予約を申し込む")').first()
      .evaluate(el => el.click());
    await page.waitForTimeout(2200);
    await ctx.close();
    console.log(`video-${v.key}/`);
  }
}

await browser.close();
console.log(`\n出力先: ${args.out}`);
