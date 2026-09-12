// 実際のスタジオを操作して撮影する。保存・公開APIは呼ばない。
import { createRequire } from 'node:module';
import { installLocalFonts } from '../tests/browser/_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const sharp = (await import('sharp')).default;
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('Local only');
const b = await chromium.launch(),
  c = await b.newContext({
    viewport: { width: 1200, height: 780 },
    locale: 'ja-JP',
  }),
  fonts = await installLocalFonts(c);
try {
  await c.route(/googletagmanager|clarity\.ms|larubot\.tokyo/, (r) =>
    r.abort(),
  );
  const p = await c.newPage();
  await p.goto(base + '/laruHP/studio?industry=retail', {
    waitUntil: 'networkidle',
  });
  await p.locator('.ls-start-grid[data-ready=true]').waitFor();
  await p.getByLabel('店名・屋号', { exact: false }).fill('日々の道具');
  await p.getByRole('button', { name: '雰囲気を選ぶ', exact: true }).click();
  await p.getByRole('button', { name: 'この見せ方で編集する' }).click();
  await p.locator('.se-editor').waitFor();
  await p.locator('.se-block-select').first().click();
  await p
    .locator('[data-field-key=heading] textarea')
    .fill('暮らしに、\n好きな道具を。');
  await p
    .locator('[data-field-key=subheading] input')
    .fill('日々の道具を、大切に選ぶお店です。');
  const frame = p.frameLocator('iframe[title="できあがりの見え方"]');
  await frame.locator('h1').waitFor();
  await frame.locator('body').evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
  await p.waitForTimeout(500);
  await sharp(await p.screenshot())
    .webp({ quality: 88 })
    .toFile('public/lp/studio-live.webp');
} finally {
  await c.close();
  await fonts.close();
  await b.close();
}
