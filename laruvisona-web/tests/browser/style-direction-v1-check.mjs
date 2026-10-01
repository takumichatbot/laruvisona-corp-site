// 見た目の3案（構成から、選び直す）を、制作画面の実操作で確かめる。
// 本番用ビルド（127.0.0.1:3319）＋ 隔離した偽Supabase（127.0.0.1:54999）だけを使う。
// 実アカウント・実送信・本番への書き込み・外部通信（書体以外）はしない。書体は同じ配布物をローカルから供給する。
//
//   FIXTURE: FIXTURE_PORT=54999 node tests/http/fixture.cjs
//   SERVER : NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54999 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-stub npx next build && npx next start -p 3319
//   RUN    : CHROMIUM_PATH=/path/to/chrome PLAYWRIGHT_CORE_FROM=<dir with playwright-core> node tests/browser/style-direction-v1-check.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319';
const out = process.env.OUTPUT_DIR || '/tmp/laruhp-style-direction';
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(ok ? 'OK  ' : 'FAIL', name, detail);
};
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const CANVAS = 'iframe[title="できあがりの見え方"]';
const strip = (h) => String(h || '')
  .replace(/<script data-lhp-studio-bridge[\s\S]*?<\/script>/, '')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
  .replace(/window\.__LHPSID=[^;]*;/g, '')
  .replace(/"siteId":"[^"]*"/g, '')
  .replace(/siteId=[^"&]*/g, '')
  .replace(/<meta (property|name)="(og|twitter):image"[^>]*>/g, '')
  .replace(/<script><\/script>/g, '');

async function newContext(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1000 ? 1000 : 844 }, locale: 'ja-JP', ...opts });
  await ctx.addCookies(['sb-127-auth-token'].map((name) => ({
    name, value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/',
  })));
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
  const fonts = await installLocalFonts(ctx);
  // 外部の計測・連携へは出さない
  await ctx.route(/larubot\.tokyo|googletagmanager|google-analytics|clarity\.ms|stripe\.com/, (r) => r.abort());
  return { ctx, fonts };
}

async function startDraft(p, width) {
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.removeItem('laruhp.studio.draft:new'); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('足立ホーム工房');
  await p.getByLabel('活動している地域', { exact: false }).first().fill('東京都足立区');
  await p.locator('summary', { hasText: 'もう少し' }).first().click();
  await p.getByLabel('電話番号（載せる場合だけ）').first().fill('03-1234-5678');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.locator('.se-editor').waitFor();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  if (width >= 1000) await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
  else await p.getByRole('button', { name: '色・書体', exact: true }).click();
  await p.locator('.de-editor').waitFor();
}
const srcdoc = (p) => p.locator(CANVAS).getAttribute('srcdoc');

const consoleErrors = [];
try {
  // ───────── パソコン 1440：比較・キャンセル・採用・取り消し・再選択・保存の往復 ─────────
  {
    const { ctx, fonts } = await newContext(1440);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED/.test(m.text())) consoleErrors.push(m.text()); });
    p.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    p.on('requestfailed', (r) => { if (!/_rsc=/.test(r.url())) consoleErrors.push('requestfailed: ' + r.url().slice(0, 90)); });
    await startDraft(p, 1440);
    const s0 = await srcdoc(p);
    const editor = p.locator('.de-editor');
    check('説明文が書体・余白も変わると明示', /書体・余白/.test(await editor.innerText()));

    // 比較を開く（写真で惹きつける）
    await editor.getByRole('button', { name: /写真で惹きつける/ }).click();
    const dialog = p.locator('.dr-dialog');
    await dialog.waitFor();
    await p.waitForTimeout(1500);
    check('比較はモーダル', await dialog.evaluate((el) => el.matches(':modal')));
    check('3案のカードに縮小表示（最初の画面と次の節）', (await dialog.locator('.dr-thumb iframe').count()) === 3);
    const group = dialog.getByRole('radiogroup', { name: '比較する案' });
    const picked = () => group.getByRole('radio', { checked: true });
    check('選択はラジオ3つ・選択中が分かる', (await group.getByRole('radio').count()) === 3 && (await picked().innerText()).includes('写真で惹きつける'));
    const changesB = await dialog.locator('.dr-changes').innerText();
    check('B：採用前に変わる項目を表示（余白・最初の画面・写真が見本の間・動き）', ['節と節のあいだ', '最初の画面', '写真が見本のまま', '表示の動き'].every((t) => changesB.includes(t)), changesB.replace(/\n/g, ' / ').slice(0, 400));
    check('配色は「今の配色のまま」が初期', await dialog.getByLabel('今の配色のまま').isChecked());
    const cand = p.frameLocator('iframe[title="採用前の案"]');
    await cand.locator('h1').waitFor();
    check('B：見本写真では見出しを写真に重ねない（上下に分ける）', (await cand.locator('.lhp-hero.lhp-hero-separated').count()) === 1 && (await cand.locator('.lhp-hero-stage img').count()) === 1);
    await dialog.screenshot({ path: out + '/dialog-B-pc.png' });
    // キーボード：矢印で選び替え
    await picked().focus();
    await p.keyboard.press('ArrowDown');
    check('矢印キーで次の案へ（内容で選んでもらう）', (await picked().innerText()).includes('内容で選んでもらう'));
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    check('矢印キーで前の案へ（言葉で伝える）', (await picked().innerText()).includes('言葉で伝える'));
    check('選択中の案にフォーカスがある', await picked().evaluate((el) => el === document.activeElement));
    await p.waitForTimeout(800);
    const changesA = await dialog.locator('.dr-changes').innerText();
    check('A：採用前に変わる項目を表示（書体・形・最初の画面・順番・寄せ・動き・範囲）', ['書体', '形の雰囲気', '最初の画面', '表示の動き', '効く範囲'].every((t) => changesA.includes(t)), changesA.replace(/\n/g, ' / ').slice(0, 500));
    await dialog.screenshot({ path: out + '/dialog-A-pc.png' });
    // 配色を案の配色に → プレビューだけ変わる
    const bgBefore = await cand.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
    await dialog.getByLabel(/この案の配色にする/).check();
    await p.waitForTimeout(800);
    const bgAfter = await p.frameLocator('iframe[title="採用前の案"]').locator('body').evaluate((b) => getComputedStyle(b).backgroundColor);
    check('案の配色を選ぶとプレビューに反映', bgBefore !== bgAfter, `${bgBefore} → ${bgAfter}`);
    await dialog.getByLabel('今の配色のまま').check();
    // キャンセル
    await dialog.getByRole('button', { name: 'やめる' }).click();
    await p.waitForTimeout(400);
    check('やめる：比較が閉じる', (await p.locator('.dr-dialog').count()) === 0);
    check('やめる：サイトは変わらない', (await srcdoc(p)) === s0);
    check('やめる：取り消し履歴も増えない', await p.getByRole('button', { name: /取り消す/ }).isDisabled());

    // 採用（写真で惹きつける）
    await editor.getByRole('button', { name: /写真で惹きつける/ }).click();
    await p.locator('.dr-dialog').waitFor();
    await p.getByRole('button', { name: 'この案を採用する' }).click();
    const frame = p.frameLocator(CANVAS);
    await frame.locator('body[data-style-direction="immersive"]').waitFor();
    check('採用：見本写真のあいだは上下に分けて表示', (await frame.locator('.lhp-hero-separated').count()) === 1);
    const kept = { h1: await frame.locator('h1').innerText(), tel: await frame.locator('a[href="tel:0312345678"]').first().waitFor({ state: 'attached', timeout: 5000 }).then(() => 1, () => 0), telHrefs: await frame.locator('body').evaluate((b) => [...b.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'))), email: await frame.locator('input[name="email"]').count(), phoneText: await frame.locator('body').evaluate((b) => b.innerText.includes('03-1234-5678')), cta: await frame.locator('body').evaluate((b) => (b.querySelector('.lhp-cta')?.outerHTML || 'none').slice(0, 300)) };
    check('採用：見出し・電話・フォームは残る', kept.h1.includes('足立ホーム工房') && kept.tel > 0 && kept.email > 0 && kept.phoneText, JSON.stringify(kept));
    await p.locator(CANVAS).screenshot({ path: out + '/canvas-B-adopted-pc.png' });
    const sB = await srcdoc(p);
    fs.writeFileSync(out + '/sB.html', sB);
    // 取り消し1回で採用前へ
    await p.getByRole('button', { name: /取り消す/ }).click();
    await p.waitForTimeout(500);
    check('取り消し1回で採用前に戻る（HTMLが完全一致）', (await srcdoc(p)) === s0);
    await p.getByRole('button', { name: /やり直す/ }).click();
    await p.waitForTimeout(500);
    check('やり直しで採用後に戻る', (await srcdoc(p)) === sB);

    // 再選択：B → A（色もテーマに合わせる）→ 同じAをもう一度
    await editor.getByRole('button', { name: /言葉で伝える/ }).click();
    await p.locator('.dr-dialog').waitFor();
    const colors = p.locator('.dr-colors');
    check('個別に入っている色を一覧（問い合わせのボタン等）', (await colors.innerText()).includes('お問い合わせのボタンの色'), (await colors.innerText()).replace(/\n/g, ' / '));
    await colors.getByRole('checkbox').check();
    await p.getByRole('button', { name: 'この案を採用する' }).click();
    await frame.locator('body[data-style-direction="editorial"]').waitFor();
    const sA = await srcdoc(p);
    await editor.getByRole('button', { name: /言葉で伝える/ }).click();
    await p.locator('.dr-dialog').waitFor();
    await p.locator('.dr-colors').count().then(async (n) => { if (n) await p.locator('.dr-colors').getByRole('checkbox').check(); });
    await p.getByRole('button', { name: 'この案を採用する' }).click();
    await p.waitForTimeout(600);
    check('同じ案の再採用で節・CSSが重複しない', (await srcdoc(p)) === sA && (sA.split('.lhp-hero.lhp-hero-separated{').length - 1) === 1);
    check('A：見本写真でも左右分割の最初の画面（分離表示は出ない）', (await frame.locator('.lhp-hero-split').count()) === 1 && (await frame.locator('.lhp-hero-separated').count()) === 0);
    // テーマ追従：配色を変えると問い合わせボタンが追従
    const btn = frame.locator('#contact button[type=submit], #contact .lhp-form button').first();
    const c1 = await btn.evaluate((b) => getComputedStyle(b).backgroundColor);
    await p.getByRole('button', { name: 'やわらかな朱' }).click();
    await p.waitForTimeout(600);
    const c2 = await p.frameLocator(CANVAS).locator('#contact button[type=submit], #contact .lhp-form button').first().evaluate((b) => getComputedStyle(b).backgroundColor);
    check('配色を変えると、テーマに従うボタンが追従', c1 !== c2 && c2 === 'rgb(165, 73, 56)', `${c1} → ${c2}`);
    // 揃い方：最初の画面・見出し・本文・問い合わせの左端
    const lefts = await p.frameLocator(CANVAS).locator('body').evaluate(() => {
      const L = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().left) : null; };
      return { hero: L('.lhp-hero-content h1'), title: L('[data-lhp-block] .lhp-section-title'), para: L('.lhp-text-block > p'), contactTitle: L('#contact > .lhp-section-title'), form: L('#contact form') };
    });
    check('A：最初の画面と見出しの読み始めが揃う', lefts.hero === lefts.title && (lefts.para === null || lefts.para === lefts.title), JSON.stringify(lefts));
    check('A：問い合わせの見出しとフォームの左端が揃う', lefts.contactTitle === lefts.form, JSON.stringify(lefts));
    await p.locator(CANVAS).screenshot({ path: out + '/canvas-A-adopted-pc.png' });

    // 保存 → 読み直し
    await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
    await p.waitForFunction(() => /siteId=/.test(location.search), null, { timeout: 15000 });
    await p.waitForTimeout(800);
    const before = await srcdoc(p);
    const siteId = new URL(p.url()).searchParams.get('siteId');
    await p.goto(base + '/laruHP/studio?siteId=' + siteId, { waitUntil: 'networkidle' });
    await p.frameLocator(CANVAS).locator('body[data-style-direction="editorial"]').waitFor({ timeout: 15000 });
    const after = await srcdoc(p);
    fs.writeFileSync(out + '/before.html', strip(before)); fs.writeFileSync(out + '/after.html', strip(after));
    check('保存して読み直しても、案・配色・役割・動きが残る', strip(after) === strip(before));
    // 公開と同じ書き出し（/api/sites/:id/export-html）とプレビューが一致
    const exported = await (await p.request.get(base + `/api/sites/${siteId}/export-html`)).text();
    fs.writeFileSync(out + '/exported.html', strip(exported));
    check('通常の書き出しとプレビューのHTMLが一致', strip(exported) === strip(after), `${strip(exported).length} vs ${strip(after).length}`);
    await ctx.close();
    await fonts.close();
  }

  // ───────── スマホ 390 / 320：比較の見た目・重なり・はみ出し ─────────
  for (const width of [390, 320]) {
    const { ctx, fonts } = await newContext(width);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${width}: ` + m.text()); });
    await startDraft(p, width);
    for (const [label, id] of [['言葉で伝える', 'editorial'], ['写真で惹きつける', 'immersive'], ['内容で選んでもらう', 'catalog']]) {
      await p.locator('.de-editor').getByRole('button', { name: new RegExp(label) }).click();
      await p.locator('.dr-dialog').waitFor();
      await p.getByRole('button', { name: 'この案を採用する' }).click();
      const f = p.frameLocator(CANVAS);
      await f.locator(`body[data-style-direction="${id}"]`).waitFor();
      await p.waitForTimeout(500);
      const m = await f.locator('body').evaluate(() => {
        const W = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth - W;
        const r = (s) => document.querySelector(s)?.getBoundingClientRect();
        const h1 = r('.lhp-hero h1'), cta = r('.lhp-hero .lhp-btn-primary'), stage = r('.lhp-hero-stage');
        const overlap = (a, b) => !!a && !!b && !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
        return { over, h1Cta: overlap(h1, cta), ctaStage: overlap(cta, stage), ctaH: cta ? Math.round(cta.height) : 0, ctaInside: cta ? cta.left >= 0 && cta.right <= W : false };
      });
      check(`${width} ${id}：横はみ出しなし`, m.over <= 0, JSON.stringify(m));
      check(`${width} ${id}：見出し・ボタン・写真が重ならず、ボタンが画面内で押せる大きさ`, !m.h1Cta && !m.ctaStage && m.ctaInside && m.ctaH >= 44, JSON.stringify(m));
      await p.locator(CANVAS).screenshot({ path: `${out}/canvas-${id}-${width}.png` });
    }
    await ctx.close();
    await fonts.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(out + '/results.json', JSON.stringify({ results, consoleErrors }, null, 1));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  console.log('console errors:', consoleErrors.length, consoleErrors.slice(0, 8));
  if (failed.length) process.exitCode = 1;
}
