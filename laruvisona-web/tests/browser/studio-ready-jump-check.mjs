// Studio：「公開の準備」の指摘から、その節の「内容」の、その欄（繰り返し項目の何件目か）まで進めること。
// 開くだけではデータも取り消し履歴も変えない。直すと数が減り、「公開の準備に戻る」で残りが見える。
// 書き方の案内は欄の近くだけに出て、完成像・公開HTMLには入らない。PC と 390 / 320 幅。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-ready-jump-check.mjs
//   SHOTS=/mnt/user-data/outputs/... を付けると、画面を保存する
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const newPage = async (viewport) => {
  const ctx = await browser.newContext({ viewport, locale: 'ja-JP', hasTouch: viewport.width < 900, isMobile: viewport.width < 900 });
  await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
  await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  return ctx.newPage();
};
const shot = async (p, name) => { if (SHOTS) { await p.waitForTimeout(800); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
/** 「例文の判定」と同じ言い回し（lib/placeholder-text.ts）で、保存済みの中身の例文の数を数える */
const PH = [/入力してください/, /を入力(?![ぁ-んァ-ヶ一-龯])/, /ここに/, /【例】/, /サンプル/, /ドラッグで好きな位置に置けます/, /サブテキスト（任意）/];
const countPlaceholders = (v, key = '') => typeof v === 'string' ? (key !== 'bgImageAlt' && PH.some((r) => r.test(v)) ? 1 : 0)
  : Array.isArray(v) ? v.reduce((n, x) => n + countPlaceholders(x), 0)
  : v && typeof v === 'object' ? Object.entries(v).reduce((n, [k, x]) => n + countPlaceholders(x, k), 0) : 0;

/** 開く前後で変わってはいけないもの：完成像（＝データ）、取り消し・やり直しの状態、保存の状態 */
const snapshot = (p) => p.evaluate(() => ({
  undo: document.querySelector('.se-history-controls button:nth-child(1)')?.disabled,
  redo: document.querySelector('.se-history-controls button:nth-child(2)')?.disabled,
  header: document.querySelector('header')?.innerText,
  canvas: document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc'),
}));
const readyTab = (p) => p.locator('.se-settings-tabs').getByRole('button', { name: '公開の準備', exact: true });
const targets = (p) => p.locator('.se-fix-list li[data-target-id]');
const active = (p) => p.evaluate(() => {
  const el = document.querySelector('[data-jump-active]');
  const pane = document.querySelector('.se-settings-body');
  const field = el?.querySelector('textarea, input:not([type=color]):not([type=checkbox]), button') || el;
  const r = field?.getBoundingClientRect(), pr = pane?.getBoundingClientRect();
  return { path: el?.getAttribute('data-field-path'), focusedInside: !!el && el.contains(document.activeElement),
    // 上に貼り付く「内容／見せ方／AIに相談」に隠れていないこと
    focusTag: document.activeElement?.tagName, inView: !!r && !!pr && r.top >= Math.max(pr.top, document.querySelector('.sc-tabs')?.getBoundingClientRect().bottom ?? 0) - 1 && r.top < pr.bottom,
    guide: el?.parentElement?.querySelector('[data-jump-guide]')?.innerText || el?.querySelector('[data-jump-guide]')?.innerText || '' };
});
const saveNow = async (p) => {
  const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
  await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
  return (await done).request().postDataJSON();
};

let created = '';
let p;
try {
  // ── PC：工事・施工の下書きを作り、保存（所有サイトにする） ──
  p = await newPage({ width: 1440, height: 1000 });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('指摘の確認工務店');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  await saveNow(p);
  await p.waitForFunction(() => /siteId=/.test(location.search));
  created = new URL(p.url()).searchParams.get('siteId');
  const saved = await p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, created);
  const top = saved.blocks_json.pages[0].blocks;

  // 1) 一覧：節 → 項目 → 問題 → 操作。件数は実際の判定から
  await readyTab(p).click();
  const phList = p.locator('ul.se-fix-list').first();
  const phLabel = await phList.getAttribute('aria-label');
  const phCount = Number(phLabel.match(/(\d+) か所/)?.[1]);
  check('例文の指摘の数が、保存済みの中身の例文の数と同じ', phCount === countPlaceholders(top.map((b) => b.data)) && phCount > 0, `${phCount} / ${countPlaceholders(top.map((b) => b.data))}`);
  const rows = await targets(p).evaluateAll((els) => els.map((li) => ({ id: li.dataset.targetId, text: li.innerText.replace(/\n/g, ' / ') })));
  check('各指摘に 節 → 項目・問題・操作 が出る', rows.length > 0 && rows.every((r) => / → /.test(r.text) && /(見本の文章|見本の写真)/.test(r.text) && /(編集する|写真を選ぶ|これまでの編集画面)/.test(r.text)), rows.slice(0, 3).map((r) => r.text).join(' | '));
  check('「直さないと困ること」「直したほうが良いこと」の区別はそのまま', (await p.getByText('直さないと、来た人に影響が出ること').count()) === 1 && (await p.getByText('直したほうが良いこと').count()) === 1);
  check('採点・完成率のような根拠の無い数字は出さない', !/(点|完成率|％|%)/.test(await p.locator('.se-settings-body').innerText()));
  await shot(p, '01-pc-ready-list');

  // 2) 繰り返し項目（サービスの2件目の説明）を開く
  const svc = top.find((b) => b.type === 'services');
  const svcId = `${saved.blocks_json.pages[0].id}/${svc.id}/items/1/description`;
  const before = await snapshot(p);
  await p.locator(`li[data-target-id="${svcId}"] button`).click();
  await p.waitForSelector('[data-jump-active]');
  const a1 = await active(p);
  check('繰り返し項目：その節の「内容」の、2件目の説明の欄まで進み、入力欄に移る', a1.path === 'items.1.description' && a1.focusedInside && a1.inView, JSON.stringify(a1));
  check('「内容」の編集タブが開いている', (await p.locator('.sc-tabs button[aria-pressed=true]').innerText()) === '内容');
  const selIndex = await p.evaluate(() => [...document.querySelectorAll('.se-block-item')].findIndex((el) => el.getAttribute('data-selected') === 'true'));
  check('節の一覧でも、指摘の節が選ばれている（部品IDで特定）', selIndex === top.findIndex((b) => b.id === svc.id), `${selIndex}`);
  check('書き方の案内が欄の近くに出る（工事・施工向け）', /工事の内容|対応している範囲/.test(a1.guide), a1.guide);
  const after = await snapshot(p);
  check('開いただけでは、データ・取り消し履歴・保存の状態が変わらない', JSON.stringify(before) === JSON.stringify(after), JSON.stringify({ undo: [before.undo, after.undo], same: before.canvas === after.canvas, header: before.header === after.header }));
  check('完成像に書き方の案内は入らない', !/data-jump-guide|se-jump-guide|書き方/.test(after.canvas.replace(/<title>[^<]*<\/title>/, '')));
  const back = p.locator('[data-back-to-ready]');
  const remain0 = Number((await back.innerText()).match(/残り (\d+)/)?.[1]);
  check('「公開の準備に戻る」に残りの数が出る', remain0 === rows.length, `${remain0} / ${rows.length}`);
  await shot(p, '02-pc-field-from-ready-with-guide');

  // 3) 日本語変換しながら直す：変換中に欄が消えたり、入力欄から外れたりしない
  const field = p.locator('[data-jump-active] textarea, [data-jump-active] input').first();
  await field.fill('');
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Input.imeSetComposition', { text: 'みずまわり', selectionStart: 5, selectionEnd: 5 });
  const mid = await active(p);
  await cdp.send('Input.insertText', { text: '水回りの修理と、キッチン・浴室のリフォーム。費用は現地確認のあと見積ります。' });
  const a2 = await active(p);
  check('日本語変換中も、確定後も、同じ欄にいる', mid.path === 'items.1.description' && mid.focusedInside && a2.path === 'items.1.description' && a2.focusedInside, JSON.stringify([mid.path, mid.focusedInside, a2.focusedInside]));
  const remain1 = Number((await back.innerText()).match(/残り (\d+)/)?.[1]);
  check('直すと、残りの数が1つ減る（判定し直し）', remain1 === remain0 - 1, `${remain0} → ${remain1}`);
  check('直すと、取り消せる（取り消し履歴につながる）', (await snapshot(p)).undo === false);

  // 4) 戻る → 直した指摘は一覧から消え、ほかは残る
  await back.click();
  check('「公開の準備」に戻り、直した指摘は消えている', (await targets(p).count()) === rows.length - 1 && (await p.locator(`li[data-target-id="${svcId}"]`).count()) === 0);
  // 取り消すと、指摘も戻る（「完了」の印だけで消す仕組みではない）
  // （空にする・書く、の2つの操作になるので、取り消しも2回まで）
  let undos = 0;
  while (undos < 3 && !(await p.locator(`li[data-target-id="${svcId}"]`).count())) { await p.locator('.se-history-controls button').first().click(); undos++; await p.waitForTimeout(150); }
  check('取り消すと、同じ指摘がまた出る（中身で判定している）', (await targets(p).count()) === rows.length, `取り消し ${undos} 回`);
  for (let i = 0; i < undos; i++) { await p.locator('.se-history-controls button').nth(1).click(); await p.waitForTimeout(150); }
  await p.waitForFunction((n) => document.querySelectorAll('.se-fix-list li[data-target-id]').length === n, rows.length - 1);

  // 4b) 繰り返し項目（流れの1件目）にキーボードで1文字ずつ打つ → 取り消し1回で打つ前に戻る（1文字ずつ分かれない）
  const flowB = top.find((b) => b.type === 'tabs');
  await p.locator(`li[data-target-id="${saved.blocks_json.pages[0].id}/${flowB.id}/items/0/body"] button`).click();
  await p.waitForSelector('[data-jump-active]');
  const ta = p.locator('[data-jump-active] textarea').first();
  const beforeTyping = await ta.inputValue();
  await ta.evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
  await p.keyboard.type('（運営で確認）', { delay: 30 });
  check('繰り返し項目に1文字ずつ打てる', (await ta.inputValue()) === beforeTyping + '（運営で確認）', JSON.stringify([beforeTyping, await ta.inputValue()]));
  await p.locator('.se-history-controls button').first().click();
  check('取り消し1回で、打つ前の文章に戻る（1文字ずつに分かれない）', (await ta.inputValue()) === beforeTyping, await ta.inputValue());
  await p.locator('.se-history-controls button').nth(1).click();
  check('やり直し1回で、打った文章に戻る', (await ta.inputValue()) === beforeTyping + '（運営で確認）');
  await p.locator('.se-history-controls button').first().click();
  await readyTab(p).click();

  // 5) 写真の指摘：最初の画面の写真の欄（写真を選ぶボタン）まで
  const heroId = `${saved.blocks_json.pages[0].id}/${top.find((b) => b.type === 'hero').id}/bgImage//`;
  await p.locator(`li[data-target-id="${heroId}"] button`).click();
  await p.waitForSelector('[data-jump-active]');
  const a3 = await active(p);
  check('写真の指摘：最初の画面の写真の欄まで進む', a3.path === 'bgImage' && a3.focusedInside && a3.inView, JSON.stringify(a3));

  // 6) 別の節を選ぶと、案内と印は外れる。戻っても勝手に動かない
  await p.frameLocator(CANVAS).locator('h1').click();
  check('別の節（の欄）へ移ると、前の案内は出ない', (await p.locator('[data-jump-guide]').count()) === 0 || (await active(p)).path !== 'items.1.description');

  // 7) 保存 → 公開HTMLに書き方の案内・制作画面の印が入らない
  await saveNow(p);
  const pub = await p.evaluate(async (id) => { await fetch('/api/sites/' + id + '/publish', { method: 'POST' }); return (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site.published_html || ''; }, created);
  check('公開HTMLに、書き方の案内・指摘の印が入らない', pub.length > 0 && !/data-jump|se-jump|se-fix|data-field-path|書き方<\/b>/.test(pub) && !pub.includes('対応している範囲を。'), `len=${pub.length}`);
  await p.context().close();

  // ── スマホ幅：390 / 320 ──
  for (const width of [390, 320]) {
    const m = await newPage({ width, height: 780 });
    await m.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
    await m.frameLocator(CANVAS).locator('h1').waitFor();
    await m.getByRole('navigation', { name: '編集の操作' }).getByRole('button', { name: '選んだ場所' }).click();
    await readyTab(m).click();
    const list = targets(m);
    await list.first().waitFor();
    const n = await list.count();
    const noHScroll = await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    check(`${width}px：「公開の準備」の一覧が出て、横にはみ出さない`, n > 0 && noHScroll, `n=${n}`);
    if (width === 390) await shot(m, '03-390-ready-list');
    // 流れ（繰り返し項目）の2件目を開く
    const flow = top.find((b) => b.type === 'tabs');
    const flowId = `${saved.blocks_json.pages[0].id}/${flow.id}/items/1/body`;
    const btn = m.locator(`li[data-target-id="${flowId}"] button`);
    await btn.scrollIntoViewIfNeeded();
    const bb = await btn.boundingBox();
    check(`${width}px：「編集する」は押しやすい大きさ（高さ44px以上）`, bb && bb.height >= 44, JSON.stringify(bb));
    await btn.tap();
    await m.waitForSelector('[data-jump-active]');
    const am = await active(m);
    const sheet = await m.evaluate(() => ({ tool: document.querySelector('.se-editor')?.getAttribute('data-mobile-tool'), tabsShown: getComputedStyle(document.querySelector('.se-settings')).display !== 'none' }));
    check(`${width}px：同じ編集シートの中で、流れの2件目の欄まで進む（重ねて開かない）`, am.path === 'items.1.body' && am.inView && sheet.tool === 'settings' && (await m.locator('.se-settings').count()) === 1, JSON.stringify({ ...am, ...sheet }));
    check(`${width}px：案内が欄の近くに出る`, am.guide.length > 0, am.guide);
    const f = m.locator('[data-jump-active] textarea, [data-jump-active] input').first();
    await f.fill('');
    await f.type('お電話かメールで');
    check(`${width}px：入力中も同じ欄にいて、横にはみ出さない`, (await active(m)).focusedInside && await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (width === 390) await shot(m, '04-390-field-from-ready');
    const backM = m.locator('[data-back-to-ready]');
    await backM.scrollIntoViewIfNeeded();
    await backM.tap();
    check(`${width}px：「公開の準備に戻る」で一覧に戻り、直した指摘は消える`, (await targets(m).count()) === n - 1 && (await m.locator(`li[data-target-id="${flowId}"]`).count()) === 0);
    if (width === 390) await shot(m, '05-390-back-to-ready');
    await m.context().close();
  }
} finally {
  if (created) {
    const c = await browser.newContext(); await c.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
    const q = await c.newPage(); await q.goto(base + '/laruHP/studio'); await q.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created);
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
