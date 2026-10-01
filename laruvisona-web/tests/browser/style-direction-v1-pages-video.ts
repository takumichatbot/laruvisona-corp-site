// 代表ケース1件ずつ：背景動画のあるヒーロー／2ページ目のあるサイト。
//   実行: CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... OUTPUT_DIR=<dir> node --import ./tests/_resolve-ts.mjs tests/browser/style-direction-v1-pages-video.ts
// 127.0.0.1:3319（fixture 向けビルド）の public から画像・動画を読む。外部へは出ない。
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { makeStarterSite } from '../../lib/studio-start';
import { planStyleDirection } from '../../lib/style-direction-plan';
import { exportToHTML } from '../../lib/html-export';
import { editStudioBlock } from '../../lib/studio-image';
import { canonicalJson } from '../../lib/republish-source';
import type { Block, Page } from '../../types/laruHP';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
const out = (process.env.OUTPUT_DIR || '/tmp/laruhp-style-direction') + '/pages-video';
fs.mkdirSync(out, { recursive: true });
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: unknown, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };

const VIDEO = '/lp/film/flow-desktop.mp4', PHOTO = '/company/concepts/architecture.webp';
const base = () => {
  const s = makeStarterSite({ industry: 'construction', name: '足立ホーム工房', area: '東京都足立区', audience: '足立区で住まいを考えている方',
    description: '暮らしの話を伺うところから、住まいづくりを始めます。', goal: 'contact', phone: '03-1234-5678' } as never, 'refined');
  return s;
};
const page2: Page = { id: 'page-2', name: '会社案内', path: '/company', seo: { title: '会社案内', description: '', keywords: '' } as Page['seo'],
  blocks: [
    { id: 'p2-head', type: 'heading', data: { text: '会社案内', align: 'left' } },
    { id: 'p2-text', type: 'paragraph', data: { text: '2ページ目の本文です。左寄せにしてあります。', align: 'left' } },
    { id: 'p2-img', type: 'image', data: { src: PHOTO, alt: '会社の外観' } },
    { id: 'p2-cta', type: 'cta', data: { heading: '2ページ目の帯', buttonText: '電話する', buttonLink: 'tel:0312345678', bgColor: '#f7f4ef' } },
  ] as Block[] };

// サーバ：/__pv/<key>.html は書き出したHTML、それ以外は 3319 の public へ中継
const pages: Record<string, string> = {};
const server = http.createServer((rq, rs) => {
  const m = rq.url!.match(/^\/__pv\/([\w-]+)\.html/);
  if (m) { rs.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); rs.end(pages[m[1]] || ''); return; }
  const up = http.request('http://127.0.0.1:3319' + rq.url, { method: rq.method, headers: rq.headers }, (r) => { rs.writeHead(r.statusCode!, r.headers); r.pipe(rs); });
  up.on('error', () => rs.writeHead(502).end()); rq.pipe(up);
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const open = async (key: string, opts: Record<string, unknown> = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await ctx.route((u: URL) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r: { abort: () => void }) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${origin}/__pv/${key}.html`, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  return { ctx, p };
};

try {
  // ── 背景動画 ── 写真で惹きつける（B）を採用。見本写真のまま／写真あり／写真あり＋動きを減らす
  const withVideo = (s: ReturnType<typeof base>, photo: boolean) => ({ ...s, pages: s.pages.map((pg, i) => i ? pg : { ...pg, blocks: pg.blocks.map((b) => b.type !== 'hero' ? b
    : (() => { const v = { ...b, data: { ...b.data, heroVideo: VIDEO } }; return photo ? editStudioBlock(v, 'bgImage', PHOTO) : v; })()) }) });
  for (const [key, photo] of [['video-sample', false], ['video-photo', true]] as const) {
    const s0 = withVideo(base(), photo);
    const plan = planStyleDirection(s0, 'immersive', { usePalette: false, themeColors: false });
    const hero = plan.pages[0].blocks.find((b) => b.type === 'hero')!;
    check(`${key}：採用しても動画のURLは残る`, hero.data.heroVideo === VIDEO);
    pages[key] = exportToHTML(plan.pages, plan.pages[0].seo!, plan.settings as never, s0.name);
  }
  {
    const { ctx, p } = await open('video-sample');
    const m = await p.evaluate(() => ({ separated: !!document.querySelector('.lhp-hero-separated'), media: document.querySelectorAll('[data-lhp-hero-video]').length, video: document.querySelectorAll('video').length }));
    check('動画あり・見本写真（上下に分けて表示中）：背景動画は出さない（文字と重ねない）', m.separated && m.media === 0 && m.video === 0, JSON.stringify(m));
    await p.screenshot({ path: `${out}/video-sample-1440.png` }); await ctx.close();
  }
  {
    const { ctx, p } = await open('video-photo');
    const m = await p.evaluate(() => { const v = document.querySelector('video'); return { separated: !!document.querySelector('.lhp-hero-separated'), media: document.querySelectorAll('[data-lhp-hero-video]').length, video: !!v, src: v?.currentSrc || v?.querySelector('source')?.getAttribute('src') || '', muted: v?.muted, h1: getComputedStyle(document.querySelector('.lhp-hero h1')!).opacity }; });
    check('動画あり・写真あり：写真に重ねる組み方で、動画を読み込む（音なし）', !m.separated && m.media === 1 && m.video && m.muted === true && m.h1 === '1', JSON.stringify(m));
    await p.screenshot({ path: `${out}/video-photo-1440.png` }); await ctx.close();
  }
  {
    const { ctx, p } = await open('video-photo', { reducedMotion: 'reduce' });
    const m = await p.evaluate(() => ({ video: document.querySelectorAll('video').length, h1: getComputedStyle(document.querySelector('.lhp-hero h1')!).opacity, hidden: [...document.querySelectorAll('[data-lhp-anim]')].filter((e) => getComputedStyle(e).opacity !== '1').length }));
    check('動画あり・動きを減らす設定：動画を取りに行かず、見出し・本文は隠れない', m.video === 0 && m.h1 === '1' && m.hidden === 0, JSON.stringify(m));
    await ctx.close();
  }

  // ── 2ページ目 ── 言葉で伝える（A）を採用（配色は今のまま）。データは変わらない／見た目はサイト全体の分だけ変わる
  const s2 = { ...base() }; s2.pages = [...s2.pages, page2];
  const planA = planStyleDirection(s2, 'editorial', { usePalette: false, themeColors: false });
  check('2ページ目：データ（本文・画像・リンク・節）は変わらない', canonicalJson(planA.pages[1]) === canonicalJson(page2));
  const scope = planA.changes.find((c) => c.label === '効く範囲')?.detail || '';
  pages['p2-before'] = exportToHTML(s2.pages, s2.pages[0].seo!, s2.settings as never, s2.name);
  pages['p2-after'] = exportToHTML(planA.pages, planA.pages[0].seo!, planA.settings as never, s2.name);
  const measure = async (key: string) => {
    const { ctx, p } = await open(key);
    await p.evaluate(() => (window as unknown as { lhpPage: (e: unknown, id: string) => void }).lhpPage({ preventDefault() {} }, 'page-2'));
    await p.waitForTimeout(800);
    const m = await p.evaluate(() => {
      const pg = document.getElementById('page-2')!;
      const left = (s: string) => Math.round(pg.querySelector(s)!.getBoundingClientRect().left);
      return { visible: !pg.hidden, font: getComputedStyle(pg.querySelector('p')!).fontFamily.split(',')[0], headLeft: left('h2, .lhp-heading, [data-lhp-block="p2-head"]'), textLeft: left('[data-lhp-block="p2-text"] p'), tel: !!pg.querySelector('a[href="tel:0312345678"]'), img: pg.querySelector('img')?.getAttribute('src'), ctaBg: getComputedStyle(pg.querySelector('[data-lhp-block="p2-cta"]')!).backgroundColor, text: pg.innerText.includes('2ページ目の本文です') };
    });
    await p.screenshot({ path: `${out}/${key}-page2-1440.png` }); await ctx.close();
    return m;
  };
  const before = await measure('p2-before'), after = await measure('p2-after');
  check('2ページ目：本文・画像・電話リンク・帯の色は採用後も同じ', after.text && after.tel && after.img === before.img && after.ctaBg === before.ctaBg, JSON.stringify({ before, after }));
  const fontChanged = before.font !== after.font, alignChanged = before.textLeft !== after.textLeft;
  check('2ページ目の見た目：書体が変わる → 採用前の説明に「書体…サイト全体」がある', !fontChanged || /書体[^。]*サイト全体/.test(scope), `${before.font} → ${after.font} ／ 説明「${scope}」`);
  check('2ページ目の見た目：左寄せの本文の位置が変わる → 採用前の説明にある', !alignChanged || /読み始め/.test(scope), `本文の左端 ${before.textLeft} → ${after.textLeft}px ／ 説明「${scope}」`);
} finally {
  await browser.close(); server.close();
  fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 1));
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
