// 結い庵に入れた写真（スタイル4枚・スタッフ3枚）を、実ページで確かめる。
//
//   node docs/reference-sites/salon/photo-check.mjs --port 3300
//
// 見るのは次の7つ。
//   1. 配信されているのが原画PNGではなく、表示寸法に合わせた軽い画像か
//   2. スタイル4枚が 4:5 で、枠と画像の比が同じか（さらに切り落としていないか）
//   3. 4枚の明るさと色温度がそろっているか（ページ上の実画素で測る）
//   4. スタッフ3枚が148pxの円で出て、**白い縁も四隅も出ていない**か
//   5. 頭頂と毛先が切れていないか（配信画像の中の余白を測る）
//   6. 下の写真を、最初の表示より先に取りに行っていないか
//   7. 生成素材・架空の店である旨が出ているか
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');

const args = { port: '3300', path: '/hp/yuian', 'font-css': '', 'font-dir': '', shots: '' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const URL_ = `http://127.0.0.1:${args.port}${args.path}`;

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

const browser = await chromium.launch();

async function open({ width, height, dpr }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, locale: 'ja-JP', hasTouch: width < 700 });
  if (args['font-css'] && fs.existsSync(args['font-css'])) {
    // 顧客が選んだ書体（明朝）を実際に読み込んだ状態で見る
    await ctx.route(/fonts\.googleapis\.com/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/css' }, body: fs.readFileSync(args['font-css']) }));
    await ctx.route(/fonts\.gstatic\.com/, r => {
      const p = args['font-dir'] + '/' + r.request().url().split('/').pop();
      return fs.existsSync(p) ? r.fulfill({ status: 200, headers: { 'content-type': 'font/woff2' }, body: fs.readFileSync(p) }) : r.fulfill({ status: 404, body: '' });
    });
  } else {
    await ctx.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, r => r.abort());
  }
  await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, r => r.abort());
  const page = await ctx.newPage();
  const got = [];
  page.on('response', async r => {
    if (!/\/salon\//.test(r.url())) return;
    let bytes = 0;
    try { bytes = (await r.body()).length; } catch {}
    got.push({ url: r.url().split('/').pop(), bytes });
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  return { ctx, page, got, errs };
}

const scrollAll = async (page) => {
  for (let i = 0; i < 24; i++) { await page.evaluate(() => window.scrollBy(0, innerHeight * 0.9)); await page.waitForTimeout(180); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
};

/* ── パソコン ── */
{
  const { ctx, page, got, errs } = await open({ width: 1440, height: 900, dpr: 1 });

  /* 6. 下の写真を、最初の画面より先に取りに行っていないこと。
     ブラウザは loading="lazy" でも画面の少し先までは先読みするので、
     「1枚も取っていない」では見ない。見るのは次の3つ。
       ・下の写真に優先の指定が付いていないこと
       ・下の写真が「あとで読む」になっていること
       ・最初に取りに行く /salon/ の画像が、最初の画面の写真であること */
  const attrs = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.lhp-gallery-img')];
    const t = [...document.querySelectorAll('[style*="border-radius:50%"] img')];
    const one = e => ({ file: (e.getAttribute('src') || '').split('/').pop(), loading: e.getAttribute('loading'), fp: e.getAttribute('fetchpriority') });
    return { gallery: g.map(one), team: t.map(one) };
  });
  const below = [...attrs.gallery, ...attrs.team];
  check('下の写真に、優先の指定が付いていない',
    below.every(v => v.fp !== 'high'), below.filter(v => v.fp === 'high').map(v => v.file).join(' / ') || 'なし');
  check('下の写真が「あとで読む」になっている',
    below.every(v => v.loading === 'lazy'), below.map(v => `${v.file}:${v.loading}`).join(' '));
  check('最初に取りに行くのは、最初の画面の写真',
    got.length > 0 && /^hero-/.test(got[0].url), got.slice(0, 3).map(g => g.url).join(' → ') || 'なし');

  await scrollAll(page);

  // 1. 何が配信されたか
  const salon = got.filter(g => /^(style|staff)-/.test(g.url));
  check('原画のPNGを配っていない', !salon.some(g => /\.png$/i.test(g.url)), salon.map(g => g.url).join(' / '));
  const total = salon.reduce((a, g) => a + g.bytes, 0);
  check('写真7枚の転送量が大きすぎない', total <= 600 * 1024, `${(total / 1024).toFixed(0)}KB（7枚）`);

  // 2. スタイル4枚。枠と画像の比が同じ＝さらに切り落としていない
  const styles = await page.evaluate(() => [...document.querySelectorAll('.lhp-gallery-img')].map(el => ({
    file: el.currentSrc.split('/').pop(),
    natW: el.naturalWidth, natH: el.naturalHeight,
    boxW: Math.round(el.getBoundingClientRect().width), boxH: Math.round(el.getBoundingClientRect().height),
    fit: getComputedStyle(el).objectFit,
  })));
  check('スタイルは4枚とも出ている', styles.length === 4 && styles.every(s => s.natW > 0), styles.map(s => s.file).join(','));
  check('スタイルは表示寸法に合う大きさで配っている',
    styles.every(s => s.natW === 900 && s.natH === 1125), styles.map(s => `${s.natW}×${s.natH}`).join(' '));
  check('スタイルは 4:5 で、さらに切り落としていない',
    styles.every(s => Math.abs(s.boxW / s.boxH - 4 / 5) < 0.02 && Math.abs(s.natW / s.natH - s.boxW / s.boxH) < 0.02),
    styles.map(s => (s.boxW / s.boxH).toFixed(3)).join(' '));

  // 3. 4枚の明るさと色温度（実画素）
  const bgs = await page.evaluate(() => [...document.querySelectorAll('.lhp-gallery-img')].map(el => {
    const c = document.createElement('canvas'); c.width = 60; c.height = 75;
    const g = c.getContext('2d'); g.drawImage(el, 0, 0, 60, 75);
    /* 上の両端だけを見る。真ん中の帯は頭が入ることがあり、
       そこを混ぜると「背景の違い」ではなく「髪の量の違い」を測ってしまう。 */
    let r = 0, gg = 0, b = 0, n = 0;
    for (const box of [[0, 0, 14, 14], [46, 0, 14, 14]]) {
      const d = g.getImageData(box[0], box[1], box[2], box[3]).data;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    }
    return [r / n, gg / n, b / n];
  }));
  const lums = bgs.map(v => 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]);
  const temps = bgs.map(v => v[2] - v[0]);
  const spread = (xs) => Math.max(...xs) - Math.min(...xs);
  check('4枚の明るさがそろっている', spread(lums) <= 3, `幅 ${spread(lums).toFixed(1)}（${lums.map(v => v.toFixed(0)).join(' ')}）`);
  check('4枚の色温度がそろっている', spread(temps) <= 3, `幅 ${spread(temps).toFixed(1)}（${temps.map(v => v.toFixed(0)).join(' ')}）`);

  // 4. スタッフ3枚。円で出て、白い縁・四隅が出ていない
  const staff = await page.evaluate(() => [...document.querySelectorAll('[style*="border-radius:50%"]')].map(box => {
    const img = box.querySelector('img');
    const r = box.getBoundingClientRect();
    return {
      file: img ? img.currentSrc.split('/').pop() : '',
      natW: img ? img.naturalWidth : 0,
      w: Math.round(r.width), h: Math.round(r.height),
      radius: getComputedStyle(box).borderRadius,
      fit: img ? getComputedStyle(img).objectFit : '',
    };
  }));
  check('スタッフは3枚とも円で出ている',
    staff.length === 3 && staff.every(s => s.w === 148 && s.h === 148 && /50%|74px/.test(s.radius)),
    staff.map(s => `${s.w}×${s.h} ${s.radius}`).join(' / '));
  check('スタッフも表示寸法に合う大きさで配っている', staff.every(s => s.natW === 512), staff.map(s => s.natW).join(' '));

  // 円のすぐ内側を実画素で見る。白が出ていたら失敗
  const white = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[style*="border-radius:50%"]').forEach((box, k) => {
      const img = box.querySelector('img');
      if (!img) return;
      const c = document.createElement('canvas'); c.width = 148; c.height = 148;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 148, 148);
      const d = g.getImageData(0, 0, 148, 148).data;
      let worst = 0, at = '';
      for (let a = 0; a < 360; a += 2) {
        for (const rr of [70, 71, 72]) {       // 半径74の円の、すぐ内側
          const x = Math.round(74 + Math.cos(a * Math.PI / 180) * rr);
          const y = Math.round(74 + Math.sin(a * Math.PI / 180) * rr);
          const i = (y * 148 + x) * 4;
          const m = Math.min(d[i], d[i + 1], d[i + 2]);
          if (m > worst) { worst = m; at = `${k + 1}枚目 ${a}度 r=${rr}`; }
        }
      }
      out.push({ worst, at });
    });
    return out;
  });
  const worst = white.reduce((a, b) => (b.worst > a.worst ? b : a), { worst: 0, at: '' });
  check('円のふちに白が出ていない', worst.worst < 246, `いちばん明るい画素 ${worst.worst}（${worst.at}）`);

  check('見本・生成素材であることが出ている',
    (await page.locator('text=生成素材').count()) > 0 && (await page.locator('text=架空').count()) > 0);
  check('横に食み出していない（1440px）',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('画面の例外が出ていない', errs.length === 0, errs.slice(0, 2).join(' / '));

  if (args.shots) {
    await page.locator('.lhp-gallery').scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
    await page.locator('.lhp-gallery').screenshot({ path: `${args.shots}/salon-gallery.png` });
  }
  console.log(`\n  転送（スタイル4＋スタッフ3）= ${(total / 1024).toFixed(0)}KB`);
  salon.forEach(g => console.log(`    ${g.url}  ${(g.bytes / 1024).toFixed(0)}KB`));
  await ctx.close();
}

/* ── スマホ ── */
{
  const { ctx, page, got, errs } = await open({ width: 390, height: 844, dpr: 2 });
  check('スマホでも、最初に取りに行くのは最初の画面の写真',
    got.length > 0 && /^hero-/.test(got[0].url), got.slice(0, 3).map(g => g.url).join(' → ') || 'なし');
  await scrollAll(page);
  const cols = await page.evaluate(() => {
    const g = document.querySelector('.lhp-gallery');
    return { w: Math.round(g.getBoundingClientRect().width), cols: getComputedStyle(g).gridTemplateColumns.split(' ').length };
  });
  check('スマホでもスタイルが2列で並ぶ', cols.cols === 2, `${cols.cols}列 / 幅 ${cols.w}px`);
  const fit = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.lhp-gallery-img, [style*="border-radius:50%"] img').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > document.documentElement.clientWidth + 1 || r.left < -1) bad.push(el.currentSrc.split('/').pop());
    });
    return bad;
  });
  check('スマホで写真が横に食み出していない', fit.length === 0, fit.join(' / '));
  check('画面の例外が出ていない（スマホ）', errs.length === 0, errs.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 配信画像そのものの余白（頭頂・毛先） ── */
{
  const { ctx, page } = await open({ width: 1440, height: 900, dpr: 1 });
  await scrollAll(page);
  const margins = await page.evaluate(() => {
    const read = (el, w, h) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(el, 0, 0, w, h);
      return g.getImageData(0, 0, w, h).data;
    };
    const bboxOf = (d, w, h) => {
      // 四隅の平均を地の色とし、そこから離れた画素を被写体とみなす
      const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const corners = [at(2, 2), at(w - 3, 2), at(2, h - 3), at(w - 3, h - 3)];
      const bg = [0, 1, 2].map(k => corners.reduce((a, c) => a + c[k], 0) / corners.length);
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = at(x, y);
        if (Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2])) > 26) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      return { x0, x1, y0, y1, w, h };
    };
    const out = { style: [], staff: [] };
    document.querySelectorAll('.lhp-gallery-img').forEach(el => {
      const w = 180, h = 225;
      const b = bboxOf(read(el, w, h), w, h);
      out.style.push({ file: el.currentSrc.split('/').pop(), top: b.y0 / h, left: b.x0 / w, right: (w - 1 - b.x1) / w });
    });
    /* スタッフは、円の中の「髪（暗い画素）」の上端で見る。
       地の色との差で見ると、円の外を埋めた色との差を拾ってしまう。 */
    document.querySelectorAll('[style*="border-radius:50%"] img').forEach(el => {
      const w = 148, h = 148;
      const d = read(el, w, h);
      let y0 = h;
      for (let y = 0; y < h && y0 === h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - 74, dy = y - 74;
          if (dx * dx + dy * dy > 72 * 72) continue;      // 円の中だけ
          const i = (y * w + x) * 4;
          const lum = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
          if (lum < 110) { y0 = y; break; }
        }
      }
      out.staff.push({ file: el.currentSrc.split('/').pop(), top: y0 / h });
    });
    return out;
  });
  check('スタイル：頭頂が切れていない', margins.style.every(m => m.top >= 0.02),
    margins.style.map(m => `${m.file} 上${(m.top * 100).toFixed(1)}%`).join(' / '));
  check('スタイル：毛先が左右で切れていない', margins.style.every(m => m.left >= 0.01 && m.right >= 0.01),
    margins.style.map(m => `左${(m.left * 100).toFixed(1)}% 右${(m.right * 100).toFixed(1)}%`).join(' / '));
  check('スタッフ：頭頂が切れていない', margins.staff.every(m => m.top >= 0.04),
    margins.staff.map(m => `${m.file} 上${(m.top * 100).toFixed(1)}%`).join(' / '));
  await ctx.close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log('  - ' + n)); process.exit(1); }
console.log('入れた写真が、実ページで決めたとおりに出ることを確認しました');
