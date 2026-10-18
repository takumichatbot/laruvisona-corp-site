// LARU HP の元ロゴ（マーク上・文字下）の表示を、変更した画面だけ PC・390・320 で確かめる（手元の fixture 専用）。
//   MODE=before|after OUTPUT_DIR=... node tests/browser/laruhp-logo-check.mjs
// after では：縦横比が元ロゴ（448:432）のまま・色フィルターなし・横はみ出しなし・画面内に収まる、を合否にする。
// Chromium の幅の再現であり、Safari / iPhone 実機の確認ではない。
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local fixture only');
const mode = process.env.MODE || 'after';
const out = process.env.OUTPUT_DIR || `/tmp/laruhp-logo-${mode}`;
fs.mkdirSync(out, { recursive: true });
const session = { access_token: 'stub', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', email: 'owner@example.com', aud: 'authenticated', role: 'authenticated' } };
const PAGES = [
  ['plans', '/laruHP/plans'], ['faq', '/laruHP/faq'], ['faq-slug', '/laruHP/faq/getsugaku-nomi'],
  ['articles', '/laruHP/articles'], ['article', '/laruHP/articles/hp-sakusei-cost'], ['simulator', '/laruHP/simulator'],
  ['demo', '/laruHP/demo'], ['vs', '/laruHP/vs/wix'], ['privacy', '/laruHP/privacy'], ['terms', '/laruHP/terms'],
  ['tokusho', '/laruHP/tokusho'], ['domains', '/laruHP/domains'], ['login', '/laruHP/auth/login'], ['invite', '/laruHP/invite/' + 'ab'.repeat(24)],
  // 既定ロゴ（brandLogoUrl 未指定）が出るのは代理店プランのホワイトラベル欄だけ → 偽 DB の代理店ユーザーで開く
  ['settings', '/laruHP/settings?tab=account', '4f2a1b8c-3d5e-4a6f-8b1c-2e3d4f5a6b7c'], ['builder', '/laruHP/builder?siteId=id-a'],
];
const RATIO = 448 / 432;
let pass = 0, fail = 0;
const rows = [];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const width of [1280, 390, 320]) {
    const ctx = await b.newContext({ viewport: { width, height: 800 }, locale: 'ja-JP' });
    let asUser = null;
    const login = (id) => ctx.addCookies(['sb-127-auth-token', 'sb-localhost-auth-token'].map((name) => ({ name, value: 'base64-' + Buffer.from(JSON.stringify({ ...session, user: { ...session.user, id } })).toString('base64'), domain: '127.0.0.1', path: '/' })));
    await login(session.user.id);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    // ブラウザから偽 DB（別ポート）への呼び出しは CORS で落ちるので、Playwright 側で中継する（手元の fixture だけ）
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    await ctx.route('http://127.0.0.1:54999/**', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      // 偽 DB の /auth/v1/user は常に既定の利用者を返すので、代理店ユーザーで開くときだけ差し替える
      if (asUser && route.request().url().endsWith('/auth/v1/user')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ ...session.user, id: asUser }) });
      const r = await route.fetch().catch(() => null);
      if (!r) return route.abort();
      return route.fulfill({ response: r, headers: { ...r.headers(), ...cors } });
    });
    const p = await ctx.newPage();
    for (const [name, path, user] of PAGES) {
      asUser = user || null;
      await p.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(300);
      const m = await p.evaluate(() => {
        const img = [...document.querySelectorAll('img')].find((i) => /laruhp(_logo|-transparent)/.test(decodeURIComponent(i.currentSrc || i.src)) && i.getBoundingClientRect().width > 0);
        if (!img) return null;
        img.scrollIntoView({ block: 'nearest' });
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const holder = img.closest('header') || img.parentElement;
        const hr = holder.getBoundingClientRect();
        return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), top: +r.top.toFixed(1), left: +r.left.toFixed(1), right: +r.right.toFixed(1), filter: cs.filter, fit: cs.objectFit,
          natural: [img.naturalWidth, img.naturalHeight], src: decodeURIComponent(img.currentSrc || img.src).replace(location.origin, ''),
          plate: getComputedStyle(img.parentElement).backgroundColor, holderH: +hr.height.toFixed(1), overflowX: document.documentElement.scrollWidth - innerWidth };
      });
      const shot = `${out}/${name}-${width}.png`;
      if (m) await p.screenshot({ path: shot, clip: { x: 0, y: Math.max(0, m.top - 24), width, height: Math.min(200, m.h + 64) } });
      else await p.screenshot({ path: shot, clip: { x: 0, y: 0, width, height: 200 } });
      rows.push({ name, width, ...m });
      if (mode === 'after') {
        const okPage = !!m && Math.abs(m.w / m.h - RATIO) < 0.03 && m.filter === 'none' && m.fit !== 'cover' && m.overflowX <= 0 && m.left >= 0 && m.right <= width && m.natural[0] > 0;
        // 900px 以上のログインはロゴを出さない（暗い側の面に既存の文字の組みがある）
        const skip = name === 'login' && width >= 900 && !m;
        if (okPage || skip) pass++; else { fail++; console.log('FAIL', name, width, JSON.stringify(m)); }
      }
    }
    await ctx.close();
  }
} finally { await b.close(); }
fs.writeFileSync(`${out}/measure.json`, JSON.stringify(rows, null, 1));
for (const r of rows) console.log([r.name, r.width, r.w ? `${r.w}x${r.h}` : '-', r.filter ?? '-', r.holderH ?? '-', r.src ?? ''].join('\t'));
if (mode === 'after') { console.log(`${pass}/${pass + fail}`); process.exit(fail ? 1 : 0); }
