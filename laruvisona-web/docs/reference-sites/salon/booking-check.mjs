// 予約フォームの「画面側」を確認する。実サーバ・実APIの受信は確認しない。
//
//   node docs/reference-sites/salon/booking-check.mjs --url http://127.0.0.1:3300/hp/yuian
//
// ここでは /api/contact への送信を route.fulfill で差し替え、成功・失敗の応答を
// こちらで作って返している。つまり通っているのはブラウザまでで、Next のルートも
// データベースも動いていない。分かるのは次の3つだけ:
//   ・Cookieの帯が出ている間も予約ボタンが押せるか
//   ・キーボードだけで予約まで行けるか
//   ・失敗したときに押し直せて、入力が残るか
//
// 「実サーバ・実APIが受け取ったか」は api-contract-check.mjs で確認する。
// あちらは差し替えを一切せず、実際の /api/contact が受け、受信内容まで見る。
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

// ── 0. 料金の数字が、そのままの値で出ている ──
// カウントアップ演出は途中の数字を描く。13,200円 が一瞬 13,197円 に見えると
// 値段を読み違えるので、この作品（動きなし）では動かさない。
{
  const read = () => page.$$eval('.lhp-price-amount', els => els.map(e => e.textContent.trim()));
  const first = await read();
  await page.waitForTimeout(1800);
  const later = await read();
  check('料金がそのままの値で出ている', JSON.stringify(first) === JSON.stringify(['6,600円', '13,200円〜', '8,800円']), JSON.stringify(first));
  check('時間が経っても料金が変わらない', JSON.stringify(first) === JSON.stringify(later), JSON.stringify(later));
}

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
await page.waitForTimeout(900);
check('押すと予約へ移動する', new URL(page.url()).hash === '#booking', page.url().split('#')[1] || 'なし');

// 予約欄に着いたら、同じ場所へ行く固定ボタンは引っ込む。
// 出したままだと、フォームの送信ボタンに重なって押し間違える。
const isOff = () => page.locator('.lhp-sticky-cta').evaluate(el => el.classList.contains('lhp-sticky-cta-off'));
check('予約欄を見ている間は固定ボタンを引っ込める', await isOff());
{
  const submit = await page.locator('#lhp-btn-booking').boundingBox();
  const cta = await page.locator('.lhp-sticky-cta-btn').boundingBox();
  const overlaps = !!submit && !!cta && cta.y < submit.y + submit.height && cta.y + cta.height > submit.y;
  check('送信ボタンに重なっていない', !overlaps,
    `送信 ${submit ? Math.round(submit.y) : '?'}〜${submit ? Math.round(submit.y + submit.height) : '?'} / 固定 ${cta ? Math.round(cta.y) : '?'}`);
}

// 画面の上に戻すと、また出る
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
check('上に戻ると固定ボタンがまた出る', !(await isOff()));

try { await page.getByRole('button', { name: '同意する' }).click({ timeout: 2000 }); } catch { /* noop */ }
await page.waitForTimeout(500);
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

// ── 3. 送信の失敗と再試行（応答はこちらで作っている＝実APIは通っていない）──
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
check('送った中身がPOSTに載っている（受信はしていない）', last.name === '齋藤 匠' && last.email === 'test@example.com'
  && String(last.message || '').includes('カラー＋カット') && String(last.message || '').includes('2026-09-20'),
  JSON.stringify(last));
check('予約データにサイトIDが付いている', !!last.siteId, last.siteId);
check('ページの例外が出ていない', errs.length === 0, errs.join(' / '));

await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('予約フォームの画面側（Cookie表示中・キーボード・失敗時の戻り）を確認しました');
console.log('※ 応答は差し替えです。実サーバ・実APIでの受信は api-contract-check.mjs で確認します');
