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
  const target = Math.round(t * ratio);
  // なめらかスクロールが入っているので、着いてから測る
  for (let i = 0; i < 24; i++) {
    await p.evaluate(y => window.scrollTo(0, y), target);
    await p.waitForTimeout(160);
    const now = await p.evaluate(() => window.scrollY);
    if (Math.abs(now - target) <= 2) break;
  }
  await p.waitForTimeout(400);
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
  await page.locator('#live-demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
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

/* ── 8. 読んでいる途中で止める（場面もページの高さも失わない） ── */
{
  const { page } = await open();
  await go(page, 0.5);
  const before = await page.evaluate(() => ({
    docH: document.body.scrollHeight,
    y: window.scrollY,
    h1: Math.round(document.querySelector('h1').getBoundingClientRect().top),
    live: Math.round(document.getElementById('live').getBoundingClientRect().top),
    act: document.querySelector('#opening [data-act]').dataset.act,
    mark: [...document.querySelectorAll('#opening svg circle[fill="url(#lv-brand)"]')]
      .map(c => Math.round(+c.getAttribute('cx'))),
  }));
  await page.locator('#page-motion').click();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => ({
    docH: document.body.scrollHeight,
    y: window.scrollY,
    h1: Math.round(document.querySelector('h1').getBoundingClientRect().top),
    live: Math.round(document.getElementById('live').getBoundingClientRect().top),
    act: document.querySelector('#opening [data-act]').dataset.act,
    mark: [...document.querySelectorAll('#opening svg circle[fill="url(#lv-brand)"]')]
      .map(c => Math.round(+c.getAttribute('cx'))),
  }));
  check('止めると「動きを再開」に変わる', (await page.locator('#page-motion').innerText()).includes('再開'));
  check('止めてもページの高さが変わらない', before.docH === after.docH, `${before.docH} → ${after.docH}`);
  check('止めても見出しの位置が変わらない', Math.abs(before.h1 - after.h1) <= 2, `${before.h1} → ${after.h1}`);
  check('止めても次の区画の位置が変わらない', Math.abs(before.live - after.live) <= 2, `${before.live} → ${after.live}`);
  check('止めてもいまの場面のまま', before.act === after.act, `${before.act} → ${after.act}`);
  check('止めても粒はいまの位置のまま',
    JSON.stringify(before.mark) === JSON.stringify(after.mark));
  check('止めても本文は読める', await page.locator('#opening').isVisible());

  // 再開すると、また進む
  await page.locator('#page-motion').click();
  await page.waitForTimeout(400);
  check('押し直すと「動きを止める」に戻る', (await page.locator('#page-motion').innerText()).includes('止める'));
  await go(page, 0.75);
  const moved = await page.evaluate(() => document.querySelector('#opening [data-act]').dataset.act);
  check('再開すると、続きから進む', moved === '3', String(moved));
  await page.context().close();
}

/* ── 9. 端末の「動きを減らす」設定（初期から静止。再開は出さない） ── */
{
  const { page } = await open({ reduced: true });
  await page.waitForTimeout(900);
  check('再開できないので、再開ボタンを出さない', (await page.locator('#page-motion').count()) === 0);
  check('止めている理由を出す', (await page.locator('#page-motion-note').innerText()).includes('端末の設定'));
  check('冒頭が1画面に収まる（長い空きを作らない）',
    (await page.evaluate(() => document.getElementById('opening').offsetHeight <= window.innerHeight + 2)));
  check('最初から完成した姿で出る',
    (await page.evaluate(() => document.querySelector('#opening [data-act]').dataset.act)) === 'still');
  await page.locator('#live-demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  check('実物はそのまま触れる', (await page.locator('[data-lhp-demo] [role="radio"]').count()) === 3);
  check('実物も動かさない設定になっている',
    (await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoMotion)) === 'off');
  if (args.shots) await page.screenshot({ path: `${args.shots}/pc-reduced.png` });
  await page.context().close();

  // 320px の静止版で、ロゴと冒頭のボタンが重ならない
  const { page: p320 } = await open({ width: 320, height: 720, reduced: true });
  await p320.waitForTimeout(900);
  const clash = await p320.evaluate(() => {
    const svg = document.querySelector('#opening svg');
    const marks = [...svg.querySelectorAll('circle[fill="url(#lv-brand)"]')]
      .map(c => c.getBoundingClientRect()).filter(r => r.width > 0);
    const btns = [...document.querySelectorAll('#opening a')].map(a => a.getBoundingClientRect());
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    return btns.some(b => marks.some(m => hit(m, b)));
  });
  check('320pxの静止版で、ロゴがボタンに重ならない', !clash);
  if (args.shots) await p320.screenshot({ path: `${args.shots}/sp320-reduced.png` });
  await p320.context().close();
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
      const el = document.getElementById('page-motion') || document.getElementById('page-motion-note');
      const b = el.getBoundingClientRect();
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

/* ── 11. 問い合わせとチャット（既存のLARUbot連携を壊していないか） ──
   通常・停止・再開を分けて見る。状態を確かめてから操作する */
{
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

  // 右下（チャットの出る場所）を、こちらの要素で塞いでいないか
  const corner = await page.evaluate(() => {
    const pts = [[innerWidth - 34, innerHeight - 34], [innerWidth - 60, innerHeight - 60]];
    return pts.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el && el.closest('#page-motion, #page-motion-note') ? '停止ボタン' : '';
    }).filter(Boolean);
  });
  check('チャットの出る右下を、停止ボタンで塞いでいない', corner.length === 0, corner.join(','));

  const overlap = await page.evaluate(() => {
    const fake = document.createElement('div');
    Object.assign(fake.style, {
      position: 'fixed', right: '16px', bottom: '16px', width: '64px', height: '64px', zIndex: '2147483000',
    });
    document.body.appendChild(fake);
    const hit = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    const chat = fake.getBoundingClientRect();
    const motion = (document.getElementById('page-motion') || document.getElementById('page-motion-note')).getBoundingClientRect();
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

  /* 右下に、実物と同じ置き方の代役を出して操作する。
     本物のウィジェットはこの環境から読めないので、置き方だけを同じにする */
  const putFake = () => page.evaluate(() => {
    document.getElementById('fake-chat')?.remove();
    const host = document.createElement('div');
    host.id = 'fake-chat';
    host.innerHTML = '<button id="fake-launcher" style="width:60px;height:60px;border-radius:30px;background:#0EA5E9"></button>'
      + '<div id="fake-panel" hidden style="width:320px;height:420px;background:#fff">'
      + '<input id="fake-input" style="width:280px;height:40px">'
      + '<button id="fake-close">閉じる</button></div>';
    Object.assign(host.style, { position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483000' });
    document.body.appendChild(host);
    host.querySelector('#fake-launcher').addEventListener('click', () => { host.querySelector('#fake-panel').hidden = false; });
    host.querySelector('#fake-close').addEventListener('click', () => { host.querySelector('#fake-panel').hidden = true; });
  });

  /** その場でチャットを開いて入力して閉じられるか */
  const tryChat = async (label) => {
    await putFake();
    const reach = await page.evaluate(() => {
      const r = document.getElementById('fake-launcher').getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top?.id || top?.tagName || '';
    });
    check(`${label}：チャットの起動ボタンに手が届く`, reach === 'fake-launcher', reach);
    const y0 = await page.evaluate(() => window.scrollY);
    await page.locator('#fake-launcher').click();
    await page.waitForTimeout(250);
    check(`${label}：チャットが開く`, await page.locator('#fake-panel').isVisible());
    await page.locator('#fake-input').fill('テスト入力');
    check(`${label}：チャットに入力できる`, (await page.locator('#fake-input').inputValue()) === 'テスト入力');
    await page.locator('#fake-close').click();
    await page.waitForTimeout(200);
    check(`${label}：チャットが閉じる`, !(await page.locator('#fake-panel').isVisible()));
    check(`${label}：チャットを触っても画面が飛ばない`,
      Math.abs((await page.evaluate(() => window.scrollY)) - y0) < 2);
    await page.evaluate(() => document.getElementById('fake-chat')?.remove());
  };

  // (1) 通常。演出が動いている場面まで進めてから
  await go(page, 0.45);
  const act1 = await page.evaluate(() => ({
    act: document.querySelector('#opening [data-act]').dataset.act,
    pressed: document.getElementById('page-motion').getAttribute('aria-pressed'),
  }));
  check('通常：演出が動いている場面にいる', act1.act === '2' && act1.pressed === 'false', JSON.stringify(act1));
  await tryChat('通常');

  // (2) 停止
  await page.locator('#page-motion').click();
  await page.waitForTimeout(600);
  const act2 = await page.evaluate(() => ({
    act: document.querySelector('#opening [data-act]').dataset.act,
    pressed: document.getElementById('page-motion').getAttribute('aria-pressed'),
  }));
  check('停止：止まっていて、場面はそのまま', act2.pressed === 'true' && act2.act === act1.act, JSON.stringify(act2));
  await tryChat('停止');
  check('停止：相談への導線が押せる', await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '#contact');
    if (!a) return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (a === top || a.contains(top));
  }));
  check('停止：チャットの読み込みは残る', await page.evaluate(() => !!document.getElementById('larubot-embed-script')));

  // (3) 再開
  await page.locator('#page-motion').click();
  await page.waitForTimeout(600);
  const act3 = await page.evaluate(() => document.getElementById('page-motion').getAttribute('aria-pressed'));
  check('再開：動く状態に戻っている', act3 === 'false', String(act3));
  await tryChat('再開');

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

/* ── 13. ロゴの説明は、トップではなく専用ページに置く ── */
{
  const top = await (await fetch(BASE + '/')).text();
  check('トップの冒頭に、しるしの由来を置いていない', !top.includes('しるしは、そこから来ています'));

  check('トップからロゴのページへ行ける', top.includes('href="/brand"'));

  const html = await (await fetch(BASE + '/brand')).text();
  check('/brand が配られている', html.includes('粒が集まって'));
  check('/brand は由来として断定していない',
    !html.includes('そこから来ています') && !html.includes('写したものです')
    && html.includes('重ねています') && html.includes('受け取っている'));
  check('/brand に検索向けの見出しがある', /<title>[^<]*ロゴについて[^<]*LaruVisona/.test(html));
  check('/brand に説明文がある', /<meta name="description" content="[^"]{40,}"/.test(html));
  check('/brand に正規URLがある', html.includes('rel="canonical" href="https://laruvisona.jp/brand"'));

  const map = await (await fetch(BASE + '/sitemap.xml')).text();
  check('サイトマップに /brand が入っている', map.includes('https://laruvisona.jp/brand'));

  const { page, errors } = await open({ width: 390, height: 844 });
  await page.goto(BASE + '/brand', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  check('/brand の見出しが1つだけ', (await page.locator('h1').count()) === 1);
  check('/brand でロゴデータを配っている', (await page.locator('a[href="/images/laruvisona_mark.svg"]').count()) === 1);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('/brand が390pxで横にはみ出さない', over <= 1, `${over}px`);
  check('/brand に会社トップの演出を持ち込んでいない',
    (await page.locator('#opening').count()) === 0 && (await page.locator('#page-motion').count()) === 0);
  check('画面の例外が出ていない（ロゴのページ）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

/* ── 14. 独立レビューで挙がった点（R1・R2・R3・R5・D1・D2） ── */
{
  const { page, errors } = await open({ width: 1440, height: 900 });
  await page.bringToFront();

  /* R1: ヘッダーの行き先が実在し、押すとその区画へ着く */
  const navs = await page.evaluate(() =>
    [...document.querySelectorAll('header nav a')].map(a => ({
      text: a.textContent.trim(), href: a.getAttribute('href'),
      exists: !!document.querySelector(a.getAttribute('href')),
    })));
  check('ヘッダーの行き先がすべて実在する', navs.every(n => n.exists),
    navs.filter(n => !n.exists).map(n => `${n.text}→${n.href}`).join(','));
  await page.locator('header nav a:has-text("事業・サービス")').click();
  await page.waitForTimeout(1400);
  const arrived = await page.evaluate(() => {
    const r = document.getElementById('purpose').getBoundingClientRect();
    const h = document.querySelector('header').getBoundingClientRect().height;
    return { top: Math.round(r.top), h: Math.round(h) };
  });
  check('「事業・サービス」を押すと、その区画に着く',
    arrived.top >= arrived.h - 4 && arrived.top < 160, `top=${arrived.top} / header=${arrived.h}`);

  /* R2: ヘッダーの「相談する」が背景に埋もれていない */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  const contrast = await page.evaluate(() => {
    const a = [...document.querySelectorAll('header nav a')].find(x => x.textContent.includes('相談'));
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+/g).map(Number).slice(0, 3).map(v => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fg = getComputedStyle(a).color;
    // ヘッダーは透ける。後ろの地の色（冒頭の一番暗いところ）と比べる
    const bg = 'rgb(4, 8, 15)';
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { fg, ratio: Math.round(ratio * 10) / 10 };
  });
  check('ヘッダーの「相談する」が読める明るさ', contrast.ratio >= 4.5, `${contrast.fg} / 比 ${contrast.ratio}`);
  // フォーカス表示はキーボードで確かめる（プログラムのfocusだと出ない指定がある）
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('header nav a')].find(x => x.textContent.includes('会社について'));
    a.focus();
  });
  await page.keyboard.press('Tab');
  const focusRing = await page.evaluate(() => {
    const a = document.activeElement;
    const st = getComputedStyle(a);
    return {
      on: (a.textContent || '').includes('相談'),
      ring: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0,
      color: st.outlineColor,
    };
  });
  check('ヘッダーの「相談する」にフォーカス表示がある', focusRing.on && focusRing.ring,
    JSON.stringify(focusRing));

  /* R3: 消したコピーが、Tabキーの順路に残っていない */
  await go(page, 0.5);
  const tabbed = await page.evaluate(() => {
    const hiddenLinks = [...document.querySelectorAll('#opening a')]
      .filter(a => a.closest('[aria-hidden="true"]'));
    return {
      hidden: hiddenLinks.length,
      // inert の中は、ブラウザが順路から外す
      inert: hiddenLinks.every(a => !!a.closest('[inert]')),
    };
  });
  check('消したコピーは操作の順路から外れている', tabbed.hidden === 0 || tabbed.inert,
    `隠れたリンク ${tabbed.hidden}`);
  await page.locator('header nav a:has-text("相談する")').focus();
  const seq = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => {
      const a = document.activeElement;
      return (a?.textContent || a?.tagName || '').trim().slice(0, 12)
        + (a?.closest('[aria-hidden="true"]') ? '（消えている）' : '');
    }));
  }
  check('Tabで、消えたコピーへ入らない', !seq.some(x => x.includes('消えている')), seq.join(' → '));
  await page.keyboard.press('Shift+Tab');
  const back = await page.evaluate(() => (document.activeElement?.textContent || '').trim().slice(0, 12)
    + (document.activeElement?.closest('[aria-hidden="true"]') ? '（消えている）' : ''));
  check('Shift+Tabでも、消えたコピーへ入らない', !back.includes('消えている'), back);
  // 表示に戻れば、また操作できる
  await go(page, 0);
  const restored = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#opening a')].find(x => x.textContent.includes('実物を見る'));
    return { inert: !!a.closest('[inert]'), tabbable: a.tabIndex >= 0 };
  });
  check('戻ってきたら、また操作できる', !restored.inert && restored.tabbable, JSON.stringify(restored));

  /* D1: 背景のロゴ形状は、手前の粒が主役になる前に退いている */
  await go(page, 0.32);
  // 進みきってから測る（なめらかスクロールで着くのが遅れることがある）
  let art = { p: 0, opacity: 1, transform: 'none' };
  for (let i = 0; i < 12; i++) {
    art = await page.evaluate(() => {
      const o = document.getElementById('opening');
      const a = document.querySelector('#opening [aria-hidden="true"] img')?.closest('div');
      const st = getComputedStyle(a);
      return {
        p: +(-o.getBoundingClientRect().top / (o.offsetHeight - window.innerHeight)).toFixed(3),
        opacity: Math.round(parseFloat(st.opacity) * 100) / 100,
        transform: st.transform,
      };
    });
    if (art.p >= 0.3 && art.opacity <= 0.12) break;
    // 画面が前面でないとフレームが間引かれることがある。読み直しを促す
    await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
    await page.waitForTimeout(250);
  }
  check('粒が出そろう頃には、背景の写真は退いている', art.p >= 0.3 && art.opacity <= 0.12,
    `進み ${art.p} / 不透明度 ${art.opacity}`);
  check('背景は暗くするだけでなく、外へ動かしている', art.transform !== 'none');

  check('画面の例外が出ていない（指摘まわり・PC）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

/* ── 15. スマホで「実物を見る」を押したら、実物が見える（D2） ── */
{
  const { page } = await open({ width: 390, height: 844 });
  await page.locator('#opening a:has-text("実物を見る")').click();
  await page.waitForTimeout(2600);
  const seen = await page.evaluate(() => {
    const head = document.querySelector('header').getBoundingClientRect().height;
    const box = document.getElementById('live-demo').getBoundingClientRect();
    const radios = document.querySelectorAll('[data-lhp-demo] [role="radio"]');
    const first = radios[0]?.getBoundingClientRect();
    const frame = document.querySelector('[data-lhp-demo] iframe')?.getBoundingClientRect();
    return {
      demoTop: Math.round(box.top), head: Math.round(head),
      radioTop: first ? Math.round(first.top) : null,
      radioIn: !!first && first.top >= head - 2 && first.bottom <= innerHeight,
      frameIn: !!frame && frame.top < innerHeight && frame.bottom > head,
    };
  });
  check('押した先で、実物の枠が画面に入っている', seen.demoTop < 844 && seen.demoTop >= seen.head - 8,
    `枠の上端 ${seen.demoTop}px / ヘッダー ${seen.head}px`);
  check('見せ方を選ぶところが画面に入っている', seen.radioIn, `上端 ${seen.radioTop}px`);
  check('作った例が画面に入っている', seen.frameIn);
  if (args.shots) await page.screenshot({ path: `${args.shots}/sp-after-cta.png` });
  await page.context().close();
}

/* ── 16. 止めているあいだ、実物のデモも動かない（R5） ── */
{
  const { page } = await open({ width: 1440, height: 900 });
  await page.locator('#live-demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);
  check('通常は、デモも動く設定になっている',
    (await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoMotion)) === 'on');
  await page.locator('#page-motion').click();
  await page.waitForTimeout(500);
  check('止めると、デモにも伝わる',
    (await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoMotion)) === 'off');

  // 止めているあいだに見せ方を変えても、分解・組立をしない
  const states = [];
  const watch = setInterval(async () => {}, 0); clearInterval(watch);
  await page.locator('[data-lhp-demo] [role="radio"]').nth(1).click();
  for (let i = 0; i < 14; i++) {
    states.push(await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-lhp-demo] button')]
        .find(x => x.textContent.includes('ばらす') || x.textContent.includes('組み上げる'));
      return b ? b.textContent.trim() : '';
    }));
    await page.waitForTimeout(180);
  }
  check('止めているあいだは、ばらさずに切り替わる',
    !states.some(x => x.includes('組み上げる')), [...new Set(states)].join(' / '));
  check('選び直しはできる',
    (await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown)) !== 'refined');
  await page.context().close();
}

/* ── 17. 止めているあいだのデモ（P2-1・P2-2の回帰） ── */
{
  const { page, errors } = await open({ width: 1440, height: 900 });
  await page.bringToFront();
  await page.locator('#live-demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);

  /** 中の入れ物を見る（srcDoc の枠） */
  const inner = async () => {
    for (const f of page.frames()) {
      const has = await f.evaluate(() => !!document.querySelector('[data-lhp-block]')).catch(() => false);
      if (has) return f;
    }
    return null;
  };
  const look = async () => {
    const f = await inner();
    if (!f) return null;
    return f.evaluate(() => ({
      e: getComputedStyle(document.documentElement).getPropertyValue('--e').trim(),
      motion: document.documentElement.getAttribute('data-motion'),
      bodyTransform: getComputedStyle(document.body).transform,
      running: (document.getAnimations ? document.getAnimations() : [])
        .filter(a => a.playState === 'running').length,
    }));
  };

  // 1. ばらした状態にする
  await page.locator('[data-lhp-demo] button:has-text("もう一度ばらす")').click();
  await page.waitForTimeout(1300);
  const apart = await look();
  check('ばらすと、中もばらけた状態になる', apart && apart.e === '1', JSON.stringify(apart));

  // 2. ページの動きを止める
  await page.locator('#page-motion').click();
  await page.waitForTimeout(250);
  const justAfter = await look();
  await page.waitForTimeout(1200);
  const settled = await look();
  check('止めると、中へも伝わる', settled && settled.motion === 'off', JSON.stringify(settled));
  check('止めたら、中の形はすぐ組み上がりに戻る',
    justAfter && (justAfter.bodyTransform === 'none' || justAfter.bodyTransform === 'matrix(1, 0, 0, 1, 0, 0)'),
    String(justAfter && justAfter.bodyTransform));
  check('止めたあと、中で動いているものが無い',
    justAfter && justAfter.running === 0 && settled.running === 0,
    `直後 ${justAfter && justAfter.running}件 / 1.2秒後 ${settled && settled.running}件`);
  check('止めているあいだ、ばらす操作は出さない',
    (await page.locator('[data-lhp-demo] button:has-text("ばらす")').count()) === 0
    && (await page.locator('[data-lhp-demo] button:has-text("組み上げる")').count()) === 0);
  check('止めている理由が書いてある',
    (await page.locator('[data-lhp-demo]').innerText()).includes('動きを止めているあいだは'));

  // 3. 止めているあいだも、見せ方は選べる
  const before = await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown);
  await page.locator('[data-lhp-demo] [role="radio"]').nth(2).click();
  await page.waitForTimeout(2600);
  const afterPick = await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown);
  check('止めていても、見せ方は選び直せる', before !== afterPick, `${before} → ${afterPick}`);
  const picked = await look();
  check('選び直しても、ばらけない', picked && picked.e === '0' && picked.running === 0, JSON.stringify(picked));

  // 4. 予約の入力は、停止・再開をまたいでも残る
  await page.locator('[data-lhp-demo] button:has-text("予約フォームまで試す")').click();
  await page.waitForTimeout(1800);
  const f = await inner();
  const typed = await f.evaluate(() => {
    const el = document.querySelector('input[type="text"], input[type="email"], input:not([type]), textarea');
    if (!el) return null;
    el.focus();
    el.value = 'テスト太郎';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return el.value;
  });
  check('中の入力欄に書き込める', typed === 'テスト太郎', String(typed));
  await page.locator('#page-motion').click();   // 再開
  await page.waitForTimeout(900);
  await page.locator('#page-motion').click();   // もう一度止める
  await page.waitForTimeout(900);
  const kept = await (await inner()).evaluate(() => {
    const el = document.querySelector('input[type="text"], input[type="email"], input:not([type]), textarea');
    return el ? el.value : null;
  });
  check('停止・再開をまたいでも、入力は残る', kept === 'テスト太郎', String(kept));

  // 5. 再開しても、触っていない分解が始まらない
  await page.locator('#page-motion').click();   // 再開
  await page.waitForTimeout(1500);
  const back = await look();
  check('再開しても、勝手にばらけない', back && back.e === '0', JSON.stringify(back));
  check('再開したら、ばらす操作が戻る',
    (await page.locator('[data-lhp-demo] button:has-text("ばらす")').count()) === 1);
  check('画面の例外が出ていない（止めているデモ）', errors.length === 0, errors.slice(0, 2).join(' / '));
  await page.context().close();
}

/* ── 18. 端末の「動きを減らす」設定でのデモ ── */
{
  const { page } = await open({ width: 390, height: 844, reduced: true });
  await page.locator('#live-demo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  check('動きを減らす設定では、ばらす操作を出さない',
    (await page.locator('[data-lhp-demo] button:has-text("ばらす")').count()) === 0
    && (await page.locator('[data-lhp-demo] button:has-text("組み上げる")').count()) === 0);
  check('動きを減らす設定でも、理由が書いてある',
    (await page.locator('[data-lhp-demo]').innerText()).includes('動きを止めているあいだは'));
  const shown0 = await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown);
  await page.locator('[data-lhp-demo] [role="radio"]').nth(1).click();
  await page.waitForTimeout(2600);
  check('動きを減らす設定でも、見せ方は選び直せる',
    (await page.evaluate(() => document.querySelector('[data-lhp-demo]').dataset.lhpDemoShown)) !== shown0);
  const f = page.frames().find(x => x.url() === 'about:srcdoc');
  const st = f ? await f.evaluate(() => ({
    motion: document.documentElement.getAttribute('data-motion'),
    running: (document.getAnimations ? document.getAnimations() : []).filter(a => a.playState === 'running').length,
  })).catch(() => null) : null;
  check('動きを減らす設定では、中でも動いていない', st && st.motion === 'off' && st.running === 0, JSON.stringify(st));
  if (args.shots) await page.screenshot({ path: `${args.shots}/sp-reduced-demo.png` });
  await page.context().close();
}

await browser.close();
console.log(`\n通過 ${ok.length} / 失敗 ${ng.length}`);
if (ng.length) { ng.forEach(n => console.log(`  - ${n}`)); process.exit(1); }
console.log('会社トップの体験を確認しました');
