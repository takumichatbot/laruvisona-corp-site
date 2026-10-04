// 会社の公式電話（050-1792-3437）の表示・tel リンク・構造化データ・幅ごとのはみ出しを、実サーバーで確かめる。
//   CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... [BASE=http://127.0.0.1:3319] node tests/browser/company-phone-check.mjs
import { createRequire } from 'node:module';
const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:3319';
const PAGES = [
  { path: '/', tel: true }, { path: '/contact', tel: true }, { path: '/services', tel: true }, { path: '/local', tel: true },
  { path: '/privacy', tel: false }, { path: '/laruHP/tokusho', tel: false }, { path: '/laruHP/contact', tel: true }, { path: '/laruHP/privacy', tel: false },
];
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); if (!ok) console.log('FAIL', name, detail); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const w of [320, 390, 430, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, ...(w < 500 ? { isMobile: true, hasTouch: true } : {}), reducedMotion: 'reduce' });
  await ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
  const p = await ctx.newPage();
  for (const pg of PAGES) {
    const res = await p.goto(BASE + pg.path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const lds = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch { return 'PARSE_ERROR'; } });
      const flat = lds.flat().flatMap((x) => (x && x['@graph'] ? x['@graph'] : [x]));
      const orgPhones = [];
      const walk = (o) => { if (!o || typeof o !== 'object') return; if (o['@type'] === 'Organization' && o.name === '株式会社LaruVisona' && 'telephone' in o) orgPhones.push(o.telephone); Object.values(o).forEach(walk); };
      flat.forEach(walk);
      return {
        text: document.body.innerText.includes('050-1792-3437'),
        tel: [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href')),
        parse: lds.includes('PARSE_ERROR'),
        orgPhones,
        orgCount: flat.filter((x) => x && x['@type'] === 'Organization' && x.name === '株式会社LaruVisona').length,
        old: /1792-?2286|815017922286/.test(html),
        over: document.scrollingElement.scrollWidth - innerWidth,
      };
    });
    const n = `${w}px ${pg.path}`;
    check(`${n} 200`, res.status() === 200, String(res.status()));
    check(`${n} 番号の表示`, r.text);
    if (pg.tel) check(`${n} tel リンク`, r.tel.length > 0 && r.tel.every((h) => h === 'tel:+815017923437'), r.tel.join(','));
    check(`${n} 構造化データが読める`, !r.parse);
    check(`${n} Organization の telephone`, r.orgPhones.every((t) => t === '+815017923437'), r.orgPhones.join(','));
    check(`${n} 旧番号なし`, !r.old);
    check(`${n} 横のはみ出しなし`, r.over <= 1, String(r.over));
    if (w === 390) console.log(`${pg.path}: tel=${r.tel.length} Organization=${r.orgCount}（telephone ${r.orgPhones.length}）`);
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length}`);
process.exit(results.every(Boolean) ? 0 : 1);
