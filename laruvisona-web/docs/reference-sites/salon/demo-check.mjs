// 案内ページの「組み上がるデモ」を、実際に触って確かめる。
//
//   node docs/reference-sites/salon/demo-check.mjs --port 3300
//
// 見るのは次の4つ。
//   0. 冒頭がコンパクトか（最初は最初の画面までで、予約フォームまで出さない）
//   1. 画面の幅に合っているか（スマホで横が切れないか、読める大きさか）
//   2. ばらける／組み上がるが、本当に画面を変えているか
//   3. 組み上がったあと、中を本当に操作できるか
//      （ページ内の移動・入力・送信、キーボードだけでも）
//   4. 送信で、実際の予約をどこにも送っていないか
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');

const args = { port: '3300', path: '/laruHP', shots: '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const URL_ = `http://127.0.0.1:${args.port}${args.path}`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const browser = await chromium.launch();
const BLOCK = /fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/;
const STAGE = '[title^="お店のサイトの見本"]';

async function open({ width, height, reduced = false, scale = 1 }) {
  const ctx = await browser.newContext({
    viewport: { width, height }, locale: 'ja-JP', deviceScaleFactor: scale,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: width < 700,
  });
  await ctx.route(BLOCK, r => r.abort());
  const page = await ctx.newPage();
  const posts = [];
  page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  return { ctx, page, posts, errs };
}

const frameState = (page) => page.locator(STAGE).contentFrame().locator('html').evaluate(el => ({
  e: getComputedStyle(el).getPropertyValue('--e').trim(),
  locked: el.getAttribute('data-locked'),
  accent: getComputedStyle(el).getPropertyValue('--lhp-d-accent').trim(),
  width: el.clientWidth,
  heroFontPx: (() => {
    const h = document.querySelector('.lhp-hero h1');
    return h ? Math.round(parseFloat(getComputedStyle(h).fontSize)) : 0;
  })(),
}));

/* ── 1. パソコン ── */
{
  const { ctx, page, posts, errs } = await open({ width: 1440, height: 900 });

  check('横に食み出していない（1440px）',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  // 冒頭は「最初の画面と、組み上がるところ」まで。予約フォームまでは出さない
  const peek = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    return { stage: Math.round(f.parentElement.getBoundingClientRect().height), frame: Math.round(f.getBoundingClientRect().height) };
  }, STAGE);
  check('冒頭の枠がコンパクト', peek.stage <= 700, `${peek.stage}px`);
  // 枠の高さより下にあるので、閉じているあいだは目に入らない
  const bookingTop = await page.locator(STAGE).contentFrame().locator('#lhp-form-booking')
    .evaluate(el => Math.round(el.getBoundingClientRect().top + window.scrollY));
  const frameShown = await page.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height / (new DOMMatrix(getComputedStyle(document.querySelector(sel)).transform)).a), STAGE);
  check('冒頭では予約フォームまで出していない', bookingTop > frameShown, `予約は${bookingTop}px、見せているのは${frameShown}pxまで`);
  check('見本のお店であることが書いてある', (await page.locator('text=架空の美容室').count()) > 0);
  check('LARU HP の申し込みと区別している', (await page.locator('text=LARU HP のお申し込みではありません').count()) > 0);

  const fit = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const stage = f.parentElement;
    return { frame: Math.round(f.getBoundingClientRect().width), stage: Math.round(stage.getBoundingClientRect().width) };
  }, STAGE);
  check('デモが入れ物の幅に収まっている', fit.frame <= fit.stage + 1, `${fit.frame}px / ${fit.stage}px`);

  const st1 = await frameState(page);
  check('パソコンでは、パソコンの組み方で見せている', st1.width === 1440, `${st1.width}px`);

  // ばらける → 組み上がる
  await page.locator('button:has-text("もう一度ばらす")').first().click();
  await page.waitForTimeout(1400);
  const exploded = await frameState(page);
  check('「ばらす」で本当にばらける', exploded.e === '1', `--e=${exploded.e}`);
  check('ばらけているあいだは中を触らせない', exploded.locked === '1');
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-exploded.png` });

  await page.locator('button:has-text("組み上げる")').first().click();
  await page.waitForTimeout(1400);
  const assembled = await frameState(page);
  check('「組み上げる」で組み上がる', assembled.e === '0', `--e=${assembled.e}`);
  check('組み上がったら中を触れる', assembled.locked === '0');
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-assembled.png` });

  // 雰囲気を変えると画面が変わる
  const before = assembled.accent;
  await page.locator('button:has-text("力強い")').click();
  await page.waitForTimeout(1500);
  const after = await frameState(page);
  check('雰囲気を押すと、その場で作り直される', after.accent !== before && !!after.accent, `${before} → ${after.accent}`);
  await page.locator('button:has-text("上質")').click();
  await page.waitForTimeout(1500);

  // 「予約フォームまで試す」で開く
  const beforeOpen = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  await page.locator('button:has-text("このお店の予約フォームまで試す")').click();
  await page.waitForTimeout(900);
  const afterOpen = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  check('「予約フォームまで試す」で開く', afterOpen > beforeOpen * 1.5, `${beforeOpen}px → ${afterOpen}px`);
  check('開くと予約フォームが出る', await page.locator(STAGE).contentFrame().locator('#lhp-form-booking').isVisible());
  await page.locator('button:has-text("最初の画面だけに戻す")').click();
  await page.waitForTimeout(700);
  check('閉じると、また最初の画面だけになる',
    (await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE)) <= 700);

  // ページ内の移動（中のボタンを押す）。閉じていても、押したら開いて動く。
  // 位置をそろえてから測る（前の手順でどこまで送ったかに左右されないように）
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.locator(STAGE).contentFrame().locator('a:has-text("ご予約フォームへ")').click();
  await page.waitForTimeout(1200);
  const y1 = await page.evaluate(() => window.scrollY);
  check('中のボタンを押すと、開いて予約の場所まで動く', y1 > y0 + 100, `${y0} → ${y1}`);
  check('そのとき予約フォームが出ている', await page.locator(STAGE).contentFrame().locator('#lhp-form-booking').isVisible());

  // 入力して送る
  const f = page.locator(STAGE).contentFrame();
  await f.locator('input[type="text"]').first().fill('齋藤');
  await f.locator('input[type="email"]').first().fill('test@example.com');
  await f.locator('button[type="submit"], button:has-text("予約を申し込む")').first().click();
  await page.waitForTimeout(900);
  check('送ると、その場で受け付けたと出る',
    (await f.locator('#lhp-demo-sent').count()) > 0 && /実際の予約は送っていません/.test(await f.locator('#lhp-demo-sent').innerText()));
  check('親の画面にも、送っていないことが出る', (await page.locator('text=実際の予約は送っていません').count()) > 0);
  const sent = posts.filter(u => /\/api\/(hp\/booking|contact)/.test(u));
  check('予約も問い合わせも、どこへも送っていない', sent.length === 0, sent.join(' / '));

  // キーボードだけで同じことができる
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const kb = await page.locator(STAGE).contentFrame().locator('a:has-text("ご予約フォームへ")').evaluate(el => {
    el.focus();
    return document.activeElement === el;
  });
  check('中のボタンにキーボードで移れる', kb);
  const y2 = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  check('Enter でも同じように動く', (await page.evaluate(() => window.scrollY)) > y2 + 100);

  check('画面の例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 2. スマホ ── */
{
  const { ctx, page, errs } = await open({ width: 390, height: 844, scale: 3 });

  check('横に食み出していない（390px）',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  const st = await frameState(page);
  check('スマホでは、スマホの組み方に切り替わる', st.width === 390, `${st.width}px`);

  const peek = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  check('スマホの冒頭の枠がコンパクト', peek <= 1100, `${peek}px（前は約2730px）`);
  check('スマホでも、操作が枠の中にある', await page.locator(`${STAGE} ~ button, .relative > button:has-text("組み上げる")`).first().isVisible().catch(() => false)
    || (await page.locator('button:has-text("組み上げる")').first().isVisible()));

  const fit = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const r = f.getBoundingClientRect();
    const s = f.parentElement.getBoundingClientRect();
    return { frameW: Math.round(r.width), stageW: Math.round(s.width), left: Math.round(r.left - s.left) };
  }, STAGE);
  check('横が切れていない', fit.frameW <= fit.stageW + 1 && fit.left >= -1, `幅 ${fit.frameW}/${fit.stageW}・左 ${fit.left}`);

  // 見えている大きさ（縮小したあとの実寸）で、読める文字になっているか
  const shownPx = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const m = getComputedStyle(f).transform.match(/matrix\(([^,]+)/);
    const s = m ? parseFloat(m[1]) : 1;
    const doc = f.contentDocument;
    return { scale: s };
  }, STAGE);
  check('見えている見出しが小さすぎない', st.heroFontPx * shownPx.scale >= 13,
    `${st.heroFontPx}px × ${shownPx.scale.toFixed(2)} = ${(st.heroFontPx * shownPx.scale).toFixed(1)}px`);

  // 押すところが指で届く大きさか
  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 34) bad.push((b.textContent || '').trim().slice(0, 12));
    });
    return bad;
  });
  check('指で押せる大きさになっている', small.length === 0, small.slice(0, 4).join(' / '));

  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-sp.png`, fullPage: false });
  check('画面の例外が出ていない（スマホ）', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 3. 動きを減らす設定 ── */
{
  const { ctx, page } = await open({ width: 1440, height: 900, reduced: true });
  const st = await frameState(page);
  check('動きを減らす設定では、最初から組み上がっている', st.e === '0', `--e=${st.e}`);
  check('動きを減らす設定でも、中は触れる', st.locked === '0');
  await ctx.close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('組み上がるデモが、幅に合って・本当に触れることを確認しました');
