// はじめての利用者が、案内ページを見てから公開するまでを、実ブラウザで通す。
//
//   node tests/browser/first-run-check.mjs --port 3300 [--shots /tmp/first-run]
//
// 通すのは「開始 → 業種・目的 → 素材と文章 → 編集 → スマホ確認 → 保存 →
// 公開 → 修正して再公開」。診断ではなく、実際に押して、実際のAPIを通す。
//
// 業種は美容室ではなく「整体・治療院」にしてある。基準作品（結い庵）で
// 作り込んだ品質が、別の業種でも通常の経路から出るかを見るため。
//
// 書体は顧客が選んだものを実際に読み込ませる（tests/browser/_local-fonts.mjs）。
// 端末の既定書体のままだと、字面・行間・折り返しが本番と変わってしまう。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';

const args = { port: '3300', 'fixture-port': '54999', shots: '', video: '' };
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

const siteRows = async () => (await (await fetch(`${FIX}/rest/v1/sites?select=id,slug,name,published,published_html,blocks_json,settings_json,industry`)).json());
const before = await siteRows();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 950 }, locale: 'ja-JP',
  ...(args.video ? { recordVideo: { dir: args.video, size: { width: 1440, height: 950 } } } : {}),
});
await ctx.addCookies(['sb-127-auth-token', 'sb-localhost-auth-token'].map(name => ({ name, value: cookieValue, domain: '127.0.0.1', path: '/' })));
const fonts = await installLocalFonts(ctx);
await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

/* ── 1. 案内ページ → 見せ方を選んで、そのまま作りはじめる ── */
await page.goto(`${BASE}/laruHP`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[role="radiogroup"]', { timeout: 20000 });
await page.locator('[role="radio"]:has-text("やわらかい")').click();
await page.waitForTimeout(1200);
check('案内のデモで見せ方を選べる', (await page.locator('[role="radio"][aria-checked="true"]:has-text("やわらかい")').count()) === 1);

const startCta = page.locator('a:has-text("この見せ方で作りはじめる")');
check('選んだ見せ方のまま作りはじめる入口がある', (await startCta.count()) === 1);
const startHref = await startCta.getAttribute('href');
check('入口が、選んだ見せ方を持っていく', startHref === '/laruHP/studio?mood=warm', String(startHref));
if (args.shots) await page.screenshot({ path: `${args.shots}/01-lp-demo.png` });
await startCta.click();

/* ── 2. 制作画面：選んだ見せ方が引き継がれている ── */
await page.waitForURL(/\/laruHP\/studio/, { timeout: 20000 });
await page.waitForSelector('text=何のお店ですか', { timeout: 20000 });
check('案内から制作画面へ、やり直さずに入れる', page.url().includes('mood=warm'));

/* ── 3. きく（4つの質問）── */
await page.locator('select').first().selectOption('clinic');
await page.locator('input').nth(0).fill('のぞみ整体院');
await page.locator('input').nth(1).fill('千葉県船橋市');
await page.locator('.ls-more summary').click();
await page.locator('input').nth(2).fill('デスクワークで肩と腰がつらい人');
await page.locator('button:has-text("相談してほしい")').click();
await page.locator('textarea').fill('体の使い方から見直して、痛みが戻りにくい状態を目指す整体院です。');
if (args.shots) await page.screenshot({ path: `${args.shots}/02-intake.png` });
await page.locator('button:has-text("雰囲気を選ぶ")').first().click();

/* ── 4. えらぶ：案内で選んだものが先頭に出ている ── */
await page.waitForSelector('.ls-mood-options', { timeout: 20000 });
check('案内で選んだ見せ方が、先頭に印つきで出る',
  (await page.locator('text=案内の画面で選んだ').count()) > 0
  && (await page.locator('text=案内で選んだもの').count()) > 0);
const firstCard = page.locator('.ls-mood-options > button').first();
check('先頭が、案内で選んだもの', (await firstCard.locator('text=やわらかい').count()) > 0);
if (args.shots) await page.screenshot({ path: `${args.shots}/03-mood.png` });
await firstCard.click();
await page.getByRole('button', {name:'この見せ方で編集する'}).click();

/* ── 5. ととのえる ── */
await page.waitForSelector('button:has-text("公開の準備")', { timeout: 20000 });
await page.waitForTimeout(1500);
const blockCount = await page.locator('aside').first().locator('[class*="border-l-4"]').count();
check('業種と目的に合わせた並びで、たたき台ができる', blockCount >= 4, `${blockCount}個の節`);

// 見出しを直す（実際に触って、プレビューに出ることを見る）
await page.locator('aside').first().locator('[class*="border-l-4"]').first().click();
const heading = page.locator('aside').last().locator('input, textarea').first();
await heading.fill('のぞみ整体院');
await page.waitForTimeout(900);

/* ── 6. スマホで確かめる ── */
await page.locator('header button:has-text("スマホ")').click();
await page.waitForTimeout(900);
const spWidth = await page.locator('iframe').first().evaluate(el => el.getBoundingClientRect().width);
check('スマホの見え方を、同じ画面で確かめられる', spWidth > 0 && spWidth < 500, `${Math.round(spWidth)}px`);
if (args.shots) await page.screenshot({ path: `${args.shots}/04-edit-sp.png` });
await page.locator('header button:has-text("パソコン")').click();
await page.waitForTimeout(500);

/* ── 7. 保存 ── */
check('保存する前は、未保存だと分かる', (await page.locator('text=未保存の変更があります').count()) > 0);
await page.locator('header button:has-text("保存")').click();
await page.waitForTimeout(2500);
check('保存できたことが分かる', (await page.locator('header >> text=に保存').count()) > 0);

const afterSave = await siteRows();
const made = afterSave.find(s => !before.some(b => b.id === s.id));
check('新しいサイトが実データに入る', !!made, made ? `${made.name} / ${made.slug}` : '見つからない');
check('業種が保存されている', made?.industry === 'clinic', String(made?.industry));
check('中身が保存されている', (made?.blocks_json?.pages?.[0]?.blocks?.length ?? 0) >= 4);

/* ── 8. 公開の準備 → 公開 ── */
await page.locator('header button:has-text("公開の準備")').click();
await page.waitForTimeout(600);
check('公開前に見るところが、2つに分かれて並ぶ',
  (await page.locator('aside >> text=直さないと、来た人に影響が出ること').count()) > 0
  && (await page.locator('aside >> text=直したほうが良いこと').count()) > 0);
if (args.shots) await page.screenshot({ path: `${args.shots}/05-ready.png` });
await page.locator('aside button:has-text("公開")').last().click();
await page.waitForTimeout(2500);

const afterPublish = (await siteRows()).find(s => s.id === made?.id);
check('公開すると、公開用HTMLが書かれる', (afterPublish?.published_html || '').length > 1000, `${(afterPublish?.published_html || '').length} 文字`);
check('公開用HTMLの版が新しい', (afterPublish?.published_html || '').includes('<!--lhpv:12-->'));
check('青の直書きが残っていない',
  !(afterPublish?.published_html || '').replace(/var\([^)]*\)/g, '').includes('#2563eb'));

/* ── 9. 公開URLを、選んだ書体で見る ──
   訪問者と同じ条件にするため、制作画面とは別の（何も持っていない）
   ブラウザで開く。書体の差し替えもこちらへ入れ直す。 */
const viewCtx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'ja-JP' });
const viewFonts = await installLocalFonts(viewCtx);
await viewCtx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const pub = await viewCtx.newPage();
await pub.goto(`${BASE}/hp/${afterPublish.slug}`, { waitUntil: 'networkidle' });
const bodyText = await pub.locator('body').innerText();
check('公開URLに、作った内容が出ている', bodyText.includes('のぞみ整体院'));
const fam = await pub.evaluate(() => getComputedStyle(document.body).fontFamily);
const loaded = await viewFonts.assertLoaded(pub, 'M PLUS Rounded 1c');
check('顧客が選んだ書体が、実際に読み込まれている', loaded, fam);
if (args.shots) await pub.screenshot({ path: `${args.shots}/06-published-pc.png`, fullPage: false });

const pubSp = await viewCtx.newPage();
await pubSp.setViewportSize({ width: 390, height: 844 });
await pubSp.goto(`${BASE}/hp/${afterPublish.slug}`, { waitUntil: 'networkidle' });
const overflow = await pubSp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('スマホで横にはみ出さない', overflow <= 1, `${overflow}px`);
if (args.shots) await pubSp.screenshot({ path: `${args.shots}/07-published-sp.png`, fullPage: false });
await pubSp.close();

/* ── 10. 直して、もう一度公開する ── */
await page.locator('aside').first().locator('[class*="border-l-4"]').first().click();
await page.waitForTimeout(400);
const h2 = page.locator('aside').last().locator('input, textarea').first();
await h2.fill('のぞみ整体院｜船橋');
await page.waitForTimeout(800);
check('直すと、また未保存だと分かる', (await page.locator('text=未保存の変更があります').count()) > 0);
await page.locator('header button:has-text("保存")').click();
await page.waitForTimeout(2500);
await page.locator('header button:has-text("公開の準備")').click();
await page.waitForTimeout(500);
check('公開したあとに直したことが分かる', (await page.locator('text=公開したあとに直した内容があります').count()) > 0);
await page.locator('aside button:has-text("公開")').last().click();
await page.waitForTimeout(2500);

await pub.reload({ waitUntil: 'networkidle' });
check('再公開が、公開URLに出る', (await pub.locator('body').innerText()).includes('のぞみ整体院｜船橋'));
if (args.shots) await pub.screenshot({ path: `${args.shots}/08-republished.png`, fullPage: false });

check('画面の例外が出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));

await viewFonts.close();
await viewCtx.close();
await fonts.close();
await ctx.close();
await browser.close();

console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log(`  - ${n}`)); process.exit(1); }
console.log('はじめての利用者の「開始 → 公開 → 再公開」を、実ブラウザで確認しました');
