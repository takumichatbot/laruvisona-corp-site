// Local production build + isolated DB. No real account, AI, notifications or production writes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const base = 'http://127.0.0.1:3319',
  out = process.env.OUTPUT_DIR || '/tmp/laruhp-directions';
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail || '');
  if (!ok) throw Error(name);
};
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
const browser = await chromium.launch();
let lastId;
try {
  for (const width of [390, 320, 1440]) {
    const ctx = await browser.newContext({
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
          value: () => Promise.reject(Error('Offline check')),
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
    await p
      .locator('.cl-lab[data-ready=true]')
      .waitFor({ timeout: 10000 })
      .catch(async (e) => {
        console.log(
          'DEBUG',
          await p.locator('.cl-lab').getAttribute('data-ready'),
          await p.locator('.cl-lab iframe').count(),
          errors,
        );
        await p.screenshot({ path: out + '/error.png' });
        throw e;
      });
    const lab = p.frameLocator(
      'iframe[title="いまつくっているサイトの完成像"]',
    );
    const labels = ['美容', '飲食', '工事', '物販', '整体'];
    for (const label of labels) {
      await p
        .getByRole('group', { name: '試作する業種' })
        .getByRole('button', { name: label, exact: true })
        .click();
      await p.waitForTimeout(350);
      await p.locator('.cl-lab[data-ready=true]').waitFor();
      check(
        width + ' reference ' + label,
        (await lab.locator('.lhp-gallery img').count()) > 0,
      );
    }
    await p
      .getByRole('group', { name: '試作する業種' })
      .getByRole('button', { name: '工事', exact: true })
      .click();
    await p
      .getByLabel('店名・会社名', { exact: true })
      .fill('私たちの設計室 ' + width);
    await p.locator('.cl-copy summary').click();
    const heading =
      '小さな暮らしの想いから、ずっと大切にしたくなる住まいのかたちを一緒に考えます。';
    await p.getByLabel('最初の見出し', { exact: true }).fill(heading);
    await p.locator('.cl-copy summary').click();
    const orders = [];
    for (const [label, id] of [
      ['言葉で伝える', 'editorial'],
      ['写真で惹きつける', 'immersive'],
      ['内容で選んでもらう', 'catalog'],
    ]) {
      await p
        .getByRole('group', { name: '構成の違う3案' })
        .getByRole('button', { name: new RegExp(label) })
        .click();
      await lab.locator('.lhp-hero[data-composition="' + id + '"]').waitFor();
      await lab.locator('h1').filter({ hasText: heading }).waitFor();
      check(
        width + ' ' + id + ' actual copy',
        (await lab.locator('h1').innerText()) === heading,
      );
      orders.push(
        await lab
          .locator('[data-lhp-block]')
          .evaluateAll((els) =>
            els.map((el) => el.getAttribute('data-lhp-block')).join(','),
          ),
      );
      check(
        width + ' ' + id + ' no iframe overflow',
        await lab
          .locator('body')
          .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      await p
        .locator('.cl-lab')
        .screenshot({ path: `${out}/${width}-${id}.png` });
    }
    check(
      width + ' service-first order differs from photo-first',
      new Set(orders).size >= 2,
      orders,
    );
    await p
      .getByRole('button', { name: 'このまま制作を続ける', exact: true })
      .click();
    await p.locator('.se-editor').waitFor();
    const frame = p.frameLocator('iframe[title="できあがりの見え方"]');
    await frame.locator('h1').filter({ hasText: heading }).waitFor();
    const source = () =>
      p.locator('iframe[title="できあがりの見え方"]').getAttribute('srcdoc');
    await frame.locator('h1').click();
    await p.locator('[data-field-key=heading]').waitFor();
    const upload = p.waitForResponse(
      (r) =>
        r.url().endsWith('/api/images/upload') &&
        r.request().method() === 'POST',
    );
    await p
      .locator('[data-field-key=bgImage] input[type=file]')
      .setInputFiles('public/salon/style-1.jpg');
    const uploaded = await upload;
    const photo = (await uploaded.json()).url;
    check(width + ' own photo through real upload', uploaded.ok() && !!photo);
    await p.getByRole('button', { name: '見せ方', exact: true }).click();
    await p
      .getByLabel('スマホの写真の収め方', { exact: true })
      .selectOption('contain');
    await p.waitForTimeout(400);
    if (width < 900)
      await p.getByRole('button', { name: '色・書体', exact: true }).click();
    else
      await p
        .locator('.se-settings-tabs')
        .getByRole('button', { name: 'サイト全体', exact: true })
        .click();
    const editor = p.locator('.de-editor');
    const before = await source();
    await editor.getByRole('button', { name: /言葉で伝える/ }).click();
    const candidate = p.frameLocator('iframe[title="採用前の構成案"]');
    await candidate.locator('h1').waitFor();
    check(
      width + ' preview does not mutate current',
      (await source()) === before,
    );
    check(
      width + ' comparison is modal',
      await p.locator('.dr-dialog').evaluate((el) => el.matches(':modal')),
    );
    check(
      width + ' comparison has usable photo area',
      await p
        .locator('.dr-preview .de-frame')
        .evaluate((el) => el.clientHeight > 250),
    );
    check(
      width + ' candidate retains own image',
      (await candidate.locator('.lhp-hero-img').getAttribute('src')) === photo,
    );
    check(
      width + ' candidate retains full copy',
      (await candidate.locator('h1').innerText()) === heading,
    );
    for (const [label, id] of [
      ['写真で惹きつける', 'immersive'],
      ['内容で選んでもらう', 'catalog'],
    ]) {
      await p
        .locator('.dr-options-list')
        .getByRole('button', { name: new RegExp(label) })
        .click();
      await candidate
        .locator('.lhp-hero[data-composition=' + id + ']')
        .waitFor();
      const image = candidate.locator('.lhp-adaptive-mobile-photo');
      await image.evaluate(async (img) => {
        await img.decode();
      });
      const layout = await image.evaluate((img) => ({
        ratio: img.clientWidth / img.clientHeight,
        natural: img.naturalWidth / img.naturalHeight,
        top: img.getBoundingClientRect().top,
        copy: document
          .querySelector('.lhp-hero-content')
          .getBoundingClientRect().bottom,
      }));
      check(
        width + ' ' + id + ' whole photo stays below copy',
        Math.abs(layout.ratio - layout.natural) < 0.01 &&
          layout.top >= layout.copy,
        layout,
      );
    }
    await p
      .locator('.dr-options-list')
      .getByRole('button', { name: /言葉で伝える/ })
      .click();
    await editor.getByRole('button', { name: 'パソコン', exact: true }).click();
    check(
      width + ' PC comparison canvas',
      await p
        .locator('iframe[title="採用前の構成案"]')
        .evaluate((el) => parseFloat(el.style.width) === 1100),
    );
    await editor.getByRole('button', { name: 'スマホ', exact: true }).click();
    await p
      .locator('.dr-dialog')
      .screenshot({ path: `${out}/${width}-compare.png` });
    await p.keyboard.press('Escape');
    check(
      width + ' Escape closes comparison',
      (await p.locator('.dr-dialog').count()) === 0,
    );
    check(width + ' cancel unchanged', (await source()) === before);
    await editor.getByRole('button', { name: /言葉で伝える/ }).click();
    await editor
      .getByRole('button', { name: 'この構成を採用する', exact: true })
      .click();
    await frame.locator('.lhp-hero[data-composition=editorial]').waitFor();
    check(
      width + ' adoption keeps full copy',
      (await frame.locator('h1').innerText()) === heading,
    );
    await p
      .getByRole('button', { name: /取り消す/ })
      .first()
      .click();
    await frame.locator('.lhp-hero[data-composition=catalog]').waitFor();
    check(width + ' undo restores direction', true);
    await editor.getByRole('button', { name: /言葉で伝える/ }).click();
    await editor
      .getByRole('button', { name: 'この構成を採用する', exact: true })
      .click();
    await frame.locator('.lhp-hero[data-composition=editorial]').waitFor();
    if (width < 900)
      await p.getByRole('button', { name: '完成像', exact: true }).click();
    check(
      width + ' studio outer width',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      width + ' studio canvas width',
      await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    );
    await p.screenshot({ path: `${out}/${width}-studio.png` });
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
    lastId = row.id;
    check(width + ' saved through owner API', res.ok() && !!lastId);
    const record = (
      await (await p.request.get(base + '/api/sites/' + lastId)).json()
    ).site;
    const hero = record.blocks_json.pages[0].blocks.find(
      (b) => b.type === 'hero',
    );
    check(
      width + ' saved direction photo and fit',
      hero.data.compositionStyle === 'editorial' &&
        hero.data.mobilePhotoFit === 'contain' &&
        hero.data.bgImage === photo,
    );
    await p.goto(base + '/laruHP/studio?siteId=' + lastId, {
      waitUntil: 'networkidle',
    });
    await frame.locator('h1').filter({ hasText: heading }).waitFor();
    check(
      width + ' reopen retains heading and direction',
      (await frame.locator('.lhp-hero[data-composition=editorial]').count()) ===
        1,
    );
    // Publish through the actual local owner route; this fixture has no external notifications.
    const published = await p.request.post(
      base + '/api/sites/' + lastId + '/publish',
    );
    check(width + ' real publish API', published.ok(), {
      status: published.status(),
    });
    await p.goto(base + '/hp/' + encodeURIComponent(record.slug), {
      waitUntil: 'networkidle',
    });
    await p.locator('.lhp-hero-img').waitFor();
    await p.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map((i) => i.decode().catch(() => {})),
      );
    });
    check(
      width + ' published full text',
      (await p.locator('h1').innerText()) === heading,
    );
    check(
      width + ' published no overflow',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width < 900) {
      const dims = await p.locator('.lhp-hero-img').evaluate((img) => ({
        ratio: img.clientWidth / img.clientHeight,
        natural: img.naturalWidth / img.naturalHeight,
        h1: document.querySelector('h1').getBoundingClientRect().bottom,
        photo: img.getBoundingClientRect().top,
      }));
      check(
        width + ' whole portrait survives without overlap',
        Math.abs(dims.ratio - dims.natural) < 0.01 && dims.photo > dims.h1,
        dims,
      );
    }
    await p
      .locator('.lhp-hero')
      .screenshot({ path: `${out}/${width}-published.png` });
    check(width + ' no JS errors', errors.length === 0, errors);
    await ctx.close();
    await fonts.close();
  }
} finally {
  fs.writeFileSync(
    out + '/results.json',
    JSON.stringify(
      {
        conditions:
          'Local production build, fake PostgREST, local selected fonts, service worker disabled only in browser harness; no AI calls',
        lastId,
        results,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
