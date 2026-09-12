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

/* ── 11. 問い合わせとチャット（既存のLARUbot連携を壊していないか） ── */
{
  // 埋め込みの確認。larubot.tokyo へは出さずに、注入されるところまでを見る
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  const asked = [];
  await ctx.route(BLOCK, r => r.abort());
  // あとから足したものが先に効く。larubot への要求だけは数えたいので最後に足す
  await ctx.route(/larubot\.tokyo/, r => { asked.push(r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const tag = await page.evaluate(() => {
    const s = document.getElementById('larubot-embed-script');
    return s ? { src: s.getAttribute('src'), id: s.getAttribute('data-public-id'), defer: s.defer } : null;
  });
  // 値そのもの（公開ID）はログに出さない
  check('チャットの読み込みが始まっている', !!tag, tag ? tag.src : 'なし');
  check('読み込み先と公開IDが渡っている',
    !!tag && tag.src.includes('larubot.tokyo/static/embed.js') && !!tag.id);
  check('演出の終わりを待って止まっていない（6秒の保険に頼らない）', asked.length > 0, `${asked.length}件`);

  // チャットが出る右下を、こちらの要素で塞いでいないか
  const corner = await page.evaluate(() => {
    const pts = [[innerWidth - 34, innerHeight - 34], [innerWidth - 60, innerHeight - 60]];
    return pts.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return '';
      const fixed = el.closest('#page-motion') ? 'page-motion' : '';
      return fixed;
    }).filter(Boolean);
  });
  check('チャットの出る右下を、停止ボタンで塞いでいない', corner.length === 0, corner.join(','));

  // 相談の導線・停止ボタン・チャットの三つが重ならないか（右下に実物大の代役を置いて測る）
  const overlap = await page.evaluate(() => {
    const fake = document.createElement('div');
    fake.id = 'fake-chat';
    Object.assign(fake.style, {
      position: 'fixed', right: '16px', bottom: '16px', width: '64px', height: '64px', zIndex: '2147483000',
    });
    document.body.appendChild(fake);
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    const chat = fake.getBoundingClientRect();
    const motion = document.getElementById('page-motion').getBoundingClientRect();
    const ctas = [...document.querySelectorAll('a')].filter(a => {
      const r = a.getBoundingClientRect();
      return r.width > 0 && r.top < innerHeight && r.bottom > 0;
    }).map(a => a.getBoundingClientRect());
    const out = {
      chatVsMotion: hit(chat, motion),
      chatVsCta: ctas.some(r => hit(chat, r)),
      motionVsCta: ctas.some(r => hit(motion, r)),
    };
    fake.remove();
    return out;
  });
  check('チャットと停止ボタンが重ならない', !overlap.chatVsMotion);
  check('チャットと画面内の導線が重ならない', !overlap.chatVsCta);
  check('停止ボタンと画面内の導線が重ならない', !overlap.motionVsCta);

  // 演出を止めても、問い合わせとチャットは使える
  await page.locator('#page-motion').click();
  await page.waitForTimeout(600);
  check('止めても相談への導線が押せる', await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '#contact');
    if (!a) return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (a === top || a.contains(top));
  }));
  check('止めてもチャットの読み込みは残る', await page.evaluate(() => !!document.getElementById('larubot-embed-script')));
  // 演出が動いている最中でも、右下の重ね置き（チャット相当）を開いて入力できるか。
  // 本物のウィジェットはこの環境から読めないので、同じ置き方の代役で確かめる
  await page.evaluate(() => { window.scrollTo(0, (document.getElementById('opening').offsetHeight - innerHeight) * 0.45); });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'fake-chat';
    host.innerHTML = '<button id="fake-launcher" style="width:60px;height:60px;border-radius:30px;background:#0EA5E9"></button>'
      + '<div id="fake-panel" hidden style="width:320px;height:420px;background:#fff">'
      + '<input id="fake-input" style="width:280px;height:40px"></div>';
    Object.assign(host.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483000' });
    document.body.appendChild(host);
    host.querySelector('#fake-launcher').addEventListener('click', () => {
      host.querySelector('#fake-panel').hidden = false;
    });
  });
  const hitLauncher = await page.evaluate(() => {
    const r = document.getElementById('fake-launcher').getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top?.id || top?.tagName || '';
  });
  check('演出中でも、チャットの起動ボタンに手が届く', hitLauncher === 'fake-launcher', hitLauncher);
  await page.locator('#fake-launcher').click();
  await page.waitForTimeout(300);
  check('演出中でも、チャットが開く', await page.locator('#fake-panel').isVisible());
  await page.locator('#fake-input').fill('テスト入力');
  check('演出中でも、チャットに入力できる', (await page.locator('#fake-input').inputValue()) === 'テスト入力');
  const stayed = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(700);
  check('チャットを触っても画面が飛ばない', Math.abs((await page.evaluate(() => window.scrollY)) - stayed) < 2);
  await page.evaluate(() => document.getElementById('fake-chat').remove());

  check('画面の例外が出ていない（チャット）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await ctx.close();
}

/* ── 12. 問い合わせページは既存のフォームのまま（埋め込みの確認） ──
   実際に送れるか・通知が届くかは、ここでは確かめていない（本番の確認） */
{
  const { page, errors } = await open({ width: 390, height: 844 });
  await page.goto(BASE + '/contact', { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  check('/contact が開ける', (await page.locator('h1:has-text("お問い合わせ")').count()) > 0);
  const form = await page.evaluate(() => {
    const f = document.querySelector('iframe[title="お問い合わせフォーム"]');
    return f ? { host: new URL(f.src).host, path: new URL(f.src).pathname.split('/')[1], hasId: new URL(f.src).pathname.split('/').length > 2 } : null;
  });
  check('/contact は LARUbot のフォームを埋め込んでいる',
    !!form && form.host === 'larubot.tokyo' && form.path === 'f' && form.hasId,
    form ? `${form.host}/${form.path}/…` : 'なし');
  check('独自フォームに置き換えていない',
    (await page.locator('form input[type="email"], form textarea').count()) === 0);
  check('会社トップの演出は /contact に持ち込んでいない',
    (await page.locator('#opening').count()) === 0 && (await page.locator('#page-motion').count()) === 0);
  check('画面の例外が出ていない（問い合わせ）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log(`  - ${n}`)); process.exit(1); }
console.log('会社トップの体験を確認しました');
