// Capture the shared export, without registering a site or enabling form submissions.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const root = '/tmp/laruhp-directions/references',
  base = 'http://127.0.0.1:3319';
const b = await chromium.launch();
try {
  for (const width of [390, 1440]) {
    const ctx = await b.newContext({
        viewport: { width, height: width === 1440 ? 1000 : 844 },
        locale: 'ja-JP',
      }),
      fonts = await installLocalFonts(ctx);
    await ctx.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
      r.abort(),
    );
    await ctx.route('**/__reference/*', (r) => {
      const id = new URL(r.request().url()).pathname.split('/').at(-1);
      if (
        !['beauty', 'restaurant', 'construction', 'retail', 'clinic'].includes(
          id,
        )
      )
        return r.abort();
      const html = fs
        .readFileSync(root + '/' + id + '.html', 'utf8')
        .replace(
          '<head>',
          `<head><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; frame-src 'none';">`,
        );
      return r.fulfill({ contentType: 'text/html', body: html });
    });
    const p = await ctx.newPage();
    for (const id of [
      'beauty',
      'restaurant',
      'construction',
      'retail',
      'clinic',
    ]) {
      await p.goto(base + '/__reference/' + id, { waitUntil: 'networkidle' });
      const reject = p.getByRole('button', { name: '拒否', exact: true });
      if (await reject.isVisible()) await reject.click();
      await p.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images]
            .filter((i) => i.loading !== 'lazy')
            .map((i) => i.decode().catch(() => {})),
        );
      });
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error('overflow ' + id + ' ' + width);
      await p.screenshot({ path: root + '/' + id + '-' + width + '.png' });
    }
    await ctx.close();
    await fonts.close();
  }
} finally {
  await b.close();
}
