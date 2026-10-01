// Studio：保存されている「検索に出さない（noindex）」設定が、完成像の書き出しと「公開の準備」の表示に出ること。
// 制作画面そのものは検索に出さない（/laruHP の robots）。完成像の robots は公開HTMLと同じ値にする（除外して比べない）。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... node tests/browser/studio-noindex-check.mjs
import { createRequire } from 'node:module';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const base = 'http://127.0.0.1:3319';
const LEGACY = 'd41d8cd9-8f00-4b20-a204-9800998ecf84';
const CANVAS = 'iframe[title="できあがりの見え方"]';
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
await ctx.addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'), domain: '127.0.0.1', path: '/' }]);
await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
const p = await ctx.newPage();
// 比べるときに外すのは、制作画面だけが足すもの（橋渡し・CSP・計測ID）と og:image の業種だけ。robots は外さない
const strip = (h) => h.replace(/<script data-lhp-studio-bridge[\s\S]*?<\/script>/, '').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
  .replace(/window\.__LHPSID=[^;]*;/g, '').replace(/"siteId":"[^"]*"/g, '').replace(/siteId=[^"&]*/g, '').replace(/<script><\/script>/g, '');
const robotsOf = (h) => (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1];
try {
  for (const noIndex of [true, false]) {
    await p.goto(base + '/laruHP/studio', { waitUntil: 'networkidle' });
    await p.evaluate(async ({ id, noIndex }) => fetch('/api/sites/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings_patch: { noIndex } }) }), { id: LEGACY, noIndex });
    await p.goto(base + '/laruHP/studio?siteId=' + LEGACY, { waitUntil: 'networkidle' });
    await p.frameLocator(CANVAS).locator('h1').waitFor();
    const studioRobots = await p.evaluate(() => document.querySelector('meta[name="robots"]')?.content);
    const canvas = await p.locator(CANVAS).getAttribute('srcdoc');
    const exported = await p.evaluate(async (id) => (await fetch('/api/sites/' + id + '/export-html')).text(), LEGACY);
    check(`noIndex=${noIndex}：完成像の robots が公開用の書き出しと同じ`, robotsOf(canvas) === (noIndex ? 'noindex,nofollow' : 'index,follow') && robotsOf(canvas) === robotsOf(exported), `${robotsOf(canvas)} / ${robotsOf(exported)}`);
    const a = strip(canvas), b = strip(exported); let i = 0; while (i < a.length && a[i] === b[i]) i++;
    check(`noIndex=${noIndex}：完成像の HTML 全体が公開用の書き出しと一致（robots を外さずに）`, a === b, a === b ? '' : JSON.stringify([a.slice(i - 80, i + 80), b.slice(i - 80, i + 80)]));
    check(`noIndex=${noIndex}：制作画面そのものは検索に出さない`, /noindex/.test(studioRobots || ''), studioRobots);
    await p.locator('.se-settings-tabs').getByRole('button', { name: '公開の準備', exact: true }).click();
    const text = await p.locator('[data-ready-search]').innerText();
    check(`noIndex=${noIndex}：「公開の準備」に公開したときの掲載設定が出る`, text.includes(noIndex ? '検索結果に出さない設定です' : '検索結果に出す設定です') && text.includes('SEO設定で変える'), text.replace(/\n/g, ' / '));
  }
} finally {
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
