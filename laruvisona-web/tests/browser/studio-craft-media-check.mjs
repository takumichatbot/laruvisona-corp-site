// new craft flow補足。ローカルの実API、動画ファイル、公開HTMLを通す。送信・外部AIは実行しない。
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const base = 'http://127.0.0.1:3319',
  fix = 'http://127.0.0.1:54999',
  out = process.env.OUTPUT_DIR || '/tmp/laruhp-five';
const { lastId: id } = JSON.parse(fs.readFileSync(out + '/results.json'));
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(ok ? 'OK' : 'FAIL', name, detail || '');
  if (!ok) throw Error(name);
}
const owner = '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  session = {
    access_token: 'stub',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'r',
    user: {
      id: owner,
      email: 'owner@example.com',
      aud: 'authenticated',
      role: 'authenticated',
    },
  };
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'ja-JP',
});
const fonts = await installLocalFonts(ctx);
await ctx.addInitScript(() => {
  try {
    Object.defineProperty(navigator.serviceWorker, 'register', {
      value: () => Promise.reject(new Error('Offline browser check')),
    });
  } catch {}
});
await ctx.addCookies(
  ['sb-127-auth-token', 'sb-localhost-auth-token'].map((name) => ({
    name,
    value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64'),
    domain: '127.0.0.1',
    path: '/',
  })),
);
await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
  r.abort(),
);
let movies = 0;
await ctx.route('**/local-craft-video.mp4', (r) => {
  movies++;
  return r.fulfill({
    status: 200,
    contentType: 'video/mp4',
    body: fs.readFileSync('tests/fixtures/hero-motion-test.mp4'),
  });
});
const p = await ctx.newPage(),
  errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const load = async () =>
  (await (await p.request.get(base + '/api/sites/' + id)).json()).site;
try {
  await p.goto(base + '/laruHP/studio?siteId=' + id, {
    waitUntil: 'networkidle',
  });
  await p.locator('.se-editor').waitFor();
  const before = await load();
  const plain = {
    block: { id: 'hero', type: 'hero', data: { heading: '元の文章' } },
    prompt: '短く',
  };
  for (const [name, data, status] of [
    ['other site', { ...plain, siteId: 'id-b' }, 403],
    [
      'unknown block',
      { ...plain, block: { id: 'x', type: 'missing', data: { heading: 'x' } } },
      400,
    ],
    [
      'invalid block',
      { ...plain, block: { id: 'x', type: 'hero', data: [] } },
      400,
    ],
    ['oversized prompt', { ...plain, prompt: 'x'.repeat(501) }, 400],
  ]) {
    const r = await p.request.post(base + '/api/ai/section-proposal', { data });
    check('AI real API ' + name, r.status() === status, { status: r.status() });
  }
  check(
    'AI rejected requests do not save site',
    JSON.stringify((await load()).blocks_json) ===
      JSON.stringify(before.blocks_json),
  );
  await p.getByRole('button', { name: 'ページの中身', exact: true }).click();
  await p.locator('.se-block-select').filter({ hasText: '最初の画面' }).click();
  await p.getByRole('button', { name: '見せ方', exact: true }).click();
  await p
    .getByRole('button', { name: '写真と文字を分ける', exact: true })
    .click();
  await p
    .getByLabel('動画のURL（MP4）', { exact: true })
    .fill(base + '/local-craft-video.mp4');
  await p.getByRole('button', { name: '完成像', exact: true }).click();
  const f = p.frameLocator('iframe[title="できあがりの見え方"]');
  await f.locator('video').waitFor();
  check('video loads after choosing it', movies > 0);
  check(
    'video is muted and inline',
    await f.locator('video').evaluate((v) => v.muted && v.playsInline),
  );
  await p.getByRole('button', { name: 'ページの中身', exact: true }).click();
  await p
    .locator('.se-block-select')
    .filter({ hasText: '写真をならべる' })
    .click();
  while (
    await p
      .locator('[data-field-key=images]')
      .getByRole('button', { name: '削除', exact: true })
      .count()
  )
    await p
      .locator('[data-field-key=images]')
      .getByRole('button', { name: '削除', exact: true })
      .first()
      .click();
  for (let i = 1; i <= 2; i++) {
    await p.getByRole('button', { name: '＋ 追加する', exact: true }).click();
    const uploaded = p.waitForResponse(
      (r) =>
        r.url().endsWith('/api/images/upload') &&
        r.request().method() === 'POST',
    );
    await p
      .getByLabel('写真 ' + i + 'のファイル', { exact: true })
      .setInputFiles(
        i === 1
          ? 'public/company/concepts/retreat.webp'
          : 'public/company/concepts/ceramics.webp',
      );
    check('gallery upload ' + i, (await uploaded).ok());
    await p
      .getByText('写真を差し替えました。', { exact: false })
      .first()
      .waitFor();
  }
  await p.getByRole('button', { name: '見せ方', exact: true }).click();
  await p
    .getByRole('button', { name: 'スクロールで重ねる', exact: true })
    .click();
  await p.waitForTimeout(400);
  check(
    'gallery two actual images and stacking',
    (await f.locator('.lhp-gallery-stack img').count()) === 2,
  );
  check(
    'gallery stacking computed',
    await f
      .locator('.lhp-gallery-stack img')
      .first()
      .evaluate((el) => getComputedStyle(el).position === 'sticky'),
  );
  const saved = p.waitForResponse(
    (r) =>
      r.url().endsWith('/api/sites/' + id) && r.request().method() === 'PUT',
  );
  await p
    .locator('header')
    .getByRole('button', { name: '保存', exact: true })
    .click();
  check('media saved through owner API', (await saved).ok());
  const latest = await load();
  check(
    'gallery mode saved',
    latest.blocks_json.pages[0].blocks.find((x) => x.type === 'gallery').data
      .galleryLayout === 'stack',
  );
  check(
    'video URL saved',
    latest.blocks_json.pages[0].blocks.find((x) => x.type === 'hero').data
      .heroVideo ===
      base + '/local-craft-video.mp4',
  );
  const published = await p.request.post(
    base + '/api/sites/' + id + '/publish',
  );
  check('local owner publish API', published.ok());
  const row = await load();
  check(
    'published HTML version14 and media',
    row.published_html.includes('<!--lhpv:15-->') &&
      row.published_html.includes('lhp-gallery-stack') &&
      row.published_html.includes('/local-craft-video.mp4'),
  );
  await p.goto(base + '/hp/' + encodeURIComponent(row.slug), {
    waitUntil: 'networkidle',
  });
  await p.locator('.lhp-gallery-stack').waitFor();
  check(
    'real public URL serves new gallery',
    (await p.locator('.lhp-gallery-stack img').count()) === 2,
  );
  await p.locator('.lhp-gallery-stack').scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -100));
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + '/390-gallery-published.png' });
  const top = await p
    .locator('.lhp-gallery-stack')
    .evaluate((el) => el.getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => scrollTo(0, y + 120), top);
  await p.waitForTimeout(250);
  const pos1 = await p
    .locator('.lhp-gallery-stack img')
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  await p.evaluate(() => scrollBy(0, 90));
  await p.waitForTimeout(250);
  const pos2 = await p
    .locator('.lhp-gallery-stack img')
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  check(
    'gallery photo actually sticks while scrolling',
    Math.abs(pos1 - 80) < 2 && Math.abs(pos2 - pos1) < 2,
    { pos1, pos2 },
  );
  await p.emulateMedia({ reducedMotion: 'reduce' });
  const count = movies;
  await p.reload({ waitUntil: 'networkidle' });
  check(
    'reduced motion gallery is static',
    await p
      .locator('.lhp-gallery-stack img')
      .first()
      .evaluate((el) => getComputedStyle(el).position === 'static'),
  );
  check('reduced motion never fetches video', movies === count);
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  // 引き継ぎの文字と既存の編集は明確に区別する。
  const choice = {
    industry: 'beauty',
    preset: 'refined',
    photo: 'salon',
    presentation: 'split',
    name: '今回の見本',
    heading: '今回の見出し',
    description: '今回の説明',
  };
  await p.evaluate(
    ({ choice, row, owner }) => {
      sessionStorage.setItem(
        'laruhp.creation-choice',
        JSON.stringify({ id: 'known-token', at: Date.now(), choice }),
      );
      localStorage.setItem(
        'laruhp.studio.draft:new',
        JSON.stringify({
          account: owner,
          siteId: null,
          intake: {
            industry: 'restaurant',
            name: '残したい下書き',
            description: '自分の文章',
            area: '',
            audience: '',
            goal: 'visit',
          },
          site: {
            name: '残したい下書き',
            pages: row.blocks_json.pages,
            settings: row.settings_json,
          },
          step: 'edit',
          at: Date.now(),
        }),
      );
    },
    { choice, row, owner },
  );
  await p.goto(base + '/laruHP/studio?creation=known-token', {
    waitUntil: 'networkidle',
  });
  await p.locator('.se-editor').waitFor();
  check(
    'existing draft preserved over incoming example',
    (await p.locator('header input').inputValue()) === '残したい下書き',
  );
  check(
    'handoff conflict explained',
    await p
      .getByText('前回の下書きを優先しました。', { exact: false })
      .isVisible(),
  );
  await p.evaluate(
    (choice) =>
      sessionStorage.setItem(
        'laruhp.creation-choice',
        JSON.stringify({ id: 'existing-token', at: Date.now(), choice }),
      ),
    choice,
  );
  await p.goto(
    base + '/laruHP/studio?siteId=' + id + '&creation=existing-token',
    { waitUntil: 'networkidle' },
  );
  await p.locator('.se-editor').waitFor();
  check(
    'existing site never adopts incoming example',
    (await p.locator('header input').inputValue()) === row.name,
  );
  check(
    'existing site data untouched by incoming handoff',
    JSON.stringify((await load()).blocks_json) ===
      JSON.stringify(row.blocks_json),
  );
  check('no JavaScript errors', errs.length === 0, errs);
} finally {
  await b.close();
  await fonts.close();
  fs.writeFileSync(
    out + '/media-results.json',
    JSON.stringify(results, null, 2),
  );
}
console.log('Passed ' + results.length);
