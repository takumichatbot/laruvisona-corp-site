// 既定CSSに残っていた青（#2563eb）を差し色に寄せた変更の、前後を撮る。
//
//   node tests/browser/accent-before-after.mjs --port 3300 --slug yuian --out /tmp/accent
//
// 「前」は、いまの公開ページに、変更前の生成物と同じ色を当て直したもの。
// 変更前のコードは、次の場所を設定の差し色ではなく #2563eb で出していた:
//   スタッフの肩書き / 料金の「おすすめ」の地・枠・影 / 料金ボタン /
//   ナビのCTA / お知らせの札 / 複数ステップのフォームの現在地 / タブの選択中
// いまは var(--lhp-accent, #2563eb) を通すので、差し色を設定した店では
// 差し色になり、設定していない店ではこれまでと同じ青のままになる。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';

const args = { port: '3300', slug: 'yuian', out: '/tmp/accent' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
fs.mkdirSync(args.out, { recursive: true });

/** 変更前の生成物と同じ色に戻すCSS */
const OLD = `
.lhp-team-role{color:#2563eb !important}
.lhp-price-featured{border-color:#2563eb !important;box-shadow:0 8px 32px rgba(37,99,235,.3) !important}
.lhp-price-btn{background:#2563eb !important;color:#fff !important}
.lhp-news-tag{background:#2563eb !important;color:#fff !important}
.lhp-nav-cta{background:#2563eb !important}
`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ja-JP' });
const fonts = await installLocalFonts(ctx);
await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${args.port}/hp/${encodeURIComponent(args.slug)}`, { waitUntil: 'networkidle' });

/** その節だけを撮る */
async function shot(name, selector) {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) { console.log(`（見つからない: ${selector}）`); return; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await el.screenshot({ path: `${args.out}/${name}.png` });
  console.log(`撮影: ${name}.png`);
}

// あと（いまの生成物）
await shot('after-team', '.lhp-team, .lhp-section:has(.lhp-team-photo)');
await shot('after-price', '.lhp-section:has(.lhp-price-featured)');

// まえ（変更前と同じ色に戻す）
await page.addStyleTag({ content: OLD });
await page.waitForTimeout(300);
await shot('before-team', '.lhp-team, .lhp-section:has(.lhp-team-photo)');
await shot('before-price', '.lhp-section:has(.lhp-price-featured)');

await fonts.close();
await browser.close();
console.log(`\n${args.out} に前後を出しました`);
