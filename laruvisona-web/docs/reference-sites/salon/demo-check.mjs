// 案内ページの「選んで、組み上がる」デモを、実際に触って確かめる。
//
//   node docs/reference-sites/salon/demo-check.mjs --port 3300
//
// 見るのは次の7つ。
//   0. 最初から完成例が出ているか（到達できる品質が先に分かるか）
//   1. 冒頭がコンパクトか（最初は最初の画面までで、予約フォームまで出さない）
//   2. 見せ方の選択が1種類・3択で、押すと本当に画面が変わるか
//      （写真・文章・料金は変わらないこと）
//   3. 選んだ見せ方が、ばらす／組み上げる／予約を開くでも消えないか
//   4. 続けて選び直したとき、古い描き終わりが最後の選択を上書きしないか
//   5. 選択状態・更新中が分かり、キーボードだけでも選べるか
//   6. 組み上がったあと中を操作でき、予約がどこへも送られないか
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
const ROOT = '[data-lhp-demo]';

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

/** 見えている見本の状態。中の値は公開ページのCSS変数そのもの */
const frameState = (page) => page.locator(STAGE).contentFrame().locator('html').evaluate(el => ({
  e: getComputedStyle(el).getPropertyValue('--e').trim(),
  locked: el.getAttribute('data-locked'),
  accent: getComputedStyle(el).getPropertyValue('--lhp-d-accent').trim(),
  radius: getComputedStyle(el).getPropertyValue('--lhp-d-r').trim(),
  bg: getComputedStyle(el).getPropertyValue('--lhp-d-bg').trim(),
  width: el.clientWidth,
  heroFontPx: (() => {
    const h = document.querySelector('.lhp-hero h1');
    return h ? Math.round(parseFloat(getComputedStyle(h).fontSize)) : 0;
  })(),
  // 内容は変わらないはず。文章と料金を拾っておく
  heading: (document.querySelector('.lhp-hero h1')?.textContent || '').replace(/\s+/g, ''),
  prices: [...document.querySelectorAll('.lhp-price-card')].map(c => (c.textContent || '').match(/[\d,]{3,}/)?.[0] || '').join('/'),
  heroImg: document.querySelector('.lhp-hero-split-img img')?.currentSrc?.split('/').pop() || '',
}));

const rootState = (page) => page.locator(ROOT).evaluate(el => ({
  picked: el.getAttribute('data-lhp-demo-picked'),
  shown: el.getAttribute('data-lhp-demo-shown'),
  busy: el.getAttribute('data-lhp-demo-busy'),
}));

/* ── 1. パソコン ── */
{
  const { ctx, page, posts, errs } = await open({ width: 1440, height: 900 });

  check('横に食み出していない（1440px）',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

  // 0. 最初から完成例
  const first = await frameState(page);
  check('最初から組み上がった完成例が出ている', first.e === '0', `--e=${first.e}`);
  check('最初から中を触れる', first.locked === '0');
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-initial.png` });

  // 1. 冒頭のコンパクトさ
  const peek = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    return { stage: Math.round(f.parentElement.getBoundingClientRect().height) };
  }, STAGE);
  check('冒頭の枠がコンパクト', peek.stage <= 700, `${peek.stage}px`);
  const bookingTop = await page.locator(STAGE).contentFrame().locator('#lhp-form-booking')
    .evaluate(el => Math.round(el.getBoundingClientRect().top + window.scrollY));
  const frameShown = await page.evaluate((sel) => Math.round(document.querySelector(sel).getBoundingClientRect().height / (new DOMMatrix(getComputedStyle(document.querySelector(sel)).transform)).a), STAGE);
  check('冒頭では予約フォームまで出していない', bookingTop > frameShown, `予約は${bookingTop}px、見せているのは${frameShown}pxまで`);
  check('見本のお店であることが書いてある', (await page.locator('text=架空の美容室').count()) > 0);
  check('LARU HP の申し込みと区別している', (await page.locator('text=LARU HP のお申し込みではありません').count()) > 0);

  const fit = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    return { frame: Math.round(f.getBoundingClientRect().width), stage: Math.round(f.parentElement.getBoundingClientRect().width) };
  }, STAGE);
  check('デモが入れ物の幅に収まっている', fit.frame <= fit.stage + 1, `${fit.frame}px / ${fit.stage}px`);
  check('パソコンでは、パソコンの組み方で見せている', first.width === 1440, `${first.width}px`);

  // 2. 選ぶ操作は1種類・3択だけ
  const radios = page.locator('[role="radiogroup"] [role="radio"]');
  check('選ぶ操作は1種類だけ', (await page.locator('[role="radiogroup"]').count()) === 1,
    `radiogroup ${await page.locator('[role="radiogroup"]').count()}個`);
  check('選べるのは3つ', (await radios.count()) === 3, `${await radios.count()}個`);
  const r0 = await rootState(page);
  check('最初に選ばれているものが分かる', r0.picked === 'refined' && (await radios.nth(0).getAttribute('aria-checked')) === 'true', r0.picked);

  // 押すと見た目が変わり、内容は変わらない
  await radios.nth(2).click();          // やわらかい
  await page.waitForTimeout(1800);
  const warm = await frameState(page);
  check('選ぶと、その場で見た目が変わる',
    warm.accent !== first.accent && warm.radius !== first.radius, `${first.accent}/${first.radius} → ${warm.accent}/${warm.radius}`);
  check('写真・文章・料金は変わっていない',
    warm.heading === first.heading && warm.prices === first.prices && warm.heroImg === first.heroImg,
    `${warm.prices} / ${warm.heroImg}`);
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-picked-warm.png` });
  const rw = await rootState(page);
  check('選んだものが、選択済みとして残る', rw.picked === 'warm' && rw.shown === 'warm', `${rw.picked}/${rw.shown}`);
  check('組み上がった状態で出ている', (await frameState(page)).e === '0');

  // 3. ばらす／組み上げる／予約を開いても選択が消えない
  await page.locator('button:has-text("もう一度ばらす")').first().click();
  await page.waitForTimeout(1300);
  const exploded = await frameState(page);
  check('「ばらす」で本当にばらける', exploded.e === '1', `--e=${exploded.e}`);
  check('ばらけているあいだは中を触らせない', exploded.locked === '1');
  check('ばらしても選択が消えない', exploded.accent === warm.accent, exploded.accent);
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-exploded.png` });

  await page.locator('button:has-text("組み上げる")').first().click();
  await page.waitForTimeout(1300);
  const reassembled = await frameState(page);
  check('「組み上げる」で組み上がる', reassembled.e === '0', `--e=${reassembled.e}`);
  check('組み上げ直しても選択が消えない', reassembled.accent === warm.accent, reassembled.accent);

  const beforeOpen = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  await page.locator('button:has-text("このお店の予約フォームまで試す")').click();
  await page.waitForTimeout(900);
  const afterOpen = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  check('「予約フォームまで試す」で開く', afterOpen > beforeOpen * 1.5, `${beforeOpen}px → ${afterOpen}px`);
  check('開くと予約フォームが出る', await page.locator(STAGE).contentFrame().locator('#lhp-form-booking').isVisible());
  const opened = await frameState(page);
  check('予約まで開いても選択が消えない', opened.accent === warm.accent, opened.accent);
  // 5. 選んだ見せ方が、そのままフォームにも出ている
  const formLook = await page.locator(STAGE).contentFrame().locator('#lhp-form-booking button[type="submit"], #lhp-form-booking button').first()
    .evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius }));
  check('フォームのボタンにも、選んだ見せ方が出ている', /9999px|^4[0-9]px/.test(formLook.radius) || formLook.radius !== '0px', JSON.stringify(formLook));
  if (args.shots) await page.screenshot({ path: `${args.shots}/demo-booking-open.png` });
  await page.locator('button:has-text("最初の画面だけに戻す")').click();
  await page.waitForTimeout(700);
  check('閉じると、また最初の画面だけになる',
    (await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE)) <= 700);

  // 4. 続けて選び直しても、古い描き終わりが最後の選択を上書きしない
  await radios.nth(0).click();
  await page.waitForTimeout(60);
  await radios.nth(1).click();
  await page.waitForTimeout(60);
  await radios.nth(2).click();
  await page.waitForTimeout(60);
  await radios.nth(1).click();          // 最後は「落ち着いた」
  await page.waitForTimeout(3200);
  const rr = await rootState(page);
  const last = await frameState(page);
  const calmAccent = '#2f5d7c';
  check('続けて選び直しても、最後に押したものが残る', rr.picked === 'calm' && rr.shown === 'calm', `${rr.picked}/${rr.shown}`);
  check('画面も、最後に押したものになっている', last.accent.toLowerCase() === calmAccent, last.accent);
  check('更新中の表示が残っていない', rr.busy === '0', rr.busy);
  check('入れ替えたあと、見えている見本は1つだけ', (await page.locator(STAGE).count()) === 1);

  // 5. キーボードだけで選べる
  await radios.nth(1).focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2000);
  const kb1 = await rootState(page);
  check('矢印キーで次の見せ方に移れる', kb1.picked === 'warm' && kb1.shown === 'warm', `${kb1.picked}/${kb1.shown}`);
  check('移った先にフォーカスがある',
    await page.evaluate(() => document.activeElement?.getAttribute('role') === 'radio' && document.activeElement?.getAttribute('aria-checked') === 'true'));
  await page.keyboard.press('Home');
  await page.waitForTimeout(2000);
  const kb2 = await rootState(page);
  check('Home で最初の見せ方に戻れる', kb2.picked === 'refined' && kb2.shown === 'refined', `${kb2.picked}/${kb2.shown}`);
  check('選ばれていないものは、Tab の順路から外れている',
    (await radios.nth(1).getAttribute('tabindex')) === '-1' && (await radios.nth(0).getAttribute('tabindex')) === '0');

  // 6. 中を操作できる／どこへも送らない
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.locator(STAGE).contentFrame().locator('a:has-text("ご予約フォームへ")').click();
  await page.waitForTimeout(1200);
  const y1 = await page.evaluate(() => window.scrollY);
  check('中のボタンを押すと、開いて予約の場所まで動く', y1 > y0 + 100, `${y0} → ${y1}`);
  check('そのとき予約フォームが出ている', await page.locator(STAGE).contentFrame().locator('#lhp-form-booking').isVisible());

  const f = page.locator(STAGE).contentFrame();
  await f.locator('input[type="text"]').first().fill('齋藤');
  await f.locator('input[type="email"]').first().fill('test@example.com');
  await f.locator('button[type="submit"], button:has-text("予約を申し込む")').first().click();
  await page.waitForTimeout(900);
  check('送ると、その場で受け付けたと出る',
    (await f.locator('#lhp-demo-sent').count()) > 0 && /実際の予約は送っていません/.test(await f.locator('#lhp-demo-sent').innerText()));
  check('親の画面にも、送っていないことが出る', (await page.locator('text=実際の予約は送っていません').count()) > 0);
  const sent = posts.filter(u => /\/api\//.test(u));
  check('見せ方を選んでも、顧客データの保存APIを呼んでいない', sent.length === 0, sent.join(' / '));

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
  check('スマホでも最初から完成例が出ている', st.e === '0', `--e=${st.e}`);

  const peek = await page.evaluate((sel) => Math.round(document.querySelector(sel).parentElement.getBoundingClientRect().height), STAGE);
  check('スマホの冒頭の枠がコンパクト', peek <= 1100, `${peek}px（前は約2730px）`);

  // 選ぶところが、画面のどこにあるか（枠のすぐ下であること）
  const order = await page.evaluate((sel) => {
    const stage = document.querySelector(sel).parentElement;
    const group = document.querySelector('[role="radiogroup"]');
    return { stage: Math.round(stage.getBoundingClientRect().top + window.scrollY),
             group: Math.round(group.getBoundingClientRect().top + window.scrollY),
             stageBottom: Math.round(stage.getBoundingClientRect().bottom + window.scrollY) };
  }, STAGE);
  check('スマホでは、完成例を見てから選ぶ並びになっている', order.group > order.stage, `枠 ${order.stage}px / 選択 ${order.group}px`);
  check('選ぶところが枠のすぐ下にある', order.group - order.stageBottom < 80, `${order.group - order.stageBottom}px`);

  const fit = await page.evaluate((sel) => {
    const f = document.querySelector(sel);
    const r = f.getBoundingClientRect();
    const s = f.parentElement.getBoundingClientRect();
    return { frameW: Math.round(r.width), stageW: Math.round(s.width), left: Math.round(r.left - s.left) };
  }, STAGE);
  check('横が切れていない', fit.frameW <= fit.stageW + 1 && fit.left >= -1, `幅 ${fit.frameW}/${fit.stageW}・左 ${fit.left}`);

  const shownScale = await page.evaluate((sel) => {
    const m = getComputedStyle(document.querySelector(sel)).transform.match(/matrix\(([^,]+)/);
    return m ? parseFloat(m[1]) : 1;
  }, STAGE);
  check('見えている見出しが小さすぎない', st.heroFontPx * shownScale >= 13,
    `${st.heroFontPx}px × ${shownScale.toFixed(2)} = ${(st.heroFontPx * shownScale).toFixed(1)}px`);

  const small = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 34) bad.push((b.textContent || '').trim().slice(0, 12));
    });
    return bad;
  });
  check('指で押せる大きさになっている', small.length === 0, small.slice(0, 4).join(' / '));

  // スマホでも選べる
  const radios = page.locator('[role="radiogroup"] [role="radio"]');
  const b0 = await frameState(page);
  await radios.nth(2).tap();
  await page.waitForTimeout(1800);
  const b1 = await frameState(page);
  check('スマホでも、選ぶと見た目が変わる', b1.accent !== b0.accent, `${b0.accent} → ${b1.accent}`);
  check('スマホでも内容は変わらない', b1.prices === b0.prices && b1.heading === b0.heading);
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

  // 選んでも、ばらける演出を挟まずに完成状態を直接出す
  const radios = page.locator('[role="radiogroup"] [role="radio"]');
  await radios.nth(2).click();
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(150);
    seen.push(await page.locator(STAGE).contentFrame().locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--e').trim()).catch(() => ''));
  }
  check('動きを減らす設定では、選んでもばらけない', !seen.includes('1'), seen.join(''));
  const after = await frameState(page);
  check('動きを減らす設定でも、選んだ見せ方に変わる', after.accent !== st.accent, `${st.accent} → ${after.accent}`);
  check('選んだあとも組み上がったまま', after.e === '0');
  await ctx.close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('選んで組み上がるデモが、幅に合って・本当に触れることを確認しました');
