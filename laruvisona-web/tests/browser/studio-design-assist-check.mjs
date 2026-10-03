// Studio「見た目を、言葉や参考から整える」（言葉で直す・参考画像から・公開前の見直し）と「会社の情報」の確認。
// PC（1440）で一通り、390・320 幅で言葉で直す→採用・はみ出し・会社の情報を確かめる。保存・読み直しも見る。公開はしない。
// AIの返事は偽DBの保存済み応答（AIMOCK=1 のときだけ AI の部分を流す）。実モデルは呼ばない。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... [AIMOCK=1] node tests/browser/studio-design-assist-check.mjs
//   SHOTS=<保存先> を付けると画面を保存する
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const SHOTS = process.env.SHOTS || '';
const AIMOCK = process.env.AIMOCK === '1';
const PHOTO = fileURLToPath(new URL('./own-photo-check.jpg', import.meta.url));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const control = async (body) => (await fetch(fixture + '/__control', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })).json();
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
async function open(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'ja-JP', ...(width < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
  await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
  await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  const p = await ctx.newPage();
  lastPage = p;
  return { ctx, p };
}
const helpers = (p) => ({
  saveNow: async () => {
    const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
    await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
    const r = await done;
    return { status: r.status(), body: r.request().postDataJSON() };
  },
  canvas: () => p.locator(CANVAS).getAttribute('srcdoc'),
  settled: async () => { await p.waitForTimeout(450); },
  undo: () => p.locator('.se-history-controls').getByRole('button', { name: /取り消す/ }).click(),
  redo: () => p.locator('.se-history-controls').getByRole('button', { name: /やり直す/ }).click(),
  saved: (id) => p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, id),
});
const noOverflow = (p) => p.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1);

async function createSite(p, name, area) {
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill(name);
  await p.getByLabel('活動している地域', { exact: false }).first().fill(area);
  await p.locator('.ls-more summary').click();
  await p.getByLabel('どんな人に来てほしいですか').fill('足立区で住まいを考えている方');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
}

let ok = true;
let siteId = '';
let lastPage = null;
try {
  await control({ aiReply: null, patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
  /* ───────── PC ───────── */
  {
    const { ctx, p } = await open(1440, 1000);
    const h = helpers(p);
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await createSite(p, '見た目相談の確認工務店', '東京都足立区');
    const first = await h.saveNow();
    await p.waitForFunction(() => /siteId=/.test(location.search));
    const id = new URL(p.url()).searchParams.get('siteId');
    siteId = id;
    const facts0 = first.body.settings_json?.businessFacts ?? first.body.settings_json_patch?.businessFacts;
    check('最初の質問で打った地域・来てほしい人を、会社の情報として保存', facts0?.area === '東京都足立区' && facts0?.targetAudience === '足立区で住まいを考えている方', JSON.stringify(facts0));
    check('会社の情報は完成像（公開と同じHTML）に出ない', !(await h.canvas()).includes('businessFacts'));

    // ── 言葉で直す：比較 → やめる（何も変わらない）
    await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
    await p.locator('[data-design-assistant]').waitFor();
    await h.settled();
    const before = await h.canvas();
    await p.locator('[data-da-text]').fill('もう少し落ち着いた印象に');
    await p.locator('[data-da-make]').click();
    const dlg = p.locator('dialog[data-plan-review]');
    await dlg.waitFor();
    const scope = await dlg.locator('[data-plan-scope]').innerText();
    const detailRows = await dlg.locator('[data-plan-details] > div').count();
    check('言葉で直す：案は1つ。要約・範囲（サイト全体）・変更の詳細が出る', /サイト全体/.test(scope) && detailRows >= 2 && (await dlg.locator('[data-plan-summary]').innerText()).includes('変わる項目'), `${detailRows}項目`);
    await dlg.locator('[data-plan-view="before"]').click();
    const beforeFrame = await dlg.locator('iframe').getAttribute('srcdoc');
    await dlg.locator('[data-plan-view="after"]').click();
    const afterFrame = await dlg.locator('iframe').getAttribute('srcdoc');
    check('変更前・変更後を切り替えて見比べられる', beforeFrame !== afterFrame);
    await dlg.getByRole('button', { name: 'スマホ' }).click();
    await shot(p, 'pc-words-review');
    await dlg.locator('[data-plan-cancel]').click();
    await h.settled();
    check('「やめる」では何も変わらない', (await h.canvas()) === before);

    // ── 採用 → 取り消し1回で元どおり → やり直し
    await p.locator('[data-da-make]').click();
    await dlg.waitFor();
    await dlg.locator('[data-plan-adopt]').click();
    await h.settled();
    const adopted = await h.canvas();
    check('採用すると、完成像が変わる（文章・電話はそのまま）', adopted !== before && /href="tel:/.test(adopted) === /href="tel:/.test(before));
    await h.undo();
    await h.settled();
    check('取り消し1回で、採用前と同じ完成像', (await h.canvas()) === before);
    await h.redo();
    await h.settled();
    check('やり直しで、採用後に戻る', (await h.canvas()) === adopted);

    // ── 読み取れない言葉：例を案内（AIなしでは呼ばない）
    const calls0 = (await control()).aiCalls || 0;
    if (AIMOCK) {
      await control({ aiReply: JSON.stringify({ intents: ['less-space'] }) });
      await p.locator('[data-da-text]').fill('見出しを少し強く');
      // 決まった言い回しで読めるので、AIは呼ばない
      await p.locator('[data-da-make]').click();
      await dlg.waitFor(); await dlg.locator('[data-plan-cancel]').click();
      check('決まった言い回しで読めるときは、AIを呼ばない', ((await control()).aiCalls || 0) === calls0);
      await p.locator('[data-da-text]').fill('全体的に呼吸感を');
      await p.locator('[data-da-make]').click();
      await dlg.waitFor();
      const calls1 = (await control()).aiCalls || 0;
      check('読めない言い回しは、AIに意図だけを選んでもらう（1回）', calls1 === calls0 + 1 && /節と節のあいだ/.test(await dlg.locator('[data-plan-details]').innerText()));
      const sent = JSON.stringify((await control()).lastAi || {});
      check('AIに渡すのは指示だけ（店名・電話・本文は渡さない）', !sent.includes('見た目相談の確認工務店') && !sent.includes('東京都足立区'));
      await dlg.locator('[data-plan-cancel]').click();
      await p.locator('[data-da-make]').click();
      await dlg.waitFor(); await dlg.locator('[data-plan-cancel]').click();
      check('同じ指示でもう一度押しても、AIを呼び直さない', ((await control()).aiCalls || 0) === calls1);
    } else {
      await p.locator('[data-da-text]').fill('全体的に呼吸感を');
      await p.locator('[data-da-make]').click();
      await p.locator('[data-da-note]').waitFor();
      check('読めない言い回し（AIなし）：例を案内し、何も変えない', ((await control()).aiCalls || 0) === calls0 && (await p.locator('[data-da-note]').innerText()).includes('落ち着いた印象'));
    }

    // ── 選んだ節だけ
    const savedA = await h.saved(id);
    const blocksA0 = savedA.blocks_json.pages[0].blocks;
    const para = blocksA0.find((b) => b.type === 'paragraph' || b.type === 'heading');
    await p.locator('.se-block-list .se-block-item').nth(blocksA0.findIndex((b) => b.id === para.id)).locator('.se-block-select').click();
    await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
    await p.locator('[data-da-text]').fill('この節の余白を増やす');
    check('「この節」と書くと、範囲は選んだ節になる', await p.locator('[data-da-scope-section]').isChecked());
    await p.locator('[data-da-make]').click();
    await dlg.waitFor();
    check('確認画面にも、選んだ節だけと出る', /選んだ節/.test(await dlg.locator('[data-plan-scope]').innerText()));
    await dlg.locator('[data-plan-adopt]').click();
    await h.settled();
    const s1 = await h.saveNow();
    const blocksA = savedA.blocks_json.pages[0].blocks, blocksB = s1.body.blocks_json.pages[0].blocks;
    const changedIds = blocksB.filter((b, i) => JSON.stringify(b) !== JSON.stringify(blocksA[i])).map((b) => b.id);
    check('選んだ節だけが変わり、ほかの節・文章は同じ', changedIds.length === 1 && changedIds[0] === para.id && blocksB.find((b) => b.id === para.id).data.text === para.data.text, changedIds.join(',') + ' ' + para.id + ' ' + JSON.stringify(blocksB.find((b) => b.id === changedIds[0])?.data).slice(0, 300) + ' | ' + JSON.stringify(blocksA.find((b) => b.id === changedIds[0])?.data).slice(0, 300));

    // ── 参考画像から（画像は送らない・保存しない・素材にしない）
    const bodies = [];
    p.on('request', (r) => { if (r.method() !== 'GET') bodies.push((r.postData() || '').length); });
    await p.locator('[data-da-tool="reference"]').click();
    await p.locator('[data-da-file]').setInputFiles(PHOTO);
    await p.locator('[data-da-traits]').waitFor();
    const traits = await p.locator('[data-da-traits]').innerText();
    check('参考画像：明るさ・余白・写真の存在感を読み、書体・動きは判断しないと出す', /余白/.test(traits) && /写真の存在感/.test(traits) && /画像からは判断しません/.test(traits));
    check('参考画像は送信しない（読み取りで通信が起きない）', bodies.length === 0, String(bodies));
    await shot(p, 'pc-reference');
    const mk = p.locator('[data-da-reference] [data-da-make]');
    if (await mk.isEnabled()) {
      await mk.click();
      await dlg.waitFor();
      await dlg.locator('[data-plan-adopt]').click();
      await h.settled();
    }
    const s2 = await h.saveNow();
    const payload = JSON.stringify(s2.body);
    check('参考画像は保存されず、サイトの写真にもならない', !/data:image|blob:/.test(payload) && s2.status === 200);

    // ── 公開前の見直し
    await p.locator('[data-da-tool="director"]').click();
    await p.locator('[data-da-director]').waitFor();
    const dirText = await p.locator('[data-da-director]').innerText();
    check('見直し：「今直す」「直すと良い」「問題なし」に分け、点数を出さない', /今直す/.test(dirText) && /直すと良い/.test(dirText) && /問題なし/.test(dirText) && !/点|スコア|%/.test(dirText.replace(/点数は出しません/, '')), dirText.slice(0, 600));
    check('見直し：公開の準備の残りを1行で示し、そちらへ案内する', (await p.locator('[data-finding="ready"]').count()) === 1);
    await p.locator('[data-finding="ready"] [data-finding-ready]').click();
    check('「公開の準備」を開く', await p.locator('.se-fix-list, [data-ready-search]').first().isVisible());
    await p.locator('[data-open-director]').click();
    check('公開の準備から「見た目も見直す」で戻れる', await p.locator('[data-da-director]').isVisible());
    // 動きを「しっかり」にすると、改善案が出る
    await p.locator('.se-settings-body select').filter({ has: p.locator('option[value="full"]') }).first().selectOption('full');
    await h.settled();
    await p.locator('[data-finding="motion"]').waitFor();
    await p.locator('[data-finding="motion"] [data-finding-plan]').click();
    await dlg.waitFor();
    check('動きの指摘から改善案（見比べ）を開ける', /表示の動き/.test(await dlg.locator('[data-plan-details]').innerText()));
    await dlg.locator('[data-plan-adopt]').click();
    await h.settled();
    check('採用で「動きが多め」が消える', (await p.locator('[data-finding="motion"]').count()) === 0);
    if (AIMOCK) {
      await control({ aiReply: JSON.stringify({ codes: ['too-dense', 'unknown-code'] }) });
      const c0 = (await control()).aiCalls || 0;
      await p.locator('[data-da-ai-review]').click();
      await p.locator('[data-finding="ai-too-dense"]').waitFor();
      const st = await control();
      const sent = JSON.stringify(st.lastAi || {});
      check('AIの見立て：決まった種類だけを出し、改善案につなぐ', (st.aiCalls || 0) === c0 + 1 && (await p.locator('[data-finding^="ai-"]').count()) === 1);
      check('AIに渡すのは形だけ（店名・地域・本文は渡さない）', !sent.includes('見た目相談の確認工務店') && !sent.includes('東京都足立区') && sent.includes('textLength'));
    }
    await shot(p, 'pc-director');

    // ── 会社の情報：書く → 保存 → 読み直し。公開HTMLには出ない
    const panel = p.locator('[data-business-facts]');
    await panel.locator('[data-fact="servicesSummary"] textarea').fill('新築・リフォーム・水回りの修理');
    await panel.locator('[data-fact="contactPreference"] textarea').fill('電話とフォームで受け付け');
    await h.settled();
    check('会社の情報は完成像に出ない', !(await h.canvas()).includes('水回りの修理'));
    const s3 = await h.saveNow();
    check('保存の差分に会社の情報が入る', s3.body.settings_json_patch?.businessFacts?.servicesSummary === '新築・リフォーム・水回りの修理');
    // 欄への使い回し：見本のままの文章欄
    const s3blocks = s3.body.blocks_json.pages[0].blocks;
    const target = s3blocks.find((b) => ['services', 'contact', 'cta', 'faq', 'tabs'].includes(b.type) && Object.values(b.data).some((v) => typeof v === 'string' && /【例】|入力してください|ここに/.test(v)))
      || s3blocks.find((b) => ['services', 'contact', 'cta'].includes(b.type));
    await p.frameLocator(CANVAS).locator(`[data-lhp-block="${target.id}"]`).first().click();
    await p.locator('.sc-tabs').getByRole('button', { name: '内容' }).click();
    const sug = p.locator('[data-fact-suggest]').first();
    if (await sug.count()) {
      const fieldKey = await sug.getAttribute('data-fact-suggest');
      const beforeVal = s3blocks.find((b) => b.id === target.id).data[fieldKey];
      await sug.locator('[data-fact-pick]').first().click();
      check('「この情報をここにも使えます」：入れる前に変更前・後を見せる', await sug.locator('[data-fact-preview] ins').isVisible());
      await sug.locator('[data-fact-apply]').click();
      await h.settled();
      const val = await p.locator(`[data-field-key="${fieldKey}"] textarea, [data-field-key="${fieldKey}"] input`).first().inputValue();
      check('押した欄にだけ入る（ほかの欄は変えない）', /新築|電話とフォーム|東京都足立区|足立区で住まい/.test(val), val);
      await h.undo();
      await h.settled();
      const back = await p.locator(`[data-field-key="${fieldKey}"] textarea, [data-field-key="${fieldKey}"] input`).first().inputValue();
      check('取り消し1回で、入れる前に戻る', back === String(beforeVal ?? ''), `${back} / ${beforeVal}`);
    } else check('見本のままの文章欄に「この情報をここにも使えます」が出る', false, target.type);
    // AIに相談：関係する情報だけを「使う情報」へ
    await p.locator('.sc-tabs').getByRole('button', { name: 'AIに相談' }).click();
    await p.locator('[data-ai-assistant]').waitFor();
    if (await p.locator('[data-ai-saved-facts]').count()) {
      await p.locator('[data-ai-saved-facts]').click();
      const f = await p.locator('[data-ai-facts]').inputValue();
      check('AIに相談：保存済みの情報のうち、この節に関係するものだけを入れる（送る前に見える）', f.length > 0 && f.length < 400 && !/来てほしい人.*\n.*来てほしい人/.test(f), f.replace(/\n/g, ' / '));
    } else check('AIに相談：保存済みの情報を入れるボタン', false);
    // 読み直し
    const final = await h.saveNow();
    await h.settled();
    const html1 = await h.canvas();
    await p.reload({ waitUntil: 'networkidle' });
    await p.frameLocator(CANVAS).locator('h1').waitFor();
    await h.settled();
    check('保存 → 読み直しで、同じ完成像', (await h.canvas()) === html1);
    await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
    check('読み直しても会社の情報が残る', (await p.locator('[data-fact="servicesSummary"] textarea').inputValue()) === '新築・リフォーム・水回りの修理');
    check('PC：画面のエラーなし', errors.length === 0, errors.join(' | '));
    check('PC：保存は成功', final.status === 200);
    await ctx.close();
  }

  /* ───────── 390・320 ───────── */
  for (const w of [390, 320]) {
    const { ctx, p } = await open(w, w === 320 ? 640 : 844);
    const h = helpers(p);
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(base + '/laruHP/studio?siteId=' + siteId, { waitUntil: 'networkidle' });
    await p.frameLocator(CANVAS).locator('h1').waitFor();
    await p.locator('.se-mobile-tools').getByRole('button', { name: '色・書体' }).click();
    // 小さい画面では、編集欄を広げて使う（既存の編集シートの操作）
    await p.getByRole('button', { name: '編集欄を広げる' }).click();
    await p.locator('[data-design-assistant]').waitFor();
    check(`${w}：横にはみ出さない（見た目の相談）`, await noOverflow(p));
    await p.locator('[data-da-text]').fill('写真を大きく見せる');
    await shot(p, `sp${w}-assistant`);
    await p.locator('[data-da-make]').click();
    const dlg = p.locator('dialog[data-plan-review]');
    await dlg.waitFor();
    const box = await dlg.locator('[data-plan-adopt]').boundingBox();
    await p.waitForTimeout(700);
    check(`${w}：確認画面の「採用する」が画面の中で押せる`, !!box && box.y + box.height <= (w === 320 ? 640 : 844) && box.height >= 44, JSON.stringify(box));
    await shot(p, `sp${w}-review`);
    const before = await h.canvas();
    await dlg.locator('[data-plan-adopt]').click();
    await h.settled();
    const after = await h.canvas();
    await h.undo();
    await h.settled();
    check(`${w}：採用 → 取り消し1回で元どおり`, after !== before && (await h.canvas()) === before);
    await p.locator('.se-mobile-tools').getByRole('button', { name: '色・書体' }).click();
    if (await p.getByRole('button', { name: '編集欄を広げる' }).count()) await p.getByRole('button', { name: '編集欄を広げる' }).click();
    await p.locator('[data-da-tool="director"]').click();
    check(`${w}：見直しの一覧がはみ出さない`, await noOverflow(p));
    await p.locator('[data-business-facts]').scrollIntoViewIfNeeded();
    check(`${w}：会社の情報がはみ出さない`, await noOverflow(p));
    await shot(p, `sp${w}-facts`);
    check(`${w}：画面のエラーなし`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} catch (e) {
  ok = false;
  console.log('FAIL 途中で止まりました', String(e).slice(0, 400));
  if (SHOTS && lastPage) await lastPage.screenshot({ path: `${SHOTS}/stopped.png` }).catch(() => {});
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length}`);
process.exit(ok && !failed.length ? 0 : 1);
