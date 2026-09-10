// ビルダーの画面から、実際に触って保存し、読み直して保持されることを確認する。
//
//   node docs/reference-sites/salon/builder-save-check.mjs --port 3300
//
// JSONに設定できることではなく、「利用者が画面のチェックを触って、保存を押して、
// 開き直しても残っているか」を見る。保存は実際の PUT /api/sites/<id> を通る。
// fixture への直接の書き込みはしない。
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM
  ? process.env.PLAYWRIGHT_FROM + '/'
  : import.meta.url);
const { chromium } = require('playwright');

const args = { port: '3300', 'fixture-port': '54999', slug: 'yuian' };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const BASE = `http://127.0.0.1:${args.port}`;
const FIX = `http://127.0.0.1:${args['fixture-port']}`;

const ok = [], ng = [];
const check = (name, pass, detail = '') => {
  (pass ? ok : ng).push(name);
  console.log(`${pass ? 'OK  ' : 'NG  '}${name}${detail ? ` … ${detail}` : ''}`);
};

const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const session = {
  access_token: 'stub-access-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub-refresh',
  user: { id: OWNER, email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' },
};
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');

const seed = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id`)).json())[0];
const ID = seed.id;
const readSite = async () => (await (await fetch(`${FIX}/rest/v1/sites?id=eq.${ID}&select=blocks_json,settings_json`)).json())[0];
const bookingData = s => s.blocks_json.pages[0].blocks.find(b => b.type === 'booking').data;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, locale: 'ja-JP' });
await ctx.addCookies(['sb-127-auth-token', 'sb-localhost-auth-token'].map(name => ({
  name, value: cookieValue, domain: '127.0.0.1', path: '/',
})));
await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
// 初回案内は本題ではないので、見終わった状態から始める
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('laruHP_builder_tour_done', '1');
    localStorage.setItem('laruHP_tour_done', '1');
  } catch { /* noop */ }
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

// 保存API（PUT）が実際に呼ばれたことを数える
let puts = 0;
page.on('request', r => { if (r.method() === 'PUT' && r.url().includes(`/api/sites/${ID}`)) puts++; });

const open = async () => {
  await page.goto(`${BASE}/laruHP/builder?siteId=${ID}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-block-id="s-11"]', { timeout: 20000 });
  await page.waitForTimeout(600);
};
const selectBooking = async () => {
  await page.locator('[data-block-id="s-11"]').click({ position: { x: 20, y: 20 } });
  await page.waitForSelector('#bk-sticky-cta', { timeout: 10000 });
};
const saveAndWait = async () => {
  const before = puts;
  await page.getByRole('button', { name: /保存|未保存/ }).first().click();
  for (let i = 0; i < 60 && puts === before; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(400);
  return puts > before;
};

await open();
check('ビルダーが保存済みのサイトを開ける', await page.locator('[data-block-id="s-11"]').isVisible());
await selectBooking();
const initial = await page.locator('#bk-sticky-cta').isChecked();
check('予約ブロックの設定に固定CTAの項目がある', true, `初期値 ${initial ? 'オン' : 'オフ'}`);

// ── 1. 画面で外して保存 ──
const beforeSettings = (await readSite()).settings_json;
await page.locator('#bk-sticky-cta').setChecked(false);
check('画面のチェックを外せる', (await page.locator('#bk-sticky-cta').isChecked()) === false);
check('保存が実際の保存APIを呼ぶ', await saveAndWait());
check('保存後、データベース側もオフになっている', bookingData(await readSite()).stickyCta === false);

// ビルダーが扱わない設定が、保存で消えていないこと
{
  const after = (await readSite()).settings_json;
  check('保存でフッター設定が消えていない',
    JSON.stringify(after.globalFooter) === JSON.stringify(beforeSettings.globalFooter),
    after.globalFooter ? 'あり' : '消えた');
  check('保存で顧客CSSが消えていない', (after.customCss || '').length > 500, `${(after.customCss || '').length}文字`);
  check('保存でビルダー外の設定（style）が消えていない', after.style === beforeSettings.style, String(after.style));
}

// ── 2. 開き直して保持されている ──
await open();
await selectBooking();
check('開き直してもオフのまま', (await page.locator('#bk-sticky-cta').isChecked()) === false);
check('文言欄はオフのときに出ない', (await page.locator('#bk-sticky-cta-text').count()) === 0);

// ── 3. 画面で戻して保存 → 開き直して保持 ──
await page.locator('#bk-sticky-cta').setChecked(true);
await page.waitForSelector('#bk-sticky-cta-text');
await page.fill('#bk-sticky-cta-text', 'ご予約フォームへ');
check('戻す保存も保存APIを呼ぶ', await saveAndWait());
await open();
await selectBooking();
check('開き直してもオンのまま', (await page.locator('#bk-sticky-cta').isChecked()) === true);
check('文言も保持されている', (await page.locator('#bk-sticky-cta-text').inputValue()) === 'ご予約フォームへ');
check('データベース側もオンになっている', bookingData(await readSite()).stickyCta === true);

// ── 4. その状態で公開すると、公開HTMLに固定CTAが出る ──
{
  const pub = await page.evaluate(async id => {
    const r = await fetch(`/api/sites/${id}/publish`, { method: 'POST' });
    return r.status;
  }, ID);
  check('ビルダーと同じセッションで公開できる', pub === 200, `HTTP ${pub}`);
  const html = await (await fetch(`${BASE}/hp/${args.slug}`)).text();
  check('公開HTMLに固定CTAが出る', html.includes('lhp-sticky-cta"'));
  check('その文言も出ている', html.includes('>ご予約フォームへ</a>'));
}

check('ビルダーで例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));

await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('ビルダー画面での 変更 → 保存 → 再読込 → 公開 を確認しました');
