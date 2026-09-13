// Local production build only. Real video decoding and WebGL rendering; no real sends.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw Error('Local only');
const out = process.env.OUTPUT_DIR || '/tmp/lp-cinema-check';
fs.mkdirSync(out, { recursive: true });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail || '');
  if (!ok) throw Error(name);
};
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
async function context(width, reducedMotion = 'no-preference') {
  const c = await b.newContext({
    viewport: { width, height: width === 1440 ? 1000 : 844 },
    reducedMotion,
    locale: 'ja-JP',
  });
  const fonts = await installLocalFonts(c);
  await c.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
    r.abort(),
  );
  return { c, fonts };
}
try {
  for (const width of [390, 320, 1440]) {
    const { c, fonts } = await context(width);
    const p = await c.newPage(),
      errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
    check(
      width + ' Japanese headline',
      /その仕事に、\s*ふさわしい\s*ホームページを。/.test(
        await p.locator('h1').innerText(),
      ),
    );
    if (width === 1440)
      check(
        'PC copy and scene each have room',
        await p.evaluate(
          () =>
            document.querySelector('.lp-hero-copy').getBoundingClientRect()
              .width > 500 &&
            document.querySelector('.lp-showcase').getBoundingClientRect()
              .width > 600,
        ),
      );
    check(
      width + ' no overflow',
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    check(
      width + ' headline and CTA visible',
      await p
        .locator('.lp-hero-actions .lp-button')
        .evaluate((e) => e.getBoundingClientRect().bottom < innerHeight),
    );
    await p
      .locator('.lp-sculpture[data-ready=true]')
      .waitFor({ timeout: 20000 });
    await p.waitForFunction(() => {
      const v = document.querySelector('video');
      return v.currentTime > 0.1 && !v.paused;
    });
    check(
      width + ' actual muted inline video',
      await p
        .locator('video')
        .evaluate(
          (v) => v.muted && v.playsInline && v.videoWidth > 0 && !v.paused,
        ),
    );
    check(
      width + ' responsive video file',
      (await p.locator('video').getAttribute('src')).includes(
        width < 700 ? 'mobile' : 'desktop',
      ),
    );
    check(
      width + ' real 3D canvas',
      await p
        .locator('.lp-webgl canvas')
        .evaluate((c) => !!c.getContext('webgl2') && c.width > 100),
    );
    await p.locator('.lp-showcase-stage').scrollIntoViewIfNeeded();
    await p.waitForTimeout(1000);
    const canvas = p.locator('.lp-webgl canvas');
    const before = await canvas.screenshot();
    await p
      .getByRole('button', { name: '立体で分解して見る', exact: true })
      .click();
    await p.waitForTimeout(900);
    const after = await canvas.screenshot();
    check(width + ' rendered geometry changes', !before.equals(after));
    await p.locator('.lp-film-control').scrollIntoViewIfNeeded();
    const geometry = () =>
      p
        .locator('.lp-cinema')
        .evaluate((e) => ({
          height: e.getBoundingClientRect().height,
          scroll: scrollY,
        }));
    const g1 = await geometry();
    await p.getByRole('button', { name: '動きを止める', exact: true }).click();
    const t1 = await p.locator('video').evaluate((v) => v.currentTime);
    await p.waitForTimeout(700);
    const t2 = await p.locator('video').evaluate((v) => v.currentTime);
    check(width + ' video freezes', Math.abs(t2 - t1) < 0.08, { t1, t2 });
    check(
      width + ' no height or scroll jump',
      JSON.stringify(g1) === JSON.stringify(await geometry()),
    );
    check(
      width + ' motion action absent when paused',
      (await p.locator('.lp-scene-actions button').count()) === 0,
    );
    const still1 = await canvas.screenshot();
    await p.waitForTimeout(500);
    const still2 = await canvas.screenshot();
    check(width + ' WebGL freezes too', still1.equals(still2));
    await p.getByRole('button', { name: '動きを再開', exact: true }).click();
    await p.waitForTimeout(400);
    check(
      width + ' video resumes',
      !(await p.locator('video').evaluate((v) => v.paused)),
    );
    await p.getByRole('radio', { name: '飲食店・カフェ', exact: true }).click();
    await p.locator('.lp-sculpture[data-ready=true]').waitFor();
    check(
      width + ' industry selection and destination',
      (await p.locator('.lp-showcase-caption a').getAttribute('href')).endsWith(
        'industry=restaurant',
      ),
    );
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(400);
    await p.screenshot({ path: out + '/' + width + '-hero.png' });
    await p.locator('#price').scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    check(
      width + ' offscreen video stops',
      await p.locator('video').evaluate((v) => v.paused),
    );
    await p.locator('#experience').scrollIntoViewIfNeeded();
    await p.locator('.cl-lab[data-ready=true]').waitFor({ timeout: 20000 });
    check(
      width + ' real editing demo still works',
      (await p.locator('.cl-directions button').count()) === 3,
    );
    check(width + ' no page errors', errors.length === 0, errors);
    await c.close();
    await fonts.close();
  }
  const { c, fonts } = await context(390, 'reduce');
  const requested = [];
  c.on('request', (r) => requested.push(r.url()));
  const p = await c.newPage();
  await p.goto(base + '/laruHP', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  check(
    'reduced motion no video request',
    !requested.some((u) => /flow-(mobile|desktop)\.mp4/.test(u)),
  );
  check(
    'reduced motion no canvas',
    (await p.locator('.lp-webgl canvas').count()) === 0,
  );
  check(
    'reduced motion fallback visible',
    await p
      .locator('.lp-main-window')
      .evaluate((e) => getComputedStyle(e).opacity === '1'),
  );
  check(
    'reduced motion no restart control',
    (await p.locator('.lp-film-control').count()) === 0,
  );
  await p.screenshot({ path: out + '/390-reduced.png' });
  await c.close();
  await fonts.close();
  const f = await context(390);
  const page = await f.c.newPage();
  await page.goto(base + '/laruHP', { waitUntil: 'networkidle' });
  await page.locator('.lp-sculpture[data-ready=true]').waitFor();
  await page
    .locator('canvas')
    .evaluate((c) =>
      c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(),
    );
  await page.locator('.lp-webgl').waitFor({ state: 'detached' });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.lp-main-window')).opacity ===
      '1',
  );
  check(
    'context loss restores screenshot',
    await page
      .locator('.lp-main-window')
      .evaluate((e) => getComputedStyle(e).opacity === '1'),
  );
  await f.c.close();
  await f.fonts.close();
  const n = await b.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const np = await n.newPage();
  await np.goto(base + '/laruHP');
  check(
    'no JS headline and CTA available',
    (await np.locator('h1').isVisible()) &&
      (await np.locator('.lp-hero-actions a').first().isVisible()),
  );
  check(
    'no JS fallback image visible',
    await np
      .locator('.lp-main-window')
      .evaluate((e) => getComputedStyle(e).opacity === '1'),
  );
  await n.close();
} finally {
  await b.close();
  fs.writeFileSync(
    out + '/results.json',
    JSON.stringify(
      {
        conditions:
          'isolated production build, local matching font files, actual delivered mp4; Chromium SwiftShader WebGL; not device performance',
        results,
      },
      null,
      2,
    ),
  );
}
