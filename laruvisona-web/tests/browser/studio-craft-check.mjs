// 実ビルド＋隔離DB。AIの生成応答だけを差し替え、実モデルの品質・課金は検証しない。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';
const require = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
);
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3319',
  fix = 'http://127.0.0.1:54999',
  out = process.env.OUTPUT_DIR || '/tmp/laruhp-five';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('local only');
fs.mkdirSync(out, { recursive: true });
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail || '');
  if (!ok) throw Error(name);
}
const session = {
  access_token: 'stub',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'r',
  user: {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    email: 'owner@example.com',
    aud: 'authenticated',
    role: 'authenticated',
  },
};
const b = await chromium.launch();
let lastId;
try {
  for (const width of [390, 320, 1440]) {
    const ctx = await b.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      locale: 'ja-JP',
    });
    await ctx.addCookies(
      ['sb-127-auth-token', 'sb-localhost-auth-token'].map((name) => ({
        name,
        value:
          'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'),
        domain: '127.0.0.1',
        path: '/',
      })),
    );
    await ctx.addInitScript(() => {
      try {
        Object.defineProperty(navigator.serviceWorker, 'register', {
          value: () => Promise.reject(new Error('Offline browser check')),
        });
      } catch {}
    });
    const fonts = await installLocalFonts(ctx);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
      r.abort(),
    );
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
    await p.locator('.cl-lab').scrollIntoViewIfNeeded();
    await p.locator('.cl-lab[data-ready=true]').waitFor();
    check(
      width + ' landing no overflow',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p
      .getByRole('group', { name: '試作する業種' })
      .getByRole('button', { name: '飲食', exact: true })
      .click();
    await p
      .getByLabel('店名・会社名', { exact: true })
      .fill('喫茶 ひかり ' + width);
    await p
      .getByRole('group', { name: '見せ方を選ぶ' })
      .getByRole('button', { name: 'やわらかい', exact: true })
      .click();
    await p.getByRole('button', { name: '建築と光', exact: true }).click();
    await p.locator('.cl-copy summary').click();
    await p
      .getByLabel('最初の見出し', { exact: true })
      .fill('一杯から、\nいい一日を。');
    await p.waitForTimeout(400);
    const lab = p.frameLocator(
      'iframe[title="いまつくっているサイトの完成像"]',
    );
    await lab.locator('h1').filter({ hasText: '一杯から、' }).waitFor();
    check(
      width + ' real export has selected copy',
      (await lab.locator('h1').innerText()) === '一杯から、\nいい一日を。',
    );
    check(
      width + ' real export has selected photo',
      (await lab.locator('.lhp-hero-img').getAttribute('src')).includes(
        'architecture.webp',
      ),
    );
    await p.locator('.cl-copy summary').click();
    await p.getByRole('button', { name: '立体で眺める', exact: true }).click();
    await p.waitForTimeout(750);
    check(
      width + ' depth is a real transformed page',
      await p
        .locator('.cl-page')
        .evaluate((el) => getComputedStyle(el).transform !== 'none'),
    );
    await p
      .locator('.cl-lab')
      .screenshot({ path: out + '/' + width + '-creation.png' });
    await p
      .getByRole('button', { name: 'このまま制作を続ける', exact: true })
      .click();
    await p.locator('.se-editor').waitFor();
    const f = p.frameLocator('iframe[title="できあがりの見え方"]');
    await f.locator('h1').filter({ hasText: '一杯から、' }).waitFor();
    check(
      width + ' handoff same copy',
      (await f.locator('h1').innerText()) === '一杯から、\nいい一日を。',
    );
    check(
      width + ' handoff same photo',
      (await f.locator('.lhp-hero-img').getAttribute('src')).includes(
        'architecture.webp',
      ),
    );
    check(
      width + ' handoff same design',
      (
        await p
          .locator('iframe[title="できあがりの見え方"]')
          .getAttribute('srcdoc')
      ).includes('#fffdf9'),
    );
    check(
      width + ' token consumed',
      await p.evaluate(
        () => sessionStorage.getItem('laruhp.creation-choice') === null,
      ),
    );
    check(
      width + ' editor no overflow',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await f.locator('h1').click();
    await p.locator('[data-field-key=heading]').waitFor();
    check(
      width + ' tapped text opens own field',
      await p.locator('[data-field-key=heading]').isVisible(),
    );
    if (width < 900) {
      const before = await p
        .locator('.se-settings')
        .evaluate((el) => el.getBoundingClientRect().height);
      await p.getByRole('button', { name: '編集欄を広げる' }).click();
      await p.locator('.se-editor[data-sheet-expanded=true]').waitFor();
      const after = await p
        .locator('.se-settings')
        .evaluate((el) => el.getBoundingClientRect().height);
      check(width + ' sheet expands', after > before * 1.4, { before, after });
    }
    await p.getByRole('button', { name: '見せ方', exact: true }).click();
    await p
      .getByRole('button', { name: '写真に文字を添える', exact: true })
      .click();
    await p.getByLabel('上に足す余白', { exact: true }).selectOption('sm');
    await p.getByRole('button', { name: '奥から近づく', exact: true }).click();
    await p.waitForTimeout(400);
    let html = await p
      .locator('iframe[title="できあがりの見え方"]')
      .getAttribute('srcdoc');
    check(
      width + ' section layout changed',
      !html.includes('class="lhp-hero lhp-hero-split"'),
    );
    check(
      width + ' section spacing and motion exported',
      html.includes('padding-top:24px') &&
        html.includes('data-lhp-anim="zoom"'),
    );
    await p.getByRole('button', { name: '内容', exact: true }).click();
    await p
      .locator('[data-field-key=heading] textarea')
      .fill('私の文章 ' + width);
    await p.waitForTimeout(400);
    await p.getByRole('button', { name: 'AIに相談', exact: true }).click();
    let aiCalls = 0;
    await ctx.route(/\/api\/ai\/section-proposal(?:\?.*)?$/, async (route) => {
      aiCalls++;
      const body = route.request().postDataJSON();
      check(
        width + ' AI request only scoped copy',
        body.block.type === 'hero' && !('bgImage' in body.block.data),
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal: {
            changes: {
              heading: '提案された見出し' + aiCalls,
              subheading: '提案された紹介文',
            },
          },
        }),
      });
    });
    await p
      .getByRole('button', { name: '短く、わかりやすく', exact: true })
      .click();
    await p
      .getByRole('button', { name: '変更案をつくる', exact: true })
      .click();
    await p
      .locator('.sc-proposals')
      .waitFor({ timeout: 6000 })
      .catch(async (e) => {
        console.log('ASSISTANT', await p.locator('.sc-assistant').innerText());
        await p.screenshot({ path: out + '/ai-error.png' });
        throw e;
      });
    check(
      width + ' AI proposal does not auto-apply',
      (
        await p
          .locator('iframe[title="できあがりの見え方"]')
          .getAttribute('srcdoc')
      ).includes('私の文章 ' + width),
    );
    await p.locator('.sc-proposal input').nth(1).uncheck();
    await p
      .locator('.sc-proposals')
      .screenshot({ path: out + '/' + width + '-ai-proposal.png' });
    await p
      .getByRole('button', { name: '選んだ1か所を採用', exact: true })
      .click();
    await p.waitForTimeout(400);
    html = await p
      .locator('iframe[title="できあがりの見え方"]')
      .getAttribute('srcdoc');
    check(
      width + ' only checked field applied',
      html.includes('提案された見出し') && !html.includes('提案された紹介文'),
    );
    await p
      .getByRole('button', { name: '変更案をつくる', exact: true })
      .click();
    await p.locator('.sc-proposals').waitFor();
    await p
      .getByRole('button', { name: '取り消す', exact: false })
      .first()
      .click();
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: /選んだ.*か所を採用/ }).click();
    check(
      width + ' stale proposal refused',
      await p.locator('.sc-error').isVisible(),
    );
    check(width + ' two explicit AI requests only', aiCalls === 2);
    await p.getByRole('button', { name: '見せ方', exact: true }).click();
    await p.screenshot({ path: out + '/' + width + '-studio.png' });
    const save = p.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/sites' &&
        r.request().method() === 'POST',
    );
    await p
      .locator('header')
      .getByRole('button', { name: '保存', exact: true })
      .click();
    const res = await save;
    const row = (await res.json()).site;
    check(width + ' real save API', res.ok() && !!row?.id);
    lastId = row.id;
    const db = (
      await (await fetch(fix + '/rest/v1/sites?id=eq.' + row.id)).json()
    )[0];
    const hero = db.blocks_json.pages[0].blocks.find((x) => x.type === 'hero');
    check(
      width + ' presentation persists',
      hero.data.heroLayout === 'left' &&
        hero.data.paddingTop === 'sm' &&
        hero.data.animation === 'zoom',
    );
    check(width + ' mood persists', db.settings_json.designPreset === 'warm');
    await p.goto(base + '/laruHP/studio?siteId=' + row.id, {
      waitUntil: 'networkidle',
    });
    await p.locator('.se-editor').waitFor();
    await f
      .locator('h1')
      .filter({ hasText: '私の文章 ' + width })
      .waitFor();
    check(width + ' saved copy survives reopen', true);
    const noProvider = await p.request.post(base + '/api/ai/section-proposal', {
      data: {
        siteId: row.id,
        block: { id: hero.id, type: 'hero', data: { heading: 'h' } },
        prompt: '短く',
      },
    });
    check(
      width + ' real API unavailable without provider',
      noProvider.status() === 503,
      { status: noProvider.status() },
    );
    check(width + ' no JS exceptions', errors.length === 0, errors);
    await ctx.close();
    await fonts.close();
  }
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        value: () => Promise.reject(new Error('Offline browser check')),
      });
    } catch {}
  });
  const fonts = await installLocalFonts(ctx);
  await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
    r.abort(),
  );
  const p = await ctx.newPage();
  await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
  await p.locator('.cl-lab').scrollIntoViewIfNeeded();
  await p.locator('.cl-lab[data-ready=true]').waitFor();
  check(
    'reduced motion has no depth control',
    !(await p.locator('.cl-depth').isVisible()),
  );
  check(
    'reduced motion completed preview visible',
    await p
      .frameLocator('iframe[title="いまつくっているサイトの完成像"]')
      .locator('h1')
      .isVisible(),
  );
  const unauth = await p.request.post(base + '/api/ai/section-proposal', {
    data: {},
  });
  check('AI API requires login', unauth.status() === 401);
  await ctx.close();
  await fonts.close();
} finally {
  await b.close();
  fs.writeFileSync(
    out + '/results.json',
    JSON.stringify({ results, lastId }, null, 2),
  );
}
console.log('Passed ' + results.length);
