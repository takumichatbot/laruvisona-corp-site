// スマホ幅で「比較ダイアログ自体」を使えるか：候補の選択・大きなプレビュー・配色・変わる内容・採用／やめる
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... OUTPUT_DIR=<dir> node tests/browser/style-direction-v1-dialog-sp.mjs
// fixture と next start -p 3319（fixture 向けビルド）が動いていること。ログインは fixture の利用者。
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319';
const out = (process.env.OUTPUT_DIR || '/tmp/laruhp-style-direction') + '/dialog-sp';
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const CANVAS = 'iframe[title="できあがりの見え方"]';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

/** ダイアログの中の要素：画面内に収まるか（スクロールして届くか）・下の操作帯と重ならないか */
const layout = (p) => p.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  const d = document.querySelector('.dr-dialog');
  const footer = d.querySelector('.dr-footer').getBoundingClientRect();
  const r = (s) => { const el = d.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) }; };
  return {
    vw, vh, dialog: r('.dr-dialog') || (() => { const b = d.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; })(),
    footer: { top: Math.round(footer.top), bottom: Math.round(footer.bottom) },
    radios: r('[role=radiogroup]'), preview: r('.dr-preview .de-frame'), palette: r('.dr-palette'), changes: r('.dr-changes'), adopt: r('.de-actions button'),
    hScroll: d.scrollWidth - d.clientWidth,
  };
});
/** その要素まで（ダイアログの中で）スクロールして、見えて押せるか */
const reachable = (p, sel) => p.evaluate((sel) => {
  const el = document.querySelector('.dr-dialog ' + sel); if (!el) return { ok: false, why: 'none' };
  el.scrollIntoView({ block: 'nearest' });
  const b = el.getBoundingClientRect(); const f = document.querySelector('.dr-footer').getBoundingClientRect();
  const visible = b.height > 0 && b.top >= 0 && b.bottom <= f.top + 1 && b.left >= 0 && b.right <= innerWidth + 1;
  const hit = document.elementFromPoint(Math.min(innerWidth - 2, b.left + 8), Math.min(f.top - 2, b.top + Math.min(8, b.height / 2)));
  return { ok: visible && !!hit && (el === hit || el.contains(hit)), top: Math.round(b.top), bottom: Math.round(b.bottom), footerTop: Math.round(f.top), h: Math.round(b.height) };
}, sel);

try {
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, locale: 'ja-JP', isMobile: true, hasTouch: true });
    await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
    await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
    const fonts = await installLocalFonts(ctx);
    const p = await ctx.newPage();
    await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.removeItem('laruhp.studio.draft:new'); } catch {} });
    await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'load' });
    await p.getByLabel('店名・屋号', { exact: false }).first().fill('足立ホーム工房');
    await p.getByLabel('活動している地域', { exact: false }).first().fill('東京都足立区');
    await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
    await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
    await p.locator('.se-editor').waitFor();
    await p.frameLocator(CANVAS).locator('h1').waitFor();
    await p.getByRole('button', { name: '色・書体', exact: true }).click();
    const s0 = await p.locator(CANVAS).getAttribute('srcdoc');
    await p.locator('.de-editor').getByRole('button', { name: /写真で惹きつける/ }).click();
    const dialog = p.locator('.dr-dialog');
    await dialog.waitFor();
    await p.frameLocator('iframe[title="採用前の案"]').locator('h1').waitFor();
    await p.waitForTimeout(800);
    const L = await layout(p);
    fs.writeFileSync(`${out}/layout-${width}.json`, JSON.stringify(L, null, 1));
    await p.screenshot({ path: `${out}/dialog-sp-${width}-open.png` });
    check(`${width}：ダイアログが画面幅に収まり横スクロールなし`, L.dialog.left >= 0 && L.dialog.right <= L.vw + 1 && L.hScroll <= 0, JSON.stringify(L.dialog));
    check(`${width}：大きなプレビューに高さがある（200px以上）`, L.preview && L.preview.h >= 200, JSON.stringify(L.preview));
    check(`${width}：採用・やめるが画面内（44px以上）`, L.adopt && L.adopt.bottom <= L.vh && L.footer.bottom <= L.vh + 1, JSON.stringify({ adopt: L.adopt, footer: L.footer }));
    // 変わる内容は画面より長いので、見出しと最後の項目それぞれに届くかを見る
    for (const [sel, name] of [['[role=radio]:nth-child(3)', '候補（3つ目）'], ['.dr-palette', '配色の選択'], ['.dr-changes h3', '採用すると変わる内容（見出し）'], ['.dr-changes dl > div:last-child', '採用すると変わる内容（最後の項目）'], ['.dr-preview .de-frame', '大きなプレビュー']]) {
      const R = await reachable(p, sel);
      check(`${width}：${name}までスクロールで届き、操作帯と重ならない`, R.ok, JSON.stringify(R));
    }
    // 操作：候補の選択・配色・採用
    await dialog.getByRole('radio', { name: /内容で選んでもらう/ }).click();
    check(`${width}：候補を選べる`, (await dialog.getByRole('radiogroup', { name: '比較する案' }).getByRole('radio', { checked: true }).innerText()).includes('内容で選んでもらう'));
    await dialog.getByText(/この案の配色にする/).scrollIntoViewIfNeeded();
    await dialog.getByText(/この案の配色にする/).click();
    check(`${width}：配色を選べる`, await dialog.getByLabel(/この案の配色にする/).isChecked());
    await dialog.locator('.dr-changes').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/dialog-sp-${width}-changes.png` });
    await p.getByRole('button', { name: 'やめる' }).click();
    await p.waitForTimeout(300);
    check(`${width}：やめる → 閉じて何も変わらない`, (await p.locator('.dr-dialog').count()) === 0 && (await p.locator(CANVAS).getAttribute('srcdoc')) === s0);
    await p.locator('.de-editor').getByRole('button', { name: /写真で惹きつける/ }).click();
    await dialog.waitFor();
    await p.getByRole('button', { name: 'この案を採用する' }).click();
    await p.frameLocator(CANVAS).locator('body[data-style-direction="immersive"]').waitFor({ timeout: 10000 });
    check(`${width}：採用できる`, true);
    await p.getByRole('button', { name: /取り消す/ }).first().click();
    await p.waitForTimeout(600);
    check(`${width}：取り消し1回で採用前（HTML一致）`, (await p.locator(CANVAS).getAttribute('srcdoc')) === s0);
    await ctx.close(); await fonts.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 1));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
