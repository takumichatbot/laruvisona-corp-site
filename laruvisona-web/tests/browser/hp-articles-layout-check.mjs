// 記事ページ（一覧・本文）の見え方：320/390/430・PC 1280/1512 で横のはみ出し・表と画像・押す場所の大きさ・長い題名。
// 前提は tests/http/hp-seo-articles-check.mjs と同じ（偽DB・Content API の代わり・LARUBOT_API_URL を向けたサーバー）。
//   CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... [SHOTS=<保存先>] node tests/browser/hp-articles-layout-check.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const fixture = 'http://127.0.0.1:54999', mock = 'http://127.0.0.1:54997';
const OWNER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const post = (u, b) => fetch(u, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const LONG = '足立区で外壁塗装とリフォームを初めて考える方へ、見積もりの読み方と工期・費用の目安、失敗しない業者の選び方を詳しく解説します';
const body = `<h2>はじめに</h2><p>${'本文の段落です。'.repeat(30)}</p><p>https://example.com/very/long/url/that/should/wrap/without/overflowing/the/screen/width/at/all</p>
<table><thead><tr><th>項目</th><th>費用の目安</th><th>工期</th><th>備考</th><th>保証</th></tr></thead><tbody><tr><td>外壁塗装</td><td>80〜120万円</td><td>2〜3週間</td><td>足場代を含む場合と含まない場合があります</td><td>10年</td></tr></tbody></table>
<figure><img src="https://img.example/wide.webp" width="2400" height="800" alt="施工の様子"><figcaption>施工の様子</figcaption></figure><h3>まとめ</h3><ul><li>項目1</li><li>項目2</li></ul>`;
await post(fixture + '/__control', { patchProfile: { id: OWNER, patch: { plan: 'hp-bot-seo', subscription_status: 'active' } } });
await post(fixture + '/__control', { patchSite: { id: 'id-a', patch: { user_id: OWNER, custom_domain: null, settings_json: { laruseoPublicId: 'pidA', laruseo: true } } } });
const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, slug: `a-${i + 1}`, title: i === 0 ? LONG : `記事${i + 1}`, meta_description: '説明文です。'.repeat(8), target_keyword: '', thumbnail_url: i % 2 ? null : 'https://img.example/t.webp', published_at: '2026-10-01T00:00:00', updated_at: '2026-10-02T00:00:00', canonical_url: `https://larubot.tokyo/blog/a-${i + 1}` }));
await post(mock + '/__state', { tenants: { pidA: { publication: { target_type: 'internal_blog', canonical_base: 'https://larubot.tokyo', article_path: '/blog/{slug}', canonical_policy: 'single_primary' }, items,
  details: { 'a-1': { status: 200, body: { ...items[0], author: 'Aサロン', content_html: body, indexable: true, is_primary_target: false, status: 'published' } } } } } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [w, h] of [[320, 640], [390, 844], [430, 932], [1280, 800], [1512, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...(w < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  // 画像は手元で返す（外部へ出ない）
  await ctx.route('https://img.example/**', (r) => r.fulfill({ path: 'public/company/concepts/architecture.webp', contentType: 'image/webp' }));
  const p = await ctx.newPage();
  for (const path of ['/hp/site-a/articles', '/hp/site-a/articles/a-1']) {
    const res = await p.goto('http://127.0.0.1:3319' + path, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const over = document.scrollingElement.scrollWidth - innerWidth;
      const small = [...document.querySelectorAll('a')].filter((a) => { const b = a.getBoundingClientRect(); return b.width && b.height < 32 && !a.closest('.body'); }).map((a) => a.textContent.trim().slice(0, 12));
      const wide = [...document.querySelectorAll('img, table, h1')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).map((el) => el.tagName);
      const h1 = document.querySelector('h1').getBoundingClientRect();
      const bodySize = parseFloat(getComputedStyle(document.querySelector('.body') || document.body).fontSize);
      return { over, small, wide, h1w: h1.width, bodySize };
    });
    const name = `${w}px ${path.endsWith('a-1') ? '本文' : '一覧'}`;
    check(`${name}：200・横のはみ出しなし・表/画像/題名が画面内`, res.status() === 200 && r.over <= 1 && !r.wide.length, JSON.stringify(r));
    check(`${name}：押す場所の高さ 32px 以上（本文中のリンクを除く）`, !r.small.length, r.small.join('/'));
    if (path.endsWith('a-1')) check(`${name}：本文の文字 16px 以上`, r.bodySize >= 16);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/${w}-${path.endsWith('a-1') ? 'detail' : 'list'}.png`, fullPage: false });
  }
  await ctx.close();
}
await browser.close();
await post(fixture + '/__control', { patchSite: { id: 'id-a', patch: { custom_domain: 'salon-a.example', settings_json: {} } } });
console.log(`\n${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
