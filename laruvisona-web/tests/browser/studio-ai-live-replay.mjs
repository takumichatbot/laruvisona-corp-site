// 実回答の再生：実モデル試験で得た元の回答（記録）を、偽DBの保存済み応答として返し、画面で
// 提案 → 変更前後と本人の情報の確認 → その欄だけ採用 → 取り消し → やり直し → 保存 → 読み直し を通す。
// 新しい実モデルの呼び出しはしない（サーバーは AIMOCK=1 相当で起動しておく）。
//   実行: REPLAY=<ledger.json> CASE_RAW=<呼び出し番号> CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-ai-live-replay.mjs
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const ledger = JSON.parse(readFileSync(process.env.REPLAY, 'utf8'));
const call = ledger.calls.find((c) => c.n === Number(process.env.CASE_RAW || 1));
if (!call?.rawText) throw Error('再生する元の回答が無い');
const FACTS = JSON.parse(call.request.messages[0].content).facts;
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const control = async (body) => (await fetch(fixture + '/__control', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })).json();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
const canvas = () => p.locator(CANVAS).getAttribute('srcdoc');
const saveNow = async () => {
  const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
  await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
  return (await done).request().postDataJSON();
};
let created = '';
try {
  await control({ aiReply: call.rawText });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('足立住まい工房（テスト）');
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

  await p.locator('.se-settings-tabs').getByRole('button', { name: '公開の準備', exact: true }).click();
  await p.locator(`li[data-target-id="${pageId}/${svc.id}/items/0/description"] button`).click();
  await p.locator('[data-jump-assist]').click();
  await p.locator('[data-ai-facts]').fill(FACTS);
  const before = await canvas();
  const done = p.waitForResponse((r) => new URL(r.url()).pathname === '/api/ai/section-proposal' && r.request().method() === 'POST');
  await p.getByRole('button', { name: '変更案をつくる' }).click();
  const resp = await (await done).json();
  const proposed = resp.proposal?.changes?.['items.0.description'];
  check('実回答の再生：採用候補が出る（その欄だけ）', !!proposed && Object.keys(resp.proposal.changes).length === 1, JSON.stringify(resp).slice(0, 300));
  await p.locator('[data-ai-proposal]').waitFor();
  const shown = await p.locator('[data-ai-proposal]').innerText();
  check('採用前に、元の文章・新しい文章・使った本人の情報が見える', shown.includes(example) && shown.includes(proposed) && (await p.locator('[data-ai-used-facts]').innerText()).includes(FACTS));
  check('提案しただけでは文章は変わらない', (await canvas()) === before);
  if (SHOTS) { await p.locator('[data-ai-proposal]').scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await p.screenshot({ path: `${SHOTS}/live-replay-before-after.png` }); }
  await p.getByRole('button', { name: /か所を採用/ }).click();
  await p.waitForFunction((t) => document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), proposed);
  const s1 = await p.evaluate(() => document.querySelector('iframe[title="できあがりの見え方"]').getAttribute('srcdoc'));
  check('その欄だけ採用：ほかの項目・料金・見出しはそのまま', s1.includes(svc.data.items[1].description) && s1.includes(svc.data.items[0].title) && s1.includes(svc.data.heading));
  await p.locator('.se-history-controls button').first().click();
  await p.waitForFunction((t) => !document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), proposed);
  check('取り消すと見本の文章に戻る', (await canvas()).includes(example));
  await p.locator('.se-history-controls button').nth(1).click();
  await p.waitForFunction((t) => document.querySelector('iframe[title="できあがりの見え方"]')?.getAttribute('srcdoc')?.includes(t), proposed);
  const body = await saveNow();
  check('保存する中身に本人の情報（使う情報）は入らない', !JSON.stringify(body).includes(FACTS));
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  const after = await p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, created);
  const svc2 = after.blocks_json.pages[0].blocks.find((b) => b.type === 'services');
  check('保存して読み直すと、採用した文章が残り、ほかはそのまま', svc2.data.items[0].description === proposed && JSON.stringify({ ...svc2.data, items: svc2.data.items.map((it, i) => i === 0 ? { ...it, description: '*' } : it) }) === JSON.stringify({ ...svc.data, items: svc.data.items.map((it, i) => i === 0 ? { ...it, description: '*' } : it) }));
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/live-replay-after-reload.png` });
} finally {
  await control({ aiReply: null }).catch(() => {});
  if (created) await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created).catch(() => {});
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
