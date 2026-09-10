// 実際の /api/contact に、実際に送って確かめる。
//
//   node docs/reference-sites/salon/api-contract-check.mjs --port 3300
//
// booking-check.mjs との違い:
//   booking-check.mjs …… 応答を route.fulfill で差し替える。画面側（押せる・
//                         戻れる・入力が残る）を見るための検証で、サーバは通らない。
//   このファイル      …… 差し替えを一切しない。ブラウザからの送信も、直接の
//                         POST も、実際の Next のルート /api/contact が受ける。
//                         受け取った内容は fixture の contacts に残るので、
//                         「何が届いたか」まで確認できる。
//
// 隔離環境（fixture + next start）で動かす。外部へは出ない。
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

const site = (await (await fetch(`${FIX}/rest/v1/sites?slug=eq.${args.slug}&select=id,published`)).json())[0];
check('対象のサイトがある', !!site && site.published === true, site?.id);
if (!site) process.exit(1);

const contacts = async () => (await (await fetch(`${FIX}/rest/v1/contacts?select=*`)).json());
// 送信元IPごとに数える作りなので、確認ごとに別のIPを名乗る（互いに影響しない）
let ipSeq = 0;
const post = (body, ip) => fetch(`${BASE}/api/contact`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip || `203.0.113.${++ipSeq}` },
  body: JSON.stringify(body),
});

// ── 1. 必須項目（siteId / name / email）──
{
  const r = await post({ siteId: site.id, type: 'booking', name: '齋藤 匠', phone: '090-0000-0000', message: 'カット' });
  const b = await r.json().catch(() => ({}));
  check('名前と電話だけでは受け付けない', r.status === 400 && b.error === 'Missing required fields',
    `HTTP ${r.status} ${JSON.stringify(b)}`);
}
{
  const r = await post({ type: 'booking', name: '齋藤 匠', email: 'a@example.com' });
  check('siteId が無ければ受け付けない', r.status === 400, `HTTP ${r.status}`);
}
{
  const r = await post({ siteId: site.id, type: 'booking', email: 'a@example.com' });
  check('名前が無ければ受け付けない', r.status === 400, `HTTP ${r.status}`);
}
{
  const r = await post({ siteId: 'id-c', type: 'booking', name: '齋藤 匠', email: 'a@example.com' });
  check('公開していないサイトへは届かない', r.status === 404, `HTTP ${r.status}`);
}
{
  const before = (await contacts()).length;
  const r = await post({ siteId: site.id, type: 'booking', name: 'bot', email: 'bot@example.com', _hp: 'x' });
  const b = await r.json().catch(() => ({}));
  const after = (await contacts()).length;
  check('自動投稿（隠し欄）は記録しない', r.ok && b.ok === true && after === before, `HTTP ${r.status} 件数 ${before}→${after}`);
}
{
  const before = (await contacts()).length;
  const r = await post({ siteId: site.id, type: 'booking', name: '直接 太郎', email: 'direct@example.com', phone: '', message: 'カット\n2026-09-20 10:00' });
  const b = await r.json().catch(() => ({}));
  const rows = await contacts();
  const row = rows[rows.length - 1];
  check('必須が揃えば受け付ける', r.ok && b.ok === true, `HTTP ${r.status} ${JSON.stringify(b)}`);
  check('受け付けた内容が記録される', rows.length === before + 1 && row?.name === '直接 太郎' && row?.email === 'direct@example.com',
    JSON.stringify(row && { name: row.name, email: row.email, type: row.type }));
}

// ── 2. 送信元ごとの回数制限 ──
{
  const ip = '198.51.100.7';
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await post({ siteId: site.id, type: 'booking', name: `連投 ${i}`, email: 'many@example.com' }, ip);
    last = r.status;
  }
  check('同じ送信元からの連投は止まる', last === 429, `6回目 HTTP ${last}`);
}

// ── 3. ブラウザから、差し替えなしで実際に送る ──
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
// 外部の書体・計測タグだけは遮断する（/api/contact には触れない）
await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
const page = await ctx.newPage();
const posts = [];
page.on('request', r => { if (r.method() === 'POST' && /\/api\/contact/.test(r.url())) posts.push(r.url()); });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(`${BASE}/hp/${args.slug}`, { waitUntil: 'load' });
await page.waitForTimeout(900);

// 画面の必須表示と入力制約
const emailReq = await page.getAttribute('[data-bk="email"]', 'required');
const emailLabel = (await page.locator('label[for="lhp-bkf-email"]').textContent()) || '';
check('メール欄に required が付いている', emailReq !== null);
check('メール欄のラベルに「必須」が出ている', emailLabel.includes('メールアドレス') && emailLabel.includes('必須'), emailLabel.trim());
const phoneLabel = (await page.locator('label[for="lhp-bkf-phone"]').textContent()) || '';
check('任意の欄は「任意」と分かる', phoneLabel.includes('任意'), phoneLabel.trim());

// メール未入力では送らない（ブラウザの検証を外して、こちらの止め方を確かめる）
await page.fill('[data-bk="name"]', '齋藤 匠');
await page.fill('[data-bk="phone"]', '090-0000-0000');
await page.selectOption('[data-bk="service"]', 'カラー＋カット');
await page.fill('[data-bk="date"]', '2026-09-20');
await page.selectOption('[data-bk="time"]', '14:00');
const before = posts.length;
await page.evaluate(() => { document.getElementById('lhp-form-booking').noValidate = true; });
await page.locator('#lhp-btn-booking').click();
await page.waitForTimeout(700);
check('メール未入力では送信しない', posts.length === before, `POST ${posts.length - before}件`);
check('その理由が画面に出る', ((await page.locator('#lhp-note-booking').textContent()) || '').includes('メールアドレス'));
check('押し直せる状態のまま', await page.locator('#lhp-btn-booking').isEnabled());

// メールを入れて、実際に送る（応答の差し替えはしていない）
const beforeRows = (await contacts()).length;
await page.fill('[data-bk="email"]', 'browser@example.com');
await page.locator('#lhp-btn-booking').click();
await page.waitForTimeout(1500);
check('実APIに送信され、完了が出る', await page.locator('.lhp-form-success').isVisible());
const rows = await contacts();
const row = rows[rows.length - 1];
check('実APIが受け取って記録した', rows.length === beforeRows + 1 && row?.email === 'browser@example.com' && row?.type === 'booking',
  JSON.stringify(row && { name: row.name, email: row.email, phone: row.phone, type: row.type }));
check('サイトIDが実データのIDで届いている', row?.site_id === site.id, row?.site_id);
// 改行の中身。JSON上の表記ではなく、保存された文字そのものを見る
const msg = String(row?.message ?? '');
check('メニューと日時が届いている', msg.includes('カラー＋カット') && msg.includes('2026-09-20 14:00'), JSON.stringify(msg));
check('区切りが実際の改行（文字コード10）である',
  msg.includes('\n') && !msg.includes('\\n'),
  `charCodes=${[...msg].map(c => c.charCodeAt(0)).join(',')}`);

// ── 4. お問い合わせフォームも実APIを通る ──
const beforeCt = (await contacts()).length;
await page.evaluate(() => document.getElementById('contact')?.scrollIntoView());
await page.fill('[data-ct="name"]', '問合 花子');
await page.fill('[data-ct="email"]', 'inquiry@example.com');
await page.fill('[data-ct="phone"]', '090-1111-1111');
await page.fill('[data-ct="message"]', '髪質改善について相談したいです。');
await page.locator('#lhp-btn-contact').click();
await page.waitForTimeout(1500);
const ctRows = await contacts();
const ctRow = ctRows[ctRows.length - 1];
check('お問い合わせも実APIが受け取る', ctRows.length === beforeCt + 1 && ctRow?.name === '問合 花子' && ctRow?.email === 'inquiry@example.com',
  JSON.stringify(ctRow && { name: ctRow.name, email: ctRow.email, type: ctRow.type }));
check('お問い合わせの本文が届いている', String(ctRow?.message || '').includes('髪質改善'));
check('ページの例外が出ていない', errs.length === 0, errs.join(' / '));

await b.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('実APIの入力契約（必須・拒否・記録内容）を、実送信で確認しました');
