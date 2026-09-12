// 保存できなかったときに、打った内容が失われないこと。
//
//   node tests/browser/studio-recovery-check.mjs --port 3300 [--shots /tmp/recovery]
//
// 独立レビュー（9d32205 / R2）の再現をそのまま検査にしたもの。
//   1. 保存済みサイトを開いて編集 → 保存が401 → 画面の案内どおりに入り直すと、
//      同じサイトの続きから直せる（4つの質問へ戻らない）
//   2. 別のアカウントで開いたときは、その控えを使わない
//   3. 保存している最中に足した編集を、古い保存成功の応答で消さない
//   4. 保存できていないまま閉じようとしたら止める（未保存・保存中・保存失敗のどれでも）
//
// 401・保存の遅延・保存の失敗は、偽Supabase（tests/http/fixture.cjs）の
// 切り替えで作る。ブラウザ側で応答を差し替えるのではなく、アプリの実際の
// 経路（requireUser が落ちて API が401を返す）を通す。
// 実際の認証基盤やDB障害の試験ではない。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';

const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian', shots: '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
const cookies = ['sb-127-auth-token', 'sb-localhost-auth-token'].map(name => ({ name, value: cookieValue, domain: '127.0.0.1', path: '/' }));

const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id`)).json())[0];
const ID = site.id;
const readDb = async () => (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}&select=name,blocks_json`)).json())[0];
const ORIGINAL = await readDb();

const MARK = 'UNSAVED IMPORTANT EDIT';
const DRAFT_KEY = `laruhp.studio.draft:${ID}`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'ja-JP' });
await ctx.addCookies(cookies);
await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());

/** ログインが切れた状態を作る。偽Supabase の /auth/v1/user を401にするので、
    アプリの requireUser() が落ちて、保存APIが実際に401を返す。
    （ブラウザ側で応答を差し替えるのではなく、実際の経路を通す） */
const setAuth = async (ok) => {
  await fetch(`${FIX}/__control`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ failAuth: !ok }),
  });
};
await setAuth(true);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const openStudio = async (p, url) => {
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('header button:has-text("保存")', { timeout: 25000 });
  await p.waitForTimeout(1200);
};
const setName = async (p, v) => {
  const box = p.locator('header input').first();
  await box.fill(v);
  await p.waitForTimeout(700);
};

/* ── 1. 保存済みサイト × 401 ───────────────────────────────── */
await openStudio(page, `${BASE}/laruHP/studio?siteId=${ID}`);
check('保存済みのサイトが、編集画面で開く', (await page.locator('header button:has-text("公開の準備")').count()) > 0);

await setAuth(false);
await setName(page, MARK);
await page.locator('header button:has-text("保存")').click();
await page.waitForTimeout(2000);

check('保存できなかったことが分かる', (await page.locator('header >> text=保存できませんでした').count()) > 0);
const banner = await page.locator('text=保存するにはログインが必要です').count();
check('入り直す案内が出る', banner > 0);
if (args.shots) await page.screenshot({ path: `${args.shots}/01-401.png` });

const draftRaw = await page.evaluate(k => window.localStorage.getItem(k), DRAFT_KEY);
check('打った内容が、この端末に残っている', !!draftRaw && draftRaw.includes(MARK),
  draftRaw ? `${draftRaw.length}文字` : 'null');
const keptSays = await page.locator('text=打った内容は、この端末に残してあります').count();
check('残せたときだけ「残してあります」と言う', (!!draftRaw && keptSays > 0) || (!draftRaw && keptSays === 0));

const href = await page.locator('a:has-text("ログインして戻る")').getAttribute('href');
const backTo = decodeURIComponent((href || '').split('redirectTo=')[1] || '');
check('入り直したあとの戻り先が、同じサイトを指す', backTo === `/laruHP/studio?siteId=${ID}`, backTo || String(href));

/* ── 2. 戻り先を開くと、編集が戻っている ───────────────────── */
await setAuth(true);
const back = await ctx.newPage();
await openStudio(back, `${BASE}${backTo}`);
check('4つの質問へ戻されない', (await back.locator('text=何のお店ですか').count()) === 0);
const restoredName = await back.locator('header input').first().inputValue();
check('保存できなかった編集が戻っている', restoredName === MARK, restoredName);
check('戻したことを画面で知らせる', (await back.locator('text=保存できていなかった編集をこの端末から戻しました').count()) > 0);
check('戻した直後は、まだ未保存', (await back.locator('text=未保存の変更があります').count()) > 0);
if (args.shots) await back.screenshot({ path: `${args.shots}/02-restored.png` });

// 保存すると、控えは消える
await back.locator('header button:has-text("保存")').click();
await back.waitForTimeout(2000);
check('保存できたら「に保存」と出る', (await back.locator('header >> text=に保存').count()) > 0);
const afterSaveDraft = await back.evaluate(k => window.localStorage.getItem(k), DRAFT_KEY);
check('保存できたら、控えは消える', afterSaveDraft === null, String(afterSaveDraft).slice(0, 40));
const db1 = await readDb();
check('保存が実データに入っている', db1.name === MARK, db1.name);
await back.close();

/* ── 3. 別のアカウントでは、その控えを使わない ─────────────── */
const other = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ja-JP' });
await other.addCookies(cookies);
await other.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const op = await other.newPage();
await op.goto(`${BASE}/laruHP/studio?siteId=${ID}`, { waitUntil: 'domcontentloaded' });
// 別のアカウントが残した控え（未来の時刻）を置いてから開き直す
await op.evaluate(([k, mark]) => {
  window.localStorage.setItem(k, JSON.stringify({
    account: 'someone-else-0000-0000-0000-000000000000',
    siteId: k.split(':')[1],
    intake: { industry: 'beauty', name: mark, area: '', audience: '', goal: 'booking', description: '' },
    site: { name: mark, pages: [{ id: 'page-main', name: 'トップページ', path: '/', blocks: [], seo: {} }], settings: {} },
    step: 'edit', at: Date.now() + 600000,
  }));
}, [DRAFT_KEY, 'OTHER ACCOUNT DRAFT']);
await openStudio(op, `${BASE}/laruHP/studio?siteId=${ID}`);
const otherName = await op.locator('header input').first().inputValue();
check('別のアカウントの控えは画面に出さない', otherName !== 'OTHER ACCOUNT DRAFT', otherName);
const otherLeft = await op.evaluate(k => window.localStorage.getItem(k), DRAFT_KEY);
check('別のアカウントの控えは残さない', otherLeft === null, String(otherLeft).slice(0, 30));
await op.close(); await other.close();

/* ── 4. 保存している最中に足した編集を、消さない ───────────── */
const slow = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ja-JP' });
await slow.addCookies(cookies);
await slow.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const sp = await slow.newPage();
await openStudio(sp, `${BASE}/laruHP/studio?siteId=${ID}`);
await setName(sp, 'SAVE ROUND ONE');
// 次の保存だけ、わざと3秒かける（送っている最中に続きを打つ状況を作る）
await fetch(`${FIX}/__control`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ slowWriteMs: 3000 }),
});
await sp.locator('header button:has-text("保存")').click();
await sp.waitForTimeout(600);
check('保存中だと分かる', (await sp.locator('header >> text=保存しています').count()) > 0);
// 送っている最中に、続きを打つ
await setName(sp, 'EDIT DURING SAVE');
await sp.waitForTimeout(4000);   // 1回目の保存が返りきるまで待つ
check('保存中に足した編集は、未保存のまま残る', (await sp.locator('header >> text=未保存の変更があります').count()) > 0);
const nameNow = await sp.locator('header input').first().inputValue();
check('保存中に足した編集が、画面から消えない', nameNow === 'EDIT DURING SAVE', nameNow);
const midDraft = await sp.evaluate(k => window.localStorage.getItem(k), DRAFT_KEY);
check('保存中に足した編集の控えが、消されていない', !!midDraft && midDraft.includes('EDIT DURING SAVE'),
  midDraft ? `${midDraft.length}文字` : 'null');
if (args.shots) await sp.screenshot({ path: `${args.shots}/03-during-save.png` });

/* ── 5. 保存できていないまま閉じようとしたら止める ─────────── */
let asked = 0;
sp.on('dialog', async d => { asked += 1; await d.dismiss(); });
await sp.close({ runBeforeUnload: true });
await new Promise(r => setTimeout(r, 1200));
check('未保存のまま閉じようとしたら止める', asked > 0, `確認 ${asked} 回`);
await slow.close();

// 保存失敗のまま閉じるときも止める
const failCtx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'ja-JP' });
await failCtx.addCookies(cookies);
await failCtx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const fp = await failCtx.newPage();
await openStudio(fp, `${BASE}/laruHP/studio?siteId=${ID}`);
await setName(fp, 'FAILED SAVE EDIT');
// 書き込みを失敗させる（500）
await fetch(`${FIX}/__control`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ failWrites: true }),
});
await fp.locator('header button:has-text("保存")').click();
await fp.waitForTimeout(1800);
check('保存に失敗したことが分かる', (await fp.locator('header >> text=保存できませんでした').count()) > 0);
let asked2 = 0;
fp.on('dialog', async d => { asked2 += 1; await d.dismiss(); });
await fp.close({ runBeforeUnload: true });
await new Promise(r => setTimeout(r, 1200));
check('保存に失敗したまま閉じようとしたら止める', asked2 > 0, `確認 ${asked2} 回`);
await failCtx.close();
await fetch(`${FIX}/__control`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ failWrites: false }),
});

check('画面の例外が出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));

// 元に戻す（検査で入れた値を残さない）
await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: ORIGINAL.name, blocks_json: ORIGINAL.blocks_json }),
});

await ctx.close();
await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log(`  - ${n}`)); process.exit(1); }
console.log('保存できなかったときに、打った内容が失われないことを確認しました');
