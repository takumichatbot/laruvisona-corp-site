// 公開HTML（exportToHTML の出力）を実ブラウザで確かめる：3案 × 画像の状態 × 画面幅、数字、動きを減らす設定。
// 書き出し: node --import ./tests/_resolve-ts.mjs tests/browser/style-direction-v1-render.ts <dir>/render
// 実行    : CHROMIUM_PATH=... PLAYWRIGHT_CORE_FROM=... OUTPUT_DIR=<dir> node tests/browser/style-direction-v1-static.mjs
// 画像・CSS は本番用ビルドのローカルサーバ（127.0.0.1:3319）の public から読む。書体は同じ配布物をローカルから供給する。
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';

const req = createRequire(process.env.PLAYWRIGHT_CORE_FROM ? process.env.PLAYWRIGHT_CORE_FROM + '/' : import.meta.url);
const { chromium } = req('playwright-core');
// 書き出したHTMLを本物のHTTP応答として配る小さなサーバ（/__sd/ 以外は 127.0.0.1:3319 の public へ中継）。
// ブラウザ内の差し替え（route.fulfill）だと文書の接続先が不明扱いになり、手元の書体の読み込みが進まないため。
const app = 'http://127.0.0.1:3319';
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/__sd/')) {
    const f = `${out}/render/${path.basename(req.url.split('?')[0])}`;
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(f)); return;
  }
  const up = http.request(app + req.url, { method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => res.writeHead(502).end()); req.pipe(up);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const out = process.env.OUTPUT_DIR || '/tmp/laruhp-style-direction';
const shots = out + '/static';
fs.mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(ok ? 'OK  ' : 'FAIL', name, detail); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

// 外部への通信は行わない（書体は installLocalFonts が手元から配る。後から登録した方が優先される）
const blockExternal = (ctx) => ctx.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (r) => r.abort());
async function open(width, key, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1000 ? 900 : 844 }, locale: 'ja-JP', ...opts });
  await blockExternal(ctx);
  const fonts = await installLocalFonts(ctx);
  const p = await ctx.newPage();
  const fontState = { requested: [] };
  p.on('request', (r) => { if (/fonts\.googleapis\.com/.test(r.url())) fontState.requested.push(decodeURIComponent(r.url()).match(/family=([^:&]+)/)?.[1]); });
  await p.goto(`${base}/__sd/${key}.html`, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('lhp-cookie-banner')?.remove());
  const loadedFonts = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i); });
  return { ctx, fonts, p, loadedFonts };
}
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const heroMetrics = (p) => p.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const r = (s) => document.querySelector(s)?.getBoundingClientRect();
  const h1 = r('.lhp-hero h1'), cta = r('.lhp-hero .lhp-btn-primary'), stage = r('.lhp-hero-stage');
  const overlap = (a, b) => !!a && !!b && !(a.bottom <= b.top || b.bottom <= a.top || a.right <= b.left || b.right <= a.left);
  const hero = document.querySelector('.lhp-hero');
  const cs = getComputedStyle(hero);
  const h1c = getComputedStyle(document.querySelector('.lhp-hero h1')).color;
  return {
    over: document.documentElement.scrollWidth - W,
    separated: hero.classList.contains('lhp-hero-separated'),
    bgImage: cs.backgroundImage !== 'none',
    bg: cs.backgroundColor, h1Color: h1c,
    h1Cta: overlap(h1, cta), ctaStage: overlap(cta, stage), h1Stage: overlap(h1, stage),
    ctaH: cta ? Math.round(cta.height) : 0, ctaInside: cta ? cta.left >= 0 && cta.right <= W : false,
    h1Lines: h1 ? Math.round(h1.height / parseFloat(getComputedStyle(document.querySelector('.lhp-hero h1')).lineHeight)) : 0,
  };
});

try {
  // 3案 × 画像の状態 × 幅
  for (const k of ['A', 'B', 'C']) {
    for (const state of ['sample', 'keep', 'photo', 'none', 'broken', 'long']) {
      for (const width of [1440, 390, 320]) {
        if ((state === 'keep' || state === 'broken') && width === 320) continue;
        const { ctx, fonts, p, loadedFonts } = await open(width, `${k}-${state}`);
        const m = await heroMetrics(p);
        const tag = `${k} ${state} ${width}`;
        check(`${tag}：横はみ出しなし`, m.over <= 0, JSON.stringify(m));
        check(`${tag}：見出し・ボタン・写真が重ならず、ボタンは画面内で44px以上`, !m.h1Cta && !m.ctaStage && !m.h1Stage && m.ctaInside && m.ctaH >= 44, JSON.stringify(m));
        if (k === 'B' && ['sample', 'none'].includes(state)) check(`${tag}：見本／画像なしは上下に分け、写真に重ねない`, m.separated && !m.bgImage, JSON.stringify(m));
        if (k === 'B' && state === 'photo' && width === 1440) check(`${tag}：写真ありは写真に文字を重ねる`, !m.separated && m.bgImage, JSON.stringify(m));
        // パソコン：写真に重ねる組み方なので濃い下地に白い文字。スマホ：「写真の全体を残す」で文字と写真を分けるので明るい下地に濃い文字
        if (k === 'B' && state === 'broken') check(`${tag}：写真が読めなくても見出しが読める（文字と下地のコントラスト4.5以上）`, contrast(m.h1Color, m.bg) >= 4.5 && m.bg !== 'rgba(0, 0, 0, 0)', `${contrast(m.h1Color, m.bg).toFixed(1)} ${JSON.stringify(m)}`);
        if (k !== 'B' && width === 1440 && ['sample', 'keep'].includes(state)) {
          const L = await p.evaluate(() => {
            const left = (s) => { const el = document.querySelector(s); return el ? Math.round(el.getBoundingClientRect().left) : null; };
            return { hero: left('.lhp-hero-content h1'), title: left('.lhp-section .lhp-section-title'), para: left('.lhp-text-block > p'), tabs: left('.lhp-tabs'), contactTitle: left('#contact > .lhp-section-title'), contactSub: left('#contact > .lhp-section-sub'), form: left('#contact form') };
          });
          check(`${tag}：最初の画面・見出し・本文・流れの読み始めが揃う`, L.hero === L.title && L.para === L.title && L.tabs === L.title, JSON.stringify(L));
          check(`${tag}：問い合わせの見出し・案内文・フォームが同じまとまり`, L.contactTitle === L.form && L.contactSub === L.form, JSON.stringify(L));
        }
        if (k === 'B' && width === 1440 && state === 'sample') {
          const L = await p.evaluate(() => { const c = (s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? Math.round(r.left + r.width / 2) : null; }; return { title: c('#contact > .lhp-section-title'), form: c('#contact form') }; });
          check(`${tag}：問い合わせの見出しとフォームが同じ中心`, Math.abs(L.title - L.form) <= 2, JSON.stringify(L));
        }
        if (state === 'sample' || state === 'photo' || state === 'long') {
          await p.screenshot({ path: `${shots}/${k}-${state}-${width}-first.png` });
          if (state === 'sample' && width !== 320) {
            await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 200) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 500)); window.scrollTo(0, 0); });
            await p.waitForTimeout(500);
            await p.screenshot({ path: `${shots}/${k}-${state}-${width}-full.png`, fullPage: true });
          }
        }
        if (state === 'sample' && width === 1440) {
          const want = { A: 'BIZ UDPGothic', B: 'Shippori Mincho', C: 'Noto Sans JP' }[k];
          check(`${k}：書体「${want}」の実ファイルを読み込めた（代替書体ではない）`, loadedFonts.some((f) => f.replace(/["']/g, '') === want), loadedFonts.join(', '));
        }
        await ctx.close(); await fonts.close();
      }
    }
  }

  // 数字：読み込み中・スクロール中に変わらない（控えめ）。対照（従来の動き）では変わることも確かめる
  for (const [key, expectStable] of [['count-calm', true], ['count-control', false]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await blockExternal(ctx);
    const fonts = await installLocalFonts(ctx);
      const p = await ctx.newPage();
    await p.addInitScript(() => {
      window.__seen = new Set();
      const tick = () => { document.querySelectorAll('.lhp-price-amount, .lhp-hero h1').forEach((el) => window.__seen.add(el.textContent)); requestAnimationFrame(tick); };
      document.addEventListener('DOMContentLoaded', tick);
    });
    await p.goto(`${base}/__sd/${key}.html`, { waitUntil: 'domcontentloaded' });
    for (let y = 0; y < 9000; y += 150) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(40); }
    await p.waitForTimeout(1800);
    const seen = await p.evaluate(() => [...window.__seen]);
    const priceValues = seen.filter((t) => /円|^[\d,]+$/.test(t) || /\d/.test(t));
    if (expectStable) check('控えめな動き：料金の数字・見出しが途中の値にならない', seen.length === 2, JSON.stringify(seen));
    else check('対照（従来の動き・力強い）：検証方法で数字の変化を検出できる', seen.length > 2, `観測した値 ${seen.length} 種類（例 ${JSON.stringify(seen.slice(0, 4))}）`);
    void priceValues;
    await ctx.close(); await fonts.close();
  }

  // 動きを減らす設定：読み込んだ時点で全節が見え、重ねる写真は通常の配置
  for (const k of ['A', 'B', 'C']) {
    const { ctx, fonts, p } = await open(390, `${k}-sample`, { reducedMotion: 'reduce' });
    const m = await p.evaluate(() => ({
      hidden: [...document.querySelectorAll('[data-lhp-anim]')].filter((e) => getComputedStyle(e).opacity !== '1').length,
      sticky: [...document.querySelectorAll('.lhp-gallery-stack img')].filter((i) => getComputedStyle(i).position === 'sticky').length,
      video: document.querySelectorAll('video').length,
    }));
    check(`${k}：動きを減らす設定で内容を隠さない（スクロール前）`, m.hidden === 0 && m.sticky === 0 && m.video === 0, JSON.stringify(m));
    await ctx.close(); await fonts.close();
  }
  // 通常の設定：最初の画面は待たずに表示、表示の動きは 0.32 秒
  for (const k of ['A', 'B', 'C']) {
    const { ctx, fonts, p } = await open(390, `${k}-sample`);
    const m = await p.evaluate(() => {
      const hero = document.querySelector('.lhp-hero');
      const others = [...document.querySelectorAll('[data-lhp-anim]')].filter((e) => !e.classList.contains('lhp-hero'));
      return { heroOpacity: getComputedStyle(hero).opacity, durations: [...new Set(others.map((e) => getComputedStyle(e).transitionDuration))], delays: [...new Set(others.map((e) => getComputedStyle(e).transitionDelay))] };
    });
    check(`${k}：最初の画面はすぐ読める・表示の動きは0.32秒・遅延なし`, m.heroOpacity === '1' && m.durations.every((d) => d.startsWith('0.32s')) && m.delays.every((d) => /^0s/.test(d)), JSON.stringify(m));
    await ctx.close(); await fonts.close();
  }
  // 互換：案を採用していない作品は、新しい属性・CSSが出ない
  {
    const { ctx, fonts, p } = await open(1440, 'legacy');
    const m = await p.evaluate(() => ({ dir: document.body.getAttribute('data-style-direction'), motion: document.body.getAttribute('data-motion'), sep: document.querySelectorAll('.lhp-hero-separated').length, contactPad: getComputedStyle(document.querySelector('#contact')).paddingLeft }));
    check('既存作品：案の属性・分離表示なし', !m.dir && !m.motion && m.sep === 0, JSON.stringify(m));
    check('既存作品（共通修正）：問い合わせ欄の左右の余白が効く', m.contactPad !== '0px', JSON.stringify(m));
    await p.screenshot({ path: `${shots}/legacy-1440-first.png` });
    await ctx.close(); await fonts.close();
  }
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(out + '/static-results.json', JSON.stringify(results, null, 1));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} OK`);
  if (failed.length) process.exitCode = 1;
}
