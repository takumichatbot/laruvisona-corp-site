// Studio「AIに相談」：本人が書いた事実から、その欄（繰り返し項目の何件目か）の文案を作り、見比べて採用・取り消し。
// AIの返事は偽DBの保存済み応答（tests/http/fixture.cjs の /anthropic/v1/messages）。実モデルは呼ばない。
// サーバーは ANTHROPIC_API_KEY=任意の手元値・ANTHROPIC_BASE_URL=http://127.0.0.1:54999/anthropic で起動しておく。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-ai-facts-check.mjs
//   SHOTS=<保存先> を付けると画面を保存する
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const control = async (body) => (await fetch(fixture + '/__control', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })).json();
const reply = (obj) => control({ aiReply: JSON.stringify(obj) });
const FACTS = '対応地域は足立区と葛飾区。水回りの修理とリフォームに対応。価格は現地確認後に見積もる。';
const GOOD = '足立区・葛飾区で、水回りの修理とリフォームを承ります。費用は現地を確認してからお見積りします。';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
const saveNow = async () => {
  const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
  await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
  return (await done).request().postDataJSON();
};
const canvas = () => p.locator(CANVAS).getAttribute('srcdoc');
const readyTab = () => p.locator('.se-settings-tabs').getByRole('button', { name: '公開の準備', exact: true });
const remaining = async () => Number(((await p.locator('[data-back-to-ready]').innerText()).match(/残り (\d+)/) || [])[1]);
const propose = async () => {
  const done = p.waitForResponse((r) => new URL(r.url()).pathname === '/api/ai/section-proposal' && r.request().method() === 'POST');
  await p.getByRole('button', { name: '変更案をつくる' }).click();
  const r = await done; return { status: r.status(), body: await r.json() };
};

let created = '';
try {
  await control({ aiReply: null, patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('AI文案の確認工務店');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  await saveNow();
  await p.waitForFunction(() => /siteId=/.test(location.search));
  created = new URL(p.url()).searchParams.get('siteId');
  const saved = await p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, created);
  const pageId = saved.blocks_json.pages[0].id;
  const svc = saved.blocks_json.pages[0].blocks.find((b) => b.type === 'services');
  const example = svc.data.items[0].description;
  const calls0 = (await control()).aiCalls || 0;

  // 1) 公開の準備 → サービス1件目の説明 → 案内の「AIに文案を頼む」 → 「この欄だけ」が既定
  await readyTab().click();
  await p.locator(`li[data-target-id="${pageId}/${svc.id}/items/0/description"] button`).click();
  await p.locator('[data-jump-assist]').click();
  await p.locator('[data-ai-assistant]').waitFor();
  const scope = await p.locator('.sc-scope input[type=radio]').first().isChecked();
  check('指摘の欄から「AIに相談」を開くと、範囲は「この欄だけ（1件目の説明）」', scope && /1件目の説明/.test(await p.locator('.sc-scope').innerText()));
  check('「公開の準備に戻る」は「AIに相談」でも出ている', await p.locator('[data-back-to-ready]').isVisible());

  // 2) 見本のままの欄で、本人の情報が無い → 頼めない（理由が出る）。AIは呼ばない
  check('本人の情報が無い見本の欄：頼めず、事実を書くよう案内する', await p.getByRole('button', { name: '変更案をつくる' }).isDisabled() && (await p.locator('[data-ai-assistant]').innerText()).includes('「使う情報」に事実を書くと'));

  // 3) 本人の情報に無い事実（年数・実績）を返した → その欄は外し、文章は変えない
  await p.locator('[data-ai-facts]').fill(FACTS);
  const beforeCanvas = await canvas();
  await reply({ changes: { 'items.0.description': '創業30年の実績で、足立区の水回りに対応します。' }, missing: [] });
  const r1 = await propose();
  const t1 = await p.locator('[data-ai-missing]').innerText();
  check('本人の情報に無い事実が入った案は、採用候補に出さず理由を出す', r1.status === 200 && !r1.body.proposal && /外した欄/.test(t1) && /創業|実績|30/.test(t1) && (await p.locator('[data-ai-proposal]').count()) === 0, t1.replace(/\n/g, ' / '));
  check('外したときは、文章も見本も変えない', (await canvas()) === beforeCanvas && /見本の文章もそのまま/.test(t1));

  // AIへ渡した依頼：見本の文章は渡さず空欄として、本人の事実は facts として
  const sent = JSON.parse((await control()).lastAi.messages[0].content);
  check('AIへは見本の文章を渡さない（空欄の欄として渡す）・本人の事実は facts として分ける',
    !JSON.stringify(sent).includes(example) && !/【例】/.test(JSON.stringify(sent)) && sent.blank.includes('items.0.description') && sent.facts === FACTS && JSON.stringify(sent.allowed) === '["items.0.description"]',
    JSON.stringify(sent).slice(0, 300));

  // 4) 情報が足りない → 必要な情報を短く返し、文章は変えない
  await reply({ changes: {}, missing: ['対応している工事の種類（例：水回り、外壁）'] });
  await propose();
  const t2 = await p.locator('[data-ai-missing]').innerText();
  check('情報が足りないとき：必要な情報を出し、文章は変えない', /この情報があれば書けます/.test(t2) && (await canvas()) === beforeCanvas, t2.replace(/\n/g, ' / '));

  // 5) 本人の事実から書いた案 → 元の文章・新しい文章・使った情報を見比べて採用 → 取り消し
  await reply({ changes: { 'items.0.description': GOOD }, missing: [] });
  await propose();
  await p.locator('[data-ai-proposal]').waitFor();
  const shown = await p.locator('[data-ai-proposal]').innerText();
  check('採用前に、元の文章・新しい文章・使った本人の情報が見える', shown.includes(example) && shown.includes(GOOD) && (await p.locator('[data-ai-used-facts]').innerText()).includes(FACTS) && /1件目の説明/.test(shown));
  check('提案しただけでは、文章は変わらない', (await canvas()) === beforeCanvas);
  if (SHOTS) { await p.locator('[data-ai-proposal]').scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/06-pc-ai-before-after.png` }); }
  const remain0 = await remaining();
  await p.getByRole('button', { name: /か所を採用/ }).click();
  await p.waitForFunction((t) => document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), GOOD);
  const remain1 = await remaining();
  check('採用すると、その項目の説明だけが変わり、残りの指摘が1つ減る', remain1 === remain0 - 1, `${remain0} → ${remain1}`);
  const after = await p.evaluate(() => document.querySelector('iframe[title="できあがりの見え方"]').getAttribute('srcdoc'));
  check('ほかの項目・料金はそのまま（見本の印も残る）', after.includes(svc.data.items[1].description) && after.includes(svc.data.items[0].price ?? ''));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/07-pc-ai-adopted.png` });
  await p.locator('.se-history-controls button').first().click();
  await p.waitForFunction((t) => !document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), GOOD);
  check('取り消すと、見本の文章に戻る（指摘も戻る）', (await canvas()).includes(example) && (await remaining()) === remain0);
  await p.locator('.se-history-controls button').nth(1).click();
  await p.waitForFunction((t) => document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), GOOD);

  // 6) 古い提案：提案のあとに文章が変わった（取り消し）→ 古い提案では上書きしない
  await reply({ changes: { 'items.0.description': '足立区と葛飾区で、水回りの修理とリフォームに対応しています。' }, missing: [] });
  await propose();
  await p.locator('[data-ai-proposal]').waitFor();
  await p.locator('.se-history-controls button').first().click();   // 採用した文章 → 見本へ戻る
  await p.waitForFunction((t) => !document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), GOOD);
  const stale = await canvas();
  await p.getByRole('button', { name: /か所を採用/ }).click();
  check('提案のあとに文章が変わったら、古い提案では上書きしない', (await canvas()) === stale && /提案後に文章が変わりました/.test(await p.locator('[data-ai-assistant]').innerText()));
  await p.locator('.se-history-controls button').nth(1).click();   // 採用した状態へ戻す

  // 7) 保存 → 読み直しで残る。本人の情報（facts）は保存・公開しない
  const body = await saveNow();
  check('保存する中身に、本人の情報（使う情報）は入らない', !JSON.stringify(body).includes(FACTS));
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  check('読み直しても、採用した文章が残る', (await canvas()).includes(GOOD));
  const pub = await p.evaluate(async (id) => { await fetch('/api/sites/' + id + '/publish', { method: 'POST' }); return (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site.published_html || ''; }, created);
  const meta = Buffer.from((pub.match(/<!--lhpmeta:([A-Za-z0-9+/=]+)-->/) || [, ''])[1], 'base64').toString('utf8');
  check('公開HTML・lhpmeta に、本人の情報そのもの・AI用の項目は入らない', pub.includes(GOOD) && !pub.includes(FACTS) && !/facts|allowed|blank/.test(meta), meta.slice(0, 120));
  check('AIを呼んだのは、押した回数だけ（自動・裏での連続呼び出しなし）', ((await control()).aiCalls || 0) - calls0 === 4, `${((await control()).aiCalls || 0) - calls0}`);

  // 8) 契約前：AIが使えない理由がその場で分かり、手で直して指摘を減らせる
  await control({ patchProfile: { id: OWNER, patch: { plan: null, subscription_status: null } } });
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  await readyTab().click();
  const flow = saved.blocks_json.pages[0].blocks.find((b) => b.type === 'tabs');
  await p.locator(`li[data-target-id="${pageId}/${flow.id}/items/0/body"] button`).click();
  await p.locator('[data-jump-assist]').click();
  await p.locator('[data-ai-unavailable]').waitFor();
  const note = await p.locator('[data-ai-unavailable]').innerText();
  check('契約前：「AIに相談」で、ご契約中のプランで使えることと、手で書けることが出る（エラーに見せない）', /ご契約中のプランで使えます/.test(note) && /手で書けます/.test(note) && (await p.locator('[data-ai-assistant] [role=alert]').count()) === 0 && await p.getByRole('button', { name: '変更案をつくる' }).isDisabled(), note);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/08-pc-ai-before-contract.png` });
  await p.locator('.sc-tabs').getByRole('button', { name: '内容', exact: true }).click();
  const r0 = await remaining();
  await p.locator('[data-field-path="items.0.body"] textarea').fill('お電話かフォームでご相談ください。');
  check('契約前：手で直すと、残りの指摘が減る', (await remaining()) === r0 - 1);
  check('契約前：AIは呼ばれていない', ((await control()).aiCalls || 0) - calls0 === 4);
} finally {
  await control({ aiReply: null, patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } }).catch(() => {});
  if (created) await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created).catch(() => {});
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
