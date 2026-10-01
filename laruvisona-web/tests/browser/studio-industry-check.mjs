// Studio：本人が選んだ業種が、保存・読み直し・見た目の案の選び直しのあとも残ること。
// 業種が無い以前のサイトに、既定の業種（美容など）を書き込まないこと。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-industry-check.mjs
// fixture と next start -p 3319（fixture 向けビルド）が動いていること。ログインは fixture の利用者。
import { createRequire } from 'node:module';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319', fixture = 'http://127.0.0.1:54999';
const LEGACY = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
await ctx.addInitScript(() => { try { Object.defineProperty(navigator.serviceWorker, 'register', { value: () => Promise.reject(Error('offline')) }); } catch {} });
await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
const api = (id) => p.evaluate(async (id) => (await (await fetch('/api/sites/' + id, { cache: 'no-store' })).json()).site, id);
/** 完成像の og:image に付く業種（書き出しが使う業種）。無ければ '' */
const canvasIndustry = async () => ((await p.locator(CANVAS).getAttribute('srcdoc')) || '').match(/og:image" content="[^"]*?industry=([a-z-]+)/)?.[1] || '';
const saveNow = async () => {
  const done = p.waitForResponse((r) => /\/api\/sites(\/[^/]+)?$/.test(new URL(r.url()).pathname) && ['PUT', 'POST'].includes(r.request().method()));
  await p.locator('header').getByRole('button', { name: '保存', exact: true }).click();
  return (await done).request().postDataJSON();
};
const editHeading = async (text) => {
  await p.frameLocator(CANVAS).locator('h1').click();
  const f = p.locator('[data-field-key=heading] textarea, [data-field-key=heading] input').first();
  await f.fill(text);
};
let created = '';
try {
  // 1) 新規：工事・施工を選んで作る → 保存
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.goto(base + '/laruHP/studio?industry=construction', { waitUntil: 'networkidle' });
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('業種の確認工房');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  const body1 = await saveNow();
  await p.waitForFunction(() => /siteId=/.test(location.search));
  created = new URL(p.url()).searchParams.get('siteId');
  check('新規作成：選んだ業種で保存される', (await api(created)).industry === 'construction' && body1.industry === 'construction', JSON.stringify({ sent: body1.industry }));

  // 2) 読み直す → 業種は工事・施工のまま。編集して保存しても変わらない
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  check('読み直し：書き出しの業種も工事・施工（美容に戻らない）', (await canvasIndustry()) === 'construction', await canvasIndustry());
  await editHeading('業種の確認工房（見出しを直した）');
  const body2 = await saveNow();
  check('読み直して保存：業種は送らず（保存済みと同じ）、保存後も工事・施工', !('industry' in body2) && (await api(created)).industry === 'construction');

  // 3) 見た目の案を選び直して保存しても、業種は変わらない
  await p.locator('.se-settings-tabs').getByRole('button', { name: 'サイト全体', exact: true }).click();
  await p.locator('.de-editor').getByRole('button', { name: /内容で選んでもらう/ }).click();
  await p.getByRole('button', { name: 'この案を採用する' }).click();
  await p.frameLocator(CANVAS).locator('body[data-style-direction="catalog"]').waitFor();
  await saveNow();
  check('案を選び直して保存：業種は工事・施工のまま', (await api(created)).industry === 'construction' && (await canvasIndustry()) === 'construction');

  // 4) 別サイトへ切り替え：業種が無い以前のサイト。工事・施工も美容も引き継がない・書き込まない
  await fetch(fixture + '/__control', { method: 'POST', body: JSON.stringify({ patchSite: { id: LEGACY, patch: { industry: null } } }) });
  await p.goto(base + '/laruHP/studio?siteId=' + LEGACY, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  check('業種が無いサイト：書き出しに業種を付けない（推測しない）', (await canvasIndustry()) === '', await canvasIndustry());
  await editHeading('以前からある見出し（直した）');
  const body4 = await saveNow();
  check('業種が無いサイトを保存：業種を送らず、保存後も空のまま', !('industry' in body4) && (await api(LEGACY)).industry == null, JSON.stringify((await api(LEGACY)).industry));

  // 5) もう一度、最初のサイトへ戻る → 工事・施工
  await p.goto(base + '/laruHP/studio?siteId=' + created, { waitUntil: 'networkidle' });
  await p.frameLocator(CANVAS).locator('h1').waitFor();
  check('元のサイトへ戻る：工事・施工のまま', (await canvasIndustry()) === 'construction');
  // 偽DBの利用者は作成上限（3件）がある。先に片付ける
  await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created); created = '';
  // 6) 一覧の「新しいサイト」で作った空のサイト（業種なし）→ 最初の質問で業種を選ぶ → 保存で業種が入る
  const empty = await p.evaluate(async () => (await (await fetch('/api/sites', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '新しいサイト', blocks_json: { v: 2, pages: [] }, seo_json: {}, settings_json: {} }) })).json()).site?.id);
  await p.goto(base + '/laruHP/studio?siteId=' + empty, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '飲食店・カフェ', exact: true }).first().click();
  await p.getByLabel('店名・屋号', { exact: false }).first().fill('業種の確認カフェ');
  await p.getByRole('button', { name: /雰囲気を選ぶ/ }).first().click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).first().click();
  await p.frameLocator(CANVAS).locator('h1').waitFor({ timeout: 8000 }).catch(async (e) => { await p.screenshot({ path: '/tmp/claude-0/industry-step6.png' }); console.log('URL', p.url(), (await p.locator('body').innerText()).slice(0, 300)); throw e; });
  const body6 = await saveNow();
  check('空のサイトで業種を選ぶ：保存で業種が入る', body6.industry === 'restaurant' && (await api(empty)).industry === 'restaurant', JSON.stringify({ sent: body6.industry }));
  await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), empty);
} finally {
  if (created) await p.evaluate(async (id) => fetch('/api/sites/' + id, { method: 'DELETE' }), created);
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
