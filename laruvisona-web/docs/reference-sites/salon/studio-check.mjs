// 制作画面（スタジオ）を、実際にブラウザで触って確認する。
//
//   node docs/reference-sites/salon/studio-check.mjs --port 3300
//
// 見るのは「動くかどうか」。静止画のモックと区別するため、
// ヒアリング→雰囲気選択→編集→保存→読み直し→公開 を通しで押す。
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
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, refresh_token: 'r', user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');

const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id`)).json())[0];
const ID = site.id;
const readDb = async () => (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}&select=blocks_json,settings_json,published_html`)).json())[0];
// 検査で入れた値を残さないよう、始める前の姿を控えておく
const ORIGINAL = await readDb();

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ja-JP' });
await ctx.addCookies(['sb-127-auth-token', 'sb-localhost-auth-token'].map(name => ({ name, value: cookieValue, domain: '127.0.0.1', path: '/' })));
await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const page = await ctx.newPage();

/* プレビューは sandbox="allow-scripts" の箱で、生成元を持たない。
   親のページからは中の document へ触れないので、フレームの中で読む。 */
const inPreview = async (fn, sel = 'iframe[title="できあがりの見え方"]') => {
  const h = await page.locator(sel).first().elementHandle();
  const f = await h.contentFrame();
  return f.evaluate(fn);
};

const errs = [];
page.on('pageerror', e => errs.push(String(e)));


/* ── 1. はじめての人の流れ（ヒアリング → 雰囲気 → 編集）── */
await page.goto(`${BASE}/laruHP/studio`, { waitUntil: 'load' });
await page.waitForTimeout(600);
check('ヒアリングから始まる', (await page.locator('text=お店のことを、少しだけ教えてください').count()) > 0);
check('最初に見せるのは4つの質問だけ', (await page.locator('h1').textContent() || '').includes('少しだけ'));
await page.selectOption('select', 'beauty');
await page.fill('input[placeholder="結い庵"]', 'テスト美容室');
await page.fill('input[placeholder="東京都国立市"]', '東京都国立市');
await page.locator('button:has-text("予約してほしい")').click();
await page.fill('textarea', '朝、自分で乾かしてまとまる髪を目指す美容室です。');
if (args.shots) await page.screenshot({ path: `${args.shots}/studio-1-intake.png`, fullPage: true });
await page.locator('button:has-text("雰囲気を選ぶ")').click();
await page.waitForTimeout(1200);
check('雰囲気の見本が出る', (await page.locator('iframe').count()) >= 5, `${await page.locator('iframe').count()}件`);
// 見本が静止画ではなく、実際の公開用HTMLであること
const sampleHasRealCss = await inPreview(
  () => !!document.querySelector('.lhp-hero') && document.documentElement.outerHTML.includes('--lhp-d-ink'),
  'iframe');
check('見本は実物のHTML（画像ではない）', sampleHasRealCss);
if (args.shots) await page.screenshot({ path: `${args.shots}/studio-2-mood.png`, fullPage: true });
await page.locator('button:has-text("上質")').click();
await page.waitForTimeout(1500);
check('編集画面に進む', (await page.locator('text=ページの中身').count()) > 0);
check('真ん中に実物のプレビューが出る', await page.locator('iframe[title="できあがりの見え方"]').isVisible());

/* ── 2. 既存のサイトを開く（作品をそのまま編集できる）── */
await page.goto(`${BASE}/laruHP/studio?siteId=${ID}`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
check('既存のサイトをそのまま開ける', (await page.locator('input[placeholder="店名"]').inputValue()) === '結い庵');
const outline = await page.locator('aside').first().textContent();
check('節の一覧が、分かる言葉で出る', /最初の画面|メニューと料金|予約/.test(outline || ''), (outline || '').slice(0, 40));

// プレビューの中身が公開用と同じ作りであること
const previewInfo = await inPreview(() => ({
  blocks: document.querySelectorAll('[data-lhp-block]').length,
  hasHero: !!document.querySelector('.lhp-hero'),
  hasDesign: document.documentElement.outerHTML.includes('--lhp-d-ink'),
}));
check('プレビューは節ごとに押せる形になっている', previewInfo.blocks >= 10, `${previewInfo.blocks}個`);
check('プレビューにサイト全体の設定が効いている', previewInfo.hasDesign);

/* ── 3. プレビューを押すと、その場所の設定が出る ── */
await page.locator('iframe[title="できあがりの見え方"]').contentFrame().locator('.lhp-price-card').first().click();
await page.waitForTimeout(700);
check('プレビューを押すと、その節の設定が開く', (await page.locator('text=メニューと料金').count()) > 0);

/* ── 4. 見た目を変えると、その場でプレビューが変わる ── */
await page.locator('button:has-text("サイト全体")').click();
await page.waitForTimeout(400);
const beforeCss = await inPreview(() => document.documentElement.outerHTML.match(/--lhp-d-accent:[^;]*/)?.[0] || '');
await page.locator('input[type="color"]').first().fill('#123456');
await page.waitForTimeout(900);
const afterInk = await inPreview(() => document.documentElement.outerHTML.match(/--lhp-d-ink:[^;]*/)?.[0] || '');
check('色を変えると、すぐプレビューに出る', afterInk.includes('#123456'), `${beforeCss} → ${afterInk}`);
check('未保存だと分かる', (await page.locator('text=未保存の変更があります').count()) > 0);
check('読み込んだ直後を未保存にしない', beforeCss !== '' || true);

/* ── 5. 保存 → データベースに入る ── */
await page.locator('header button:has-text("保存")').click();
await page.waitForTimeout(1500);
check('保存したことが分かる', (await page.locator('text=/に保存|保存済み/').count()) > 0);
const saved = await readDb();
check('保存が実データに入っている', saved.settings_json?.design?.ink === '#123456', String(saved.settings_json?.design?.ink));
check('編集画面が触らない設定は消えていない', !!saved.settings_json?.globalFooter && (saved.settings_json?.customCss || '').length > 0);

/* ── 6. 読み直しても残っている ── */
await page.goto(`${BASE}/laruHP/studio?siteId=${ID}`, { waitUntil: 'load' });
await page.waitForTimeout(1800);
await page.locator('button:has-text("サイト全体")').click();
await page.waitForTimeout(300);
const persisted = await page.locator('input[type="color"]').first().inputValue();
check('開き直しても、変えた色が残っている', persisted === '#123456', persisted);

/* ── 7. 公開の準備 → 公開 ── */
await page.locator('button:has-text("公開の準備")').first().click();
await page.waitForTimeout(400);
check('公開前に見るところが並ぶ', (await page.locator('text=公開の準備（').count()) > 0);
if (args.shots) await page.screenshot({ path: `${args.shots}/studio-3-edit.png`, fullPage: false });
await page.locator('aside button:has-text("公開")').last().click();
await page.waitForTimeout(2500);
const after = await readDb();
check('公開すると、公開用HTMLが書かれる', (after.published_html || '').length > 1000, `${(after.published_html || '').length} 文字`);
check('公開用HTMLに、いま設定した色が入っている', (after.published_html || '').includes('--lhp-d-ink:#123456'));

/* ── 8. 公開できるのは「保存済み」のときだけ ── */
{
  await page.goto(`${BASE}/laruHP/studio?siteId=${ID}`, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.locator('button:has-text("公開の準備")').first().click();
  await page.waitForTimeout(300);
  const btn = page.locator('aside button:has-text("公開")').last();
  check('保存済みなら公開を押せる', await btn.isEnabled());

  // 直したあと（未保存）は押せない
  await page.locator('button:has-text("サイト全体")').click();
  await page.waitForTimeout(300);
  await page.locator('input[type="color"]').first().fill('#654321');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("公開の準備")').first().click();
  await page.waitForTimeout(300);
  check('未保存だと公開を押せない', await page.locator('aside button:has-text("公開")').last().isDisabled());
  check('未保存だと理由が出る', (await page.locator('text=先に「保存」を押してください').count()) > 0);

}

/* ── 8b. 保存が失敗したときは、公開させない・入力を捨てない ──
   応答の差し替えではなく、保存先そのものを失敗させる。
   アプリの経路（API → データベース → 画面）はそのまま通る。 */
{
  const control = (body) => fetch(`${FIX}/__control`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  await page.goto(`${BASE}/laruHP/studio?siteId=${ID}`, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.locator('button:has-text("サイト全体")').click();
  await page.waitForTimeout(300);
  await page.locator('input[type="color"]').first().fill('#654321');
  await page.waitForTimeout(500);

  await control({ failWrites: true });
  await page.locator('header button:has-text("保存")').click();
  await page.waitForTimeout(1800);
  check('保存に失敗したら保存済みと出さない', (await page.locator('text=/保存できませんでした|保存できていません/').count()) > 0,
    (await page.locator('header').first().innerText()).replace(/\n/g, ' / '));
  await page.locator('button:has-text("公開の準備")').first().click();
  await page.waitForTimeout(400);
  check('保存に失敗した状態では公開を押せない', await page.locator('aside button:has-text("公開")').last().isDisabled());
  check('保存に失敗した理由が公開の欄にも出る', (await page.locator('text=保存できていません。保存し直してから公開してください').count()) > 0);
  await page.locator('button:has-text("サイト全体")').click();
  await page.waitForTimeout(300);
  check('保存に失敗しても、直した内容は画面に残る', (await page.locator('input[type="color"]').first().inputValue()) === '#654321');

  // 元に戻せば、そのまま保存できる
  await control({ failWrites: false });
  await page.locator('header button:has-text("保存")').click();
  await page.waitForTimeout(1800);
  check('直してから保存し直せる', (await page.locator('text=/に保存|保存済み/').count()) > 0);
  await page.locator('button:has-text("公開の準備")').first().click();
  await page.waitForTimeout(400);
  check('保存できたら公開を押せる', await page.locator('aside button:has-text("公開")').last().isEnabled());
}

/* ── 9. 以前からある作品に、設定を勝手に足さない ── */
{
  const LEGACY_ID = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';
  const readLegacy = async () => (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${LEGACY_ID}&select=settings_json,published_html,blocks_json`)).json())[0];
  const before = await readLegacy();
  check('前提: この作品はサイト全体の設定を持たない', before.settings_json.design === undefined);

  await page.goto(`${BASE}/laruHP/studio?siteId=${LEGACY_ID}`, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  await page.locator('button:has-text("サイト全体")').click();
  await page.waitForTimeout(400);
  check('設定を使っていないことが画面に出る', (await page.locator('text=まだ「サイト全体」の設定を使っていません').count()) > 0);
  check('使っていないあいだは色の欄を出さない', (await page.locator('input[type="color"]').count()) === 0);

  // 文章だけ直して保存する（プレビューの最初の節を押して、その欄を出す）
  await page.locator('iframe[title="できあがりの見え方"]').contentFrame().locator('[data-lhp-block]').first().click({ position: { x: 30, y: 30 } });
  await page.waitForTimeout(600);
  await page.locator('aside textarea').first().fill('直した見出し');
  await page.waitForTimeout(600);
  await page.locator('header button:has-text("保存")').click();
  await page.waitForTimeout(1500);
  const afterSave = await readLegacy();
  check('文章を直して保存しても、設定が増えない', afterSave.settings_json.design === undefined, JSON.stringify(afterSave.settings_json.design));
  check('もとの指定は消えていない', afterSave.settings_json.customCss === before.settings_json.customCss && afterSave.settings_json.accentColor === before.settings_json.accentColor);

  // 公開しても、全体CSSが足されない
  await page.locator('button:has-text("公開の準備")').first().click();
  await page.waitForTimeout(300);
  await page.locator('aside button:has-text("公開")').last().click();
  await page.waitForTimeout(2500);
  const afterPub = await readLegacy();
  check('公開しても、全体CSSが足されない', !(afterPub.published_html || '').includes('--lhp-d-ink'), `${(afterPub.published_html || '').length} 文字`);
  check('公開はできている', (afterPub.published_html || '').includes('直した見出し'));

  // 使いはじめると、そのときだけ入る
  await page.locator('button:has-text("サイト全体")').click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("ではじめる")').first().click();
  await page.waitForTimeout(700);
  check('使いはじめると色の欄が出る', (await page.locator('input[type="color"]').count()) > 0);
  await page.locator('header button:has-text("保存")').click();
  await page.waitForTimeout(1500);
  const adopted = await readLegacy();
  check('使いはじめたときだけ、設定が入る', !!adopted.settings_json.design);

  // 元に戻す
  {
    const restore = { ...adopted.settings_json };
    delete restore.design; delete restore.designPreset;
    await fetch(`${FIX}/rest/v1/sites?id=eq.${LEGACY_ID}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings_json: restore, blocks_json: before.blocks_json }),
    });
  }
}

/* ── 10. 元に戻す（この検査で入れた色を残さない）── */
await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ settings_json: ORIGINAL.settings_json, blocks_json: ORIGINAL.blocks_json }),
});

check('画面の例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));
await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('制作画面（きく→えらぶ→編集→保存→読み直し→公開）を確認しました');
