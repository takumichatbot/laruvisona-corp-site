// 会社トップの体験（水滴 → 正式ロゴ → 実物）を、実ブラウザで確かめる。
//
//   node tests/browser/company-experience-check.mjs --port 3300 [--shots /tmp/company]
//
// 見るのは「約束したことを守っているか」。
//   ・本文と静止画が先。JavaScriptを待たずに読める
//   ・粒の行き先は、公開資産のロゴ（public/images/laruvisona_mark.svg）そのもの
//   ・ページのスクロールはふつうのまま。こちらから位置を動かさない
//   ・装飾がリンク・ボタンを遮らない
//   ・実物は本物（公開ページと同じ処理の出力）で、見せ方を変えると作り直される
//   ・選んだ見せ方が制作画面へ渡る
//   ・目的の3択は任意。選ばなくても読める。選んでも画面が飛ばない
//   ・止められる。「動きを減らす」端末では最初から完成状態
//   ・320 / 390 / 1440 で横にはみ出さない
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_FROM ? process.env.PLAYWRIGHT_FROM + '/' : import.meta.url);
const { chromium } = require('playwright');
import fs from 'node:fs';

const args = { port: '3300', shots: '', root: '.' };
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i]; }
const BASE = `http://127.0.0.1:${args.port}`;
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });

const ok = [], ng = [];
const check = (n, p, d = '') => { (p ? ok : ng).push(n); console.log(`${p ? 'OK  ' : 'NG  '}${n}${d ? ` … ${d}` : ''}`); };

/* 公開資産のロゴから、粒の座標を読む。画面側の値はこれと一致しないといけない */
const svg = fs.readFileSync(`${args.root}/public/images/laruvisona_mark.svg`, 'utf8');
const MARK = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([-\d.]+)" r="([\d.]+)"/g)]
  .map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);

const BLOCK = /fonts\.googleapis\.com|fonts\.gstatic\.com|larubot\.tokyo|googletagmanager|clarity\.ms/;
const browser = await chromium.launch();

async function open({ width = 1440, height = 900, reduced = false, js = true } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height }, locale: 'ja-JP',
    javaScriptEnabled: js,
    ...(reduced ? { reducedMotion: 'reduce' } : {}),
  });
  await ctx.route(BLOCK, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  return { ctx, page, errors };
}
const travel = p => p.evaluate(() => document.getElementById('opening').offsetHeight - window.innerHeight);
const go = async (p, ratio) => {
  const t = await travel(p);
  await p.evaluate(y => window.scrollTo(0, y), Math.round(t * ratio));
  await p.waitForTimeout(900);
};

/* ── 1. 配られたHTMLだけで読める ── */
{
  const html = await (await fetch(BASE + '/')).text();
  check('配られたHTMLに主コピーが入っている', html.includes('まだないものを、') && html.includes('使えるものへ。'));
  check('配られたHTMLに補足が入っている', html.includes('AI・ウェブ・システムを、構想から実装まで。'));
  check('配られたHTMLに会社情報が入っている', html.includes('株式会社LaruVisona') && html.includes('齋藤匠'));
  check('配られたHTMLに相談のコピーが入っている', html.includes('まだ、形になっていない話から。'));
  check('冒頭の静止画を先に読み込む', html.includes('water-1'));
  check('正式ロゴを使っている', html.includes('logo_dark'));
}

/* ── 2. JavaScript を切っても読める ── */
{
  const { page } = await open({ js: false });
  check('JSなしでも見出しが見える', await page.locator('h1').first().isVisible());
  check('JSなしでも相談への導線がある', (await page.locator('a[href="#contact"]').count()) > 0);
  await page.context().close();
}

/* ── 3. 粒がロゴの配置へ整う（座標はロゴ資産と同じ） ── */
{
  const { page, errors } = await open();
  await go(page, 0.7);
  const got = await page.evaluate(() =>
    [...document.querySelectorAll('#opening svg circle[fill="url(#lv-brand)"]')]
      .map(c => [+c.getAttribute('cx'), +c.getAttribute('cy'), +c.getAttribute('r')]));
  check('粒の数がロゴと同じ', got.length === MARK.length, `${got.length} / ${MARK.length}`);
  const worst = got.length === MARK.length
    ? Math.max(...got.map((g, i) => Math.max(...g.map((v, k) => Math.abs(v - MARK[i][k])))))
    : Infinity;
  check('粒の位置と大きさがロゴ資産と一致する', worst < 0.01, `最大ずれ ${worst}`);
  if (args.shots) await page.screenshot({ path: `${args.shots}/pc-logo.png` });
  check('画面の例外が出ていない（冒頭）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

/* ── 4. スクロールを横取りしない・勝手に動かさない ── */
{
  const { page } = await open();
  await go(page, 0.5);
  const before = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => window.scrollY);
  check('止まっていれば、こちらから画面を動かさない', Math.abs(after - before) < 2, `${before} → ${after}`);
  // 冒頭の途中でも、ふつうに下まで行ける
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const bottom = await page.evaluate(() => window.scrollY + window.innerHeight >= document.body.scrollHeight - 4);
  check('冒頭に引っかからず、最後まで進める', bottom);
  await page.context().close();
}

/* ── 5. 装飾がリンクを遮らない ── */
{
  const { page } = await open();
  const covered = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#opening a')].find(x => x.textContent.includes('実物を見る'));
    if (!a) return 'リンクが無い';
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return a.contains(top) || top === a ? '' : (top?.className || top?.tagName || '不明');
  });
  check('冒頭のボタンが、演出の下に隠れていない', covered === '', String(covered));
  await page.locator('#opening a:has-text("実物を見る")').click();
  await page.waitForTimeout(1500);
  check('押すと実物の区画へ進む', (await page.evaluate(() => window.scrollY)) > 200);
  await page.context().close();
}

/* ── 6. 実物：公開と同じ処理で作ったサイトが出て、見せ方を変えられる ── */
{
  const { page, errors } = await open();
  await page.locator('#live').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  const demo = page.locator('[data-lhp-demo]');
  check('実物の枠がある', (await demo.count()) === 1);
  const frame = page.frameLocator('[data-lhp-demo] iframe').first();
  await page.waitForTimeout(1500);
  const firstText = await frame.locator('body').innerText().catch(() => '');
  check('中に、作られたサイトが入っている', firstText.length > 40, `${firstText.length}文字`);
  const before = await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown);
  await page.locator('[data-lhp-demo] [role="radio"]').nth(1).click();
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown);
  check('見せ方を選ぶと、その場で作り直される', before !== after, `${before} → ${after}`);
  const href = await page.locator('a:has-text("この見せ方で作りはじめる")').getAttribute('href');
  check('「作りはじめる」に、選んだ見せ方が入っている', href === `/laruHP/studio?design=${after}`, String(href));
  await page.locator('a:has-text("この見せ方で作りはじめる")').evaluate(a => a.removeAttribute('href'));
  await page.locator('a:has-text("この見せ方で作りはじめる")').click();
  const kept = await page.evaluate(() => window.localStorage.getItem('laruhp.design-choice'));
  check('選んだ見せ方は、ログインを挟んでも消えない形で残る', !!kept && kept.includes(after), String(kept));
  check('残すのは見せ方の名前だけ', !!kept && Object.keys(JSON.parse(kept)).sort().join(',') === 'at,presetId', String(kept));
  if (args.shots) await page.screenshot({ path: `${args.shots}/pc-live.png` });
  check('画面の例外が出ていない（実物）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

/* ── 7. 目的の3択は任意。選んでも画面が飛ばない ── */
{
  const { page } = await open();
  await page.locator('#purpose').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const summaries = await page.locator('#purpose li').count();
  check('選ばなくても3つとも読める', summaries === 3, `${summaries}件`);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.locator('#purpose button:has-text("問い合わせに応えたい")').click();
  await page.waitForTimeout(700);
  const y1 = await page.evaluate(() => window.scrollY);
  check('選んでも画面が飛ばない', Math.abs(y1 - y0) < 2, `${y0} → ${y1}`);
  check('選ぶと、その説明が開く', await page.locator('text=サイトに置くAIチャットボットです').isVisible());
  await page.locator('#purpose button:has-text("問い合わせに応えたい")').click();
  await page.waitForTimeout(400);
  check('もう一度押すと閉じる', !(await page.locator('text=サイトに置くAIチャットボットです').isVisible()));
  await page.context().close();
}

/* ── 8. 止められる ── */
{
  const { page } = await open();
  await page.locator('#page-motion').click();
  await page.waitForTimeout(700);
  check('止めると「動きを再開」に変わる', (await page.locator('#page-motion').innerText()).includes('再開'));
  const settled = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#opening svg circle[fill="url(#lv-brand)"]')];
    return c.map(x => [+x.getAttribute('cx'), +x.getAttribute('cy')]);
  });
  const worst = Math.max(...settled.map((g, i) => Math.max(Math.abs(g[0] - MARK[i][0]), Math.abs(g[1] - MARK[i][1]))));
  check('止めたら、完成した配置で置かれる', worst < 0.01, `最大ずれ ${worst}`);
  check('止めても本文は読める', await page.locator('h1').first().isVisible());
  await page.context().close();
}

/* ── 9. 「動きを減らす」端末 ── */
{
  const { page } = await open({ reduced: true });
  await page.waitForTimeout(900);
  check('最初から止まっている', (await page.locator('#page-motion').innerText()).includes('再開'));
  check('冒頭が1画面に収まる（長い空きを作らない）',
    (await page.evaluate(() => document.getElementById('opening').offsetHeight <= window.innerHeight + 2)));
  await page.locator('#live').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  check('実物はそのまま触れる', (await page.locator('[data-lhp-demo] [role="radio"]').count()) === 3);
  if (args.shots) await page.screenshot({ path: `${args.shots}/pc-reduced.png` });
  await page.context().close();
}

/* ── 10. 幅：320 / 390 / 1440 ── */
for (const w of [320, 390, 1440]) {
  const { page, errors } = await open({ width: w, height: 800 });
  await page.waitForTimeout(800);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${w}px で横にはみ出さない`, over <= 1, `${over}px`);
  // 固定ヘッダーと見出しが重ならない
  const clash = await page.evaluate(() => {
    const h = document.querySelector('header').getBoundingClientRect();
    const t = document.querySelector('h1').getBoundingClientRect();
    return t.top < h.bottom;
  });
  check(`${w}px で見出しがヘッダーに隠れない`, !clash);
  if (w !== 1440) {
    // 止めるボタンと、下の申込・相談の導線が重ならない
    const overlap = await page.evaluate(() => {
      const b = document.getElementById('page-motion').getBoundingClientRect();
      return [...document.querySelectorAll('a')].some(a => {
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) return false;
        return !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom);
      });
    });
    check(`${w}px で停止ボタンが導線と重ならない`, !overlap);
  }
  if (args.shots && w !== 1440) await page.screenshot({ path: `${args.shots}/sp-${w}.png` });
  check(`${w}px で画面の例外が出ていない`, errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log(`  - ${n}`)); process.exit(1); }
console.log('会社トップの体験を確認しました');
