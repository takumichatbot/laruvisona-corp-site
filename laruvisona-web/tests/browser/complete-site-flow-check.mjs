// 工務店で一本通す：業種選択 → 初期下書き → 見た目の案 → 公開の準備 → 指摘から欄へ → 文章を直す → 写真を差し替え
// → 公開の準備へ戻る → （情報が足りない欄を残して）保存 → 読み直し → 残りを直す → 保存 → 読み直し。
// 同じ手順・同じ本人情報で、変更前（f14caed）と変更後を比べる。
//   MODE=after  BASE=http://127.0.0.1:3319 … 指摘の「編集する」から欄へ
//   MODE=before BASE=http://127.0.0.1:3320 … 変更前：節の一覧から節を選び、欄までスクロールして探す
// 数えるもの：欄に着くまでの操作（クリック・スクロール）、公開の準備との往復、入力、かかった時間（自動操作の値）。
// 自動操作の時間は、初めて使う人の使いやすさの証明ではない（場所を知っている前提の最短の値）。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... MODE=after node tests/browser/complete-site-flow-check.mjs
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const MODE = process.env.MODE === 'before' ? 'before' : 'after';
const base = process.env.BASE || (MODE === 'before' ? 'http://127.0.0.1:3320' : 'http://127.0.0.1:3319');
const OUT = process.env.OUT || '/tmp/claude-0/flow';
mkdirSync(OUT, { recursive: true });
const CANVAS = 'iframe[title="できあがりの見え方"]';
const PHOTO = new URL('./own-photo-check.jpg', import.meta.url).pathname;
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };

/** 所有者が用意した公開用の情報（手元の確認用。第三者の実績は使わない）。欄 → 文章 */
const OWNER = {
  'services:items.0.title': '水回りの修理',
  'services:items.0.description': '蛇口・トイレ・給湯まわりの水漏れや故障を修理します。費用は現地を確認してからお見積りします。',
  'services:items.1.title': '内装リフォーム',
  'services:items.1.description': '床・壁紙・収納など、お部屋単位のリフォームを承ります。',
  'services:items.2.title': '外壁・屋根の点検',
  'services:items.2.description': '外壁や屋根の傷みを点検し、必要な補修をご提案します。',
  'three-col:col1Text': '足立区と葛飾区を中心に、ご自宅まで伺います。',
  'three-col:col2Text': '請負工事は、リフォーム瑕疵保険に加入しています。',
  'three-col:col3Text': '工期と費用は、現地を確認したうえで、お見積りの際にお伝えします。',
  'tabs:items.0.body': 'お電話かお問い合わせフォームからご連絡ください。',
  'tabs:items.1.body': 'ご自宅に伺い、気になる箇所とご要望を確認します。',
  'tabs:items.2.body': '内容と費用をご説明し、ご納得いただいてから工事に入ります。',
};
/** 1回目は、本人がまだ決めていない欄として残す（情報不足で止まれるか） */
const LATER = 'three-col:col2Text';   // 「許可・保険」：本人が確かめてから書く
const PH = [/入力してください/, /を入力(?![ぁ-んァ-ヶ一-龯])/, /ここに/, /【例】/, /サンプル/, /ドラッグで好きな位置に置けます/, /サブテキスト（任意）/];
const isPh = (v) => typeof v === 'string' && PH.some((r) => r.test(v));
/** 保存済みの中身から「例文の欄」を数える（節の順・項目の順） */
function placeholderFields(blocks) {
  const out = [];
  blocks.forEach((b, bi) => {
    for (const [k, v] of Object.entries(b.data || {})) {
      if (b.type === 'hero' && k === 'bgImageAlt') continue;
      if (Array.isArray(v)) v.forEach((it, i) => {
        if (typeof it === 'string') { if (isPh(it)) out.push({ bi, block: b, path: `${k}.${i}`, value: it }); return; }
        for (const [s, sv] of Object.entries(it || {})) if (isPh(sv)) out.push({ bi, block: b, path: `${k}.${i}.${s}`, value: sv });
      });
      else if (isPh(v)) out.push({ bi, block: b, path: k, value: v });
    }
  });
  return out;
}
/** 指摘のID（lib/readiness-targets.ts：ページID/部品ID/項目/位置/中の項目） */
const tid = (pageId, f) => { const [field, idx = '', sub = ''] = f.path.split('.'); return [pageId, f.block.id, field, idx, sub].join('/'); };
const getAt = (data, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), data);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
const api = () => p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, created);
const saveNow = async () => {
  const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
  await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
  return (await done).request().postDataJSON();
};
const readyTab = () => p.locator('.se-settings-tabs').getByRole('button', { name: '公開の準備', exact: true });
const pane = () => p.locator('.se-settings-body');
/**
 * 数えるもの（自動操作の値。場所を知っている前提の最短の数で、初めて使う人の所要時間ではない）
 *   arrive … 直す欄へ着くためのクリック（指摘の「編集する」、節の一覧の節、欄そのもの）
 *   ready  … 公開の準備を開く・戻るクリック（「公開の準備」タブ、「公開の準備に戻る」）
 *   other  … そのほかの画面の切り替え（今回の手順では使わない）
 *   scroll … 編集欄のスクロール（ホイール1回 = 300px）
 *   input  … 文字の入力（欄1つで1回）
 *   upload … 写真ファイルを選ぶ
 *   save   … 保存
 * 以前の roundTrips は「公開の準備を開く・戻るクリックの回数」（最初に開く1回を含む）で、行って戻る往復の数ではなかった。
 */
const c = { arrive: 0, ready: 0, other: 0, scroll: 0, input: 0, upload: 0, save: 0 };
const metrics = { mode: MODE, base, fields: [], counts: c, locateMs: 0, typeMs: 0 };

async function openReady() { await readyTab().click(); c.ready++; }
async function backToReady() {
  if (MODE === 'after' && await p.locator('[data-back-to-ready]').count()) await p.locator('[data-back-to-ready]').click();
  else await readyTab().click();
  c.ready++;
}
/** 節の一覧から節を選ぶ（変更前の行き方。変更後でも使えるが、今回の変更後の経路では使わない） */
async function selectBlock(bi) {
  await p.locator('.se-block-select').nth(bi).click(); c.arrive++;
  await p.waitForTimeout(150);
}
/** 開いている編集欄の中で、欄が見えるまでスクロールして押す（新旧とも同じ） */
async function inPanel(f, sameValueOrdinal) {
  let clicks = 0, scrolls = 0;
  // 欄：同じ値の欄のうち、その節の中で何番目か（人は目で探す。ここでは値で見つける）
  const handle = await p.evaluateHandle(({ value, ord }) => [...document.querySelectorAll('.se-settings-body textarea, .se-settings-body input')].filter((el) => el.value === value)[ord] || null, { value: f.value, ord: sameValueOrdinal });
  const el = handle.asElement();
  if (!el) throw Error('欄が見つからない: ' + f.path);
  const box = await pane().boundingBox();
  for (let i = 0; i < 40; i++) {
    const r = await el.boundingBox();
    if (r && r.y >= box.y + 60 && r.y + Math.min(r.height, 40) <= box.y + box.height) break;
    // ホイール1回ぶん（300px）。この環境の自動操作ではホイールで編集欄が動かないので、同じ量を直接動かす
    await pane().evaluate((el, dy) => { el.scrollTop += dy; }, r && r.y < box.y + 60 ? -300 : 300); scrolls++;
    await p.waitForTimeout(60);
  }
  await el.click(); clicks++;
  c.arrive += clicks; c.scroll += scrolls;
  return el;
}
/** 変更後：指摘の「編集する」から欄へ（欄に入力カーソルが入る） */
async function jump(targetId) {
  await p.locator(`li[data-target-id="${targetId}"] button`).click(); c.arrive++;
  await p.waitForSelector('[data-jump-active]');
  return (await p.$('[data-jump-active] textarea, [data-jump-active] input:not([type=file])')) || (await p.$('[data-jump-active]'));
}

let created = '';
try {
  // ── 業種選択 → 初期下書き → 見た目の案 ──
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('足立住まい工房（確認用）');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
  await p.locator('.de-editor').getByRole('button', { name: /内容で選んでもらう/ }).click();
  await p.getByRole('button', { name: 'この案を採用する' }).click();
  await p.frameLocator(CANVAS).locator('body[data-style-direction]').waitFor();
  await saveNow();
  await p.waitForFunction(() => /siteId=/.test(location.search));
  created = new URL(p.url()).searchParams.get('siteId');
  const start = await api();
  const blocks0 = start.blocks_json.pages[0].blocks;
  const pageId = start.blocks_json.pages[0].id;
  const fields = placeholderFields(blocks0);
  metrics.placeholderFields = fields.length;
  metrics.styleDirection = start.settings_json.styleDirection;
  check('初期下書き：工事・施工で保存され、見た目の案が入る', start.industry === 'construction' && !!start.settings_json.styleDirection, `${start.industry} / ${start.settings_json.styleDirection}`);
  check('初期下書きの例文の欄は、本人情報の表と一致する（手元の確認データ）', fields.every((f) => OWNER[`${f.block.type}:${f.path}`]), fields.map((f) => `${f.block.type}:${f.path}`).join(' '));

  // ── 公開の準備 → 欄 → 直す（1回目：本人が決めていない欄は残す） ──
  // 新旧とも「その画面で使える自然な最短経路」で進める。同じ節の欄は続けて直す（どちらにも、毎回戻ることを強いない）。
  //   変更後：節の最初の欄は指摘の「編集する」から。同じ節の残りは、開いている編集欄の中で続けて直す。
  //           次の節へは「公開の準備に戻る」→ 次の指摘（公開の準備の一覧は、変更前には無い案内）
  //   変更前：最初に公開の準備で節の名前を見る。そのあと節の一覧から節を選び、欄までスクロールして直す。
  //           節の名前は分かっているので、節ごとに公開の準備へは戻らない
  await openReady();
  metrics.readyStart = { detail: ((await pane().innerText()).match(/残っている場所：[^。]*。/) || [''])[0], listed: await p.locator('li[data-target-id]').count() };
  const t0 = Date.now();
  const firstPass = fields.filter((f) => `${f.block.type}:${f.path}` !== LATER);
  const sections = [...new Set(firstPass.map((f) => f.bi))];
  for (const [si, bi] of sections.entries()) {
    const group = firstPass.filter((f) => f.bi === bi);
    for (const [gi, f] of group.entries()) {
      const ord = fields.filter((g) => g.bi === f.bi && g.value === f.value).indexOf(f);
      const t1 = Date.now(), a0 = c.arrive, s0 = c.scroll, r0 = c.ready;
      let el;
      if (MODE === 'after' && gi === 0) {
        if (si > 0) await backToReady();
        el = await jump(tid(pageId, f));
        if (`${f.block.type}:${f.path}` === 'tabs:items.0.body') metrics.guide = await p.locator('[data-jump-guide]').innerText().catch(() => '');
      } else {
        if (MODE === 'before' && gi === 0) await selectBlock(f.bi);
        el = await inPanel(f, ord);
      }
      metrics.locateMs += Date.now() - t1;
      const t2 = Date.now();
      await el.fill(OWNER[`${f.block.type}:${f.path}`]); c.input++;
      metrics.typeMs += Date.now() - t2;
      metrics.fields.push({ field: `${f.block.type}:${f.path}`, arrive: c.arrive - a0, scroll: c.scroll - s0, ready: c.ready - r0 });
    }
  }

  // ── 写真を差し替える（最初の画面の見本写真 → 自分の写真） ──
  const hero = blocks0.find((b) => b.type === 'hero');
  if (MODE === 'after') {
    await backToReady();
    await p.locator(`li[data-target-id="${pageId}/${hero.id}/bgImage//"] button`).click(); c.arrive++;
    await p.waitForSelector('[data-jump-active]');
  } else {
    await selectBlock(blocks0.indexOf(hero));
    const box = await pane().boundingBox();
    for (let i = 0; i < 30 && !(await p.locator('[data-field-key=bgImage]').isVisible() && (await p.locator('[data-field-key=bgImage]').boundingBox()).y < box.y + box.height - 40); i++) {
      await pane().evaluate((el) => { el.scrollTop += 300; }); c.scroll++; await p.waitForTimeout(60);
    }
  }
  const upload = p.waitForResponse((r) => r.url().endsWith('/api/images/upload') && r.request().method() === 'POST');
  await p.locator('[data-field-key=bgImage] input[type=file]').setInputFiles(PHOTO); c.upload++;
  const up = await upload;
  check('写真の差し替え：実際のアップロードで自分の写真が入る', up.ok(), `${up.status()}`);
  await p.waitForTimeout(300);
  // 残りを確かめる（新旧とも1回）
  await backToReady();
  metrics.firstPassMs = Date.now() - t0;
  await p.screenshot({ path: `${OUT}/${MODE}-ready-after-first-pass.png` });

  // ── 情報が足りない欄を残したまま保存 → 読み直し：何が残っているか分かる ──
  await saveNow(); c.save++;
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  await openReady();
  const readyText = await pane().innerText();
  const mid = await api();
  const midBlocks = mid.blocks_json.pages[0].blocks;
  const later = fields.find((f) => `${f.block.type}:${f.path}` === LATER);
  check('情報が足りない欄は、見本のまま下書き保存できる（勝手に埋めない）', getAt(midBlocks[later.bi].data, later.path) === later.value);
  check('読み直すと「例文のままの場所」が残っていることが出る', /例文のままの場所が残っていない/.test(readyText) && /このまま公開すると困ることが/.test(readyText));
  if (MODE === 'after') {
    const left = await p.locator('li[data-target-id]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\n/g, ' ')));
    check('変更後：残りの指摘は、その欄だけ（節 → 項目まで分かる）', left.length === 1 && /特徴2の説明/.test(left[0]), left.join(' | '));
  } else {
    metrics.beforeReadyDetail = (readyText.match(/残っている場所：[^。]*。/) || [''])[0];
  }
  await p.screenshot({ path: `${OUT}/${MODE}-ready-info-missing.png` });

  // ── 残りを直す → 保存 → 読み直し ──
  const a2 = c.arrive, s2 = c.scroll;
  let el2;
  if (MODE === 'after') el2 = await jump(tid(pageId, later));
  else { await selectBlock(later.bi); el2 = await inPanel(later, 0); }
  await el2.fill(OWNER[LATER]); c.input++;
  metrics.fields.push({ field: LATER, arrive: c.arrive - a2, scroll: c.scroll - s2, pass: 2 });
  await backToReady();
  await saveNow(); c.save++;
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  const end = await api();
  const blocks1 = end.blocks_json.pages[0].blocks;
  metrics.industryAfterReload = end.industry;
  check('保存 → 読み直し：業種は工事・施工のまま（保存値）', end.industry === 'construction', end.industry);
  if (MODE === 'after') check('保存 → 読み直し：書き方の案内も工事・施工向け（同じ業種を参照）', /現地確認/.test(metrics.guide || ''), metrics.guide);
  check('保存 → 読み直し：見た目の案はそのまま', end.settings_json.styleDirection === start.settings_json.styleDirection && !!(await p.frameLocator(CANVAS).locator(`body[data-style-direction="${start.settings_json.styleDirection}"]`).count()));
  check('直した欄はすべて本人の文章で残る', fields.every((f) => getAt(blocks1[f.bi].data, f.path) === OWNER[`${f.block.type}:${f.path}`]));
  check('例文のままの欄は0（文字列置換ではなく、欄ごとに本人の文章）', placeholderFields(blocks1).length === 0);
  check('写真は自分の写真に替わり、見本写真の印は外れる', blocks1[blocks0.indexOf(hero)].data.bgImage !== hero.data.bgImage && !/^サンプル写真。/.test(blocks1[blocks0.indexOf(hero)].data.bgImageAlt || ''));
  // 直していない文章・設定は変わらない
  const strip = (bl) => bl.map((b, i) => {
    const d = structuredClone(b.data);
    for (const f of fields.filter((x) => x.bi === i)) { const ks = f.path.split('.'); const last = ks.pop(); const o = ks.reduce((a, k) => a[k], d); o[last] = '*'; }
    if (b.type === 'hero') { d.bgImage = '*'; d.bgImageAlt = '*'; delete d.imageFocal; delete d.bgImageWidth; delete d.bgImageHeight; }   // 写真の差し替えに付く値（前の写真の大きさは外れる）
    return { id: b.id, type: b.type, d };
  });
  const diff = JSON.stringify(strip(blocks0)) === JSON.stringify(strip(blocks1));
  const changedKeys = diff ? [] : strip(blocks0).flatMap((b, i) => { const a = b.d, c = strip(blocks1)[i]?.d || {}; return [...new Set([...Object.keys(a), ...Object.keys(c)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(c[k])).map((k) => `${b.type}.${k}: ${JSON.stringify(a[k])?.slice(0, 60)} → ${JSON.stringify(c[k])?.slice(0, 60)}`); });
  check('直していない文章・節・並びは変わらない', diff, changedKeys.join(' | '));
  const settingsSame = JSON.stringify(start.settings_json) === JSON.stringify(end.settings_json);
  check('サイトの設定（配色・書体・見た目の案など）は変わらない', settingsSame, settingsSame ? '' : JSON.stringify(Object.keys(end.settings_json).filter((k) => JSON.stringify(end.settings_json[k]) !== JSON.stringify(start.settings_json[k]))));
  await readyTab().click();
  const finalReady = await pane().innerText();
  check('公開の準備：例文の指摘は無くなる', !/このまま公開すると困ることが/.test(finalReady) || !/例文のままの場所/.test(finalReady.split('直したほうが良いこと')[0].replace(/✓[^\n]*例文のままの場所が残っていない/, '')), finalReady.split('\n').slice(0, 3).join(' / '));
  await p.screenshot({ path: `${OUT}/${MODE}-ready-final.png` });
  metrics.totalMs = Date.now() - t0;
} finally {
  if (created) await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created).catch(() => {});
  await browser.close();
  metrics.totalClicks = c.arrive + c.ready + c.other + c.save;
  writeFileSync(`${OUT}/${MODE}-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ ...metrics, fields: undefined }, null, 0));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
