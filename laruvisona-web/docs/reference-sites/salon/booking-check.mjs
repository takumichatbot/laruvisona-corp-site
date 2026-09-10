// 予約フォームを、実際のブラウザから実際に送って確認する。
//
//   node docs/reference-sites/salon/booking-check.mjs --url http://127.0.0.1:3300/hp/yuian
//
// 受信は同梱の小さなサーバが受ける（/api/contact の代わり）。外部へは出ない。
// 確認するのは、目で見て分からない「押せない・送れない・戻れない」の3つ。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM
  ? process.env.PLAYWRIGHT_FROM + '/'
  : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import path from 'node:path';

const args = { url: 'http://127.0.0.1:3300/hp/yuian', 'font-css': '', 'font-dir': '' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}

// 送信の受け先。別オリジンへは continue できないので、ここで直接受ける。
let mode = 'ok';
const received = [];

const ok = [], ng = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ng).push(name);
  console.log(`${pass ? 'OK  ' : 'NG  '}${name}${detail ? ` … ${detail}` : ''}`);
};

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  locale: 'ja-JP',
});
// 送信を受け取る（実際にPOSTが飛んでいることを、中身ごと確かめる）
await ctx.route(/\/api\/contact/, async r => {
  received.push(JSON.parse(r.request().postData() || '{}'));
  await r.fulfill({
    status: mode === 'ok' ? 200 : 500,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(mode === 'ok' ? { ok: true } : { ok: false, error: 'ただいま受付できません' }),
  });
});
if (args['font-css'] && fs.existsSync(args['font-css'])) {
  await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: fs.readFileSync(args['font-css']) }));
}
if (args['font-dir'] && fs.existsSync(args['font-dir'])) {
  await ctx.route(/fonts\.gstatic\.com/, r => {
    const p = path.join(args['font-dir'], path.basename(new URL(r.request().url()).pathname));
    return fs.existsSync(p) ? r.fulfill({ status: 200, headers: { 'content-type': 'font/woff2' }, body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' });
  });
}
await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(args.url, { waitUntil: 'load' });
await page.waitForTimeout(1200);

// ── 1. Cookieの帯が出ている間も、予約ボタンが押せる ──
const banner = page.locator('#lhp-cookie-banner');
const sticky = page.locator('.lhp-sticky-cta-btn');
check('Cookieの帯が出ている', await banner.isVisible());
check('その状態でも固定予約ボタンが見えている', await sticky.isVisible());
const bb = await banner.boundingBox(), sb = await sticky.boundingBox();
check('固定予約ボタンが帯に隠れていない', !!bb && !!sb && sb.y + sb.height <= bb.y + 1,
  `ボタン下端 ${sb ? Math.round(sb.y + sb.height) : '?'} / 帯上端 ${bb ? Math.round(bb.y) : '?'}`);
check('固定予約ボタンは指で押せる高さ', !!sb && sb.height >= 44, `${sb ? Math.round(sb.height) : '?'}px`);
// 実際に押せる（帯の上から届く）
await sticky.click({ timeout: 3000 });
await page.waitForTimeout(600);
check('押すと予約へ移動する', new URL(page.url()).hash === '#booking', page.url().split('#')[1] || 'なし');

try { await page.getByRole('button', { name: '同意する' }).click({ timeout: 2000 }); } catch { /* noop */ }
await page.waitForTimeout(400);
const sb2 = await sticky.boundingBox();
check('帯を閉じたら固定ボタンが下に戻る', !!sb2 && sb2.y + sb2.height > (sb?.y ?? 0) + (sb?.height ?? 0) - 2,
  `${sb2 ? Math.round(sb2.y) : '?'}`);

// ── 2. キーボードだけで予約まで行ける ──
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('body').press('Tab');
let reached = false;
for (let i = 0; i < 60 && !reached; i++) {
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, href: el?.getAttribute?.('href'), bk: el?.getAttribute?.('data-bk'), id: el?.id };
  });
  if (info.href === '#booking') {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    reached = new URL(page.url()).hash === '#booking';
    break;
  }
  await page.keyboard.press('Tab');
}
check('キーボードだけで予約へ移動できる', reached);

// 予約欄までタブで届き、入力できる
let focusedService = false;
for (let i = 0; i < 40 && !focusedService; i++) {
  await page.keyboard.press('Tab');
  focusedService = await page.evaluate(() => document.activeElement?.getAttribute('data-bk') === 'service');
}
check('キーボードで予約の入力欄まで届く', focusedService);
const outline = await page.evaluate(() => {
  const el = document.activeElement;
  const cs = el ? getComputedStyle(el) : null;
  return cs ? { outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow } : null;
});
check('どこに居るか見て分かる（フォーカス表示）',
  !!outline && (outline.outline !== 'none' || (outline.shadow && outline.shadow !== 'none')),
  JSON.stringify(outline));

// ── 3. 実際に送る。失敗 → 再試行 → 成功 ──
mode = 'fail';
await page.fill('[data-bk="name"]', '齋藤 匠');
await page.fill('[data-bk="phone"]', '090-0000-0000');
await page.fill('[data-bk="email"]', 'test@example.com');
await page.fill('[data-bk="date"]', '2026-09-20');
await page.selectOption('[data-bk="time"]', '14:00');
await page.selectOption('[data-bk="service"]', 'カラー＋カット');
await page.locator('#lhp-btn-booking').click();
await page.waitForTimeout(900);
check('失敗したら理由が出る', ((await page.locator('#lhp-note-booking').textContent()) || '').includes('受付できません'));
check('押し直せる状態に戻る', await page.locator('#lhp-btn-booking').isEnabled());
check('入力が残っている', (await page.locator('[data-bk="name"]').inputValue()) === '齋藤 匠'
  && (await page.locator('[data-bk="service"]').inputValue()) === 'カラー＋カット');

mode = 'ok';
await page.locator('#lhp-btn-booking').click();
await page.waitForTimeout(900);
check('もう一度押すと成功する', await page.locator('.lhp-form-success').isVisible());

const last = received[received.length - 1] || {};
check('送った中身が届いている', last.name === '齋藤 匠' && last.email === 'test@example.com'
  && String(last.message || '').includes('カラー＋カット') && String(last.message || '').includes('2026-09-20'),
  JSON.stringify(last));
check('予約データにサイトIDが付いている', !!last.siteId, last.siteId);
check('ページの例外が出ていない', errs.length === 0, errs.join(' / '));

await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('予約の導線（Cookie表示中・キーボード・実送信）を確認しました');
