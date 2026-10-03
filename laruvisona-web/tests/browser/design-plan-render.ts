// 見た目の変更計画（言葉で直す・参考画像から・公開前の見直し）を当てた公開HTMLを、実ブラウザで確かめる。
//   ・どの意図 × 写真の状態（見本・自分の写真・無し）でも、390/320 で横にはみ出さない
//   ・動きを減らす設定の端末でも、見出し・本文が消えない（現れる動きで隠れたままにならない）
//   ・最初の画面の見出しが読める（写真の上は暗い重ね＋白、地の上は文字と地の差 4.5 以上）
//   node --import ./tests/_resolve-ts.mjs tests/browser/design-plan-render.ts
//   環境変数: CHROMIUM_PATH, PLAYWRIGHT_CORE_FROM
import { createRequire } from 'node:module';
import { makeStarterSite } from '../../lib/studio-start';
import { exportToHTML } from '../../lib/html-export';
import { editStudioBlock } from '../../lib/studio-image';
import { planStyleDirection } from '../../lib/style-direction-plan';
import { applyDesignPlan } from '../../lib/design-change';
import { planFromWords, INTENT_IDS } from '../../lib/design-words';
import { planFromReference } from '../../lib/reference-style';
import { contrast } from '../../lib/design-director';
import type { Block } from '../../types/laruHP';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const PH = '/studio/placeholders/construction.webp', PHOTO = '/company/concepts/architecture.webp';
const make = () => {
  const s = makeStarterSite({ industry: 'construction', name: '足立ホーム工房', area: '東京都足立区', audience: '足立区で住まいを考えている方',
    description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never, 'calm');
  s.pages[0].blocks = s.pages[0].blocks.map((b) => (b.type === 'gallery' ? { ...b, data: { ...b.data, images: [PH, PH, PH] } } : b));
  return s;
};
type Site = ReturnType<typeof make>;
const mapHero = (s: Site, f: (b: Block) => Block): Site => ({ ...s, pages: [{ ...s.pages[0], blocks: s.pages[0].blocks.map((b) => (b.type === 'hero' ? f(b) : b)) }] });
const PHOTOS: Record<string, (s: Site) => Site> = {
  sample: (s) => s,
  own: (s) => mapHero(s, (b) => editStudioBlock(b, 'bgImage', PHOTO)),
  none: (s) => mapHero(s, (b) => ({ ...b, data: { ...b.data, bgImage: '' } })),
};
const adoptDirection = (s: Site): Site => { const p = planStyleDirection(s, 'immersive', { usePalette: false, themeColors: true }); return { ...s, pages: p.pages, settings: p.settings } as Site; };
const cases: { key: string; html: string; wide?: boolean }[] = [];
const add = (key: string, s: Site, wide = false) => cases.push({ key, wide, html: exportToHTML(s.pages, s.pages[0].seo!, s.settings as never, s.name) });
for (const [pk, photo] of Object.entries(PHOTOS)) {
  for (const id of INTENT_IDS) {
    const s = photo(make());
    const r = applyDesignPlan(s, planFromWords(s, '', { intents: [id] }));
    if (!r) throw Error(`${id} ${pk}`);
    add(`${pk}:${id}`, { ...s, pages: r.pages, settings: r.settings } as Site, id === 'bigger-photo' || id === 'calm');
  }
  // 見た目の案を採用したあとに「写真を大きく」
  const d = photo(adoptDirection(make()));
  const r = applyDesignPlan(d, planFromWords(d, '写真を大きく見せる'))!;
  add(`${pk}:direction+bigger-photo`, { ...d, pages: r.pages, settings: r.settings } as Site, true);
  // 参考画像：写真が主役／文字が中心／暗い
  for (const [rk, st] of Object.entries({ photo: { lightness: 0.5, vivid: 0.2, whitespace: 0.2, edges: 0.03, photo: 0.7, hue: 30 }, text: { lightness: 0.9, vivid: 0.02, whitespace: 0.7, edges: 0.15, photo: 0.05, hue: -1 }, dark: { lightness: 0.2, vivid: 0.1, whitespace: 0.3, edges: 0.06, photo: 0.4, hue: 220 } })) {
    const s = photo(make());
    const r2 = applyDesignPlan(s, planFromReference(s, st, { usePalette: true }))!;
    add(`${pk}:reference-${rk}`, { ...s, pages: r2.pages, settings: r2.settings } as Site, true);
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const failures: string[] = [];
let n = 0, overPhoto = 0, overBg = 0;
for (const reduced of [true, false]) {
  for (const width of [390, 320, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.route('**/*', (r: { request(): { url(): string }; fulfill(o: object): void; continue(): void; abort(): void }) => {
      const u = new URL(r.request().url());
      if (u.hostname === 'site.test' && (u.pathname === '/' || u.pathname === '')) return r.fulfill({ contentType: 'text/html', body: (globalThis as { __html?: string }).__html ?? '' });
      if (u.hostname === 'site.test') return r.fulfill({ path: `public${u.pathname}` });
      return r.abort();
    });
    const page = await ctx.newPage();
    for (const c of cases) {
      if (width === 1440 && !c.wide) continue;
      if (!reduced && width !== 390) continue;
      (globalThis as { __html?: string }).__html = c.html.replace(/(src|href)="\//g, '$1="https://site.test/').replace(/url\(\//g, 'url(https://site.test/');
      await page.goto('https://site.test/', { waitUntil: 'load' });
      await page.waitForTimeout(reduced ? 250 : 1600);
      const res = await page.evaluate(() => {
        const doc = document.scrollingElement!;
        const hidden = [...document.querySelectorAll('h1, h2, .lhp-hero-sub')].filter((e) => {
          const st = getComputedStyle(e as Element);
          const r = (e as Element).getBoundingClientRect();
          return (e as HTMLElement).innerText.trim() && (Number(st.opacity) < 0.5 || st.visibility === 'hidden' || r.width === 0);
        }).map((e) => (e as HTMLElement).innerText.slice(0, 20));
        const hero = document.querySelector('.lhp-hero') as HTMLElement | null;
        const h1 = hero?.querySelector('h1') as HTMLElement | null;
        let bg = '';
        const photoBehind = !!hero && getComputedStyle(hero).backgroundImage !== 'none' && !hero.classList.contains('lhp-hero-split');
        const crafted = !!hero?.classList.contains('lhp-hero-crafted');
        for (let el: HTMLElement | null = h1; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; } }
        return { overflow: doc.scrollWidth - window.innerWidth, hidden, color: h1 ? getComputedStyle(h1).color : '', bg, photoBehind, crafted };
      });
      const hex = (rgb: string) => '#' + (rgb.match(/\d+/g) || []).slice(0, 3).map((v) => Number(v).toString(16).padStart(2, '0')).join('');
      const label = `${c.key} @${width}${reduced ? ' reduce' : ''}`;
      n++;
      if (res.overflow > 1) failures.push(`${label}: 横にはみ出し ${res.overflow}px`);
      if (res.hidden.length) failures.push(`${label}: 見えない見出し ${res.hidden.join('/')}`);
      if (res.color) {
        if (res.photoBehind) {
          overPhoto++;
          // 写真の上：暗い重ね（crafted）か、白い文字のどちらも無いと読めない
          const white = (contrast(hex(res.color), '#1b2633') ?? 0) >= 4.5;
          if (!white) failures.push(`${label}: 写真の上の見出しが暗い色 ${res.color} crafted=${res.crafted}`);
        } else if (res.bg) {
          overBg++;
          const r = contrast(hex(res.color), hex(res.bg)) ?? 21;
          if (r < 4.5) failures.push(`${label}: 見出しと地の差 ${r.toFixed(1)} (${res.color} on ${res.bg})`);
        }
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(`${cases.length} 通り・${n} 回の表示（最初の画面の見出し：写真の上 ${overPhoto}・地の上 ${overBg}）`);
if (failures.length) { console.log(failures.slice(0, 40).join('\n')); console.log(`FAIL ${failures.length}`); process.exit(1); }
console.log('OK 横のはみ出し・見えない見出し・最初の画面の見出しの読みやすさ');
