// 公開用HTMLから作例の画面写真を書き出す。架空店のデータ。実績や口コミは作らない。
// node --import ./tests/_resolve-ts.mjs scripts/capture-lp-showcase.mjs
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { LP_SHOWCASE } from '../lib/lp-showcase.ts';
import { makeStarterSite } from '../lib/studio-start.ts';
import { exportToHTML } from '../lib/html-export.ts';
import { installLocalFonts } from '../tests/browser/_local-fonts.mjs';
const require = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
);
const { chromium } = require('playwright');
const sharp = (await import('sharp')).default;
const publicRoot = path.resolve('public');
const htmls = new Map(
  LP_SHOWCASE.map((item) => {
    const s = makeStarterSite(
      {
        industry: item.id,
        name: item.name,
        description: item.description,
        area: '',
        audience: '',
        goal: 'contact',
      },
      item.preset,
    );
    const hero = s.pages[0].blocks.find((b) => b.type === 'hero');
    hero.data.heading = item.heading;
    hero.data.subheading = item.description;
    hero.data.bgImage = item.photo;
    s.settings.animLevel = 'none';
    return [item.id, exportToHTML(s.pages, s.pages[0].seo, s.settings, s.name)];
  }),
);
const server = http.createServer((req, res) => {
  const id = req.url.split('?')[0].slice(1);
  if (htmls.has(id)) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.end(htmls.get(id));
  }
  const f = path.resolve(
    publicRoot,
    '.' + new URL(req.url, 'http://local').pathname,
  );
  if (
    !f.startsWith(publicRoot + path.sep) ||
    !fs.existsSync(f) ||
    !fs.statSync(f).isFile()
  ) {
    res.writeHead(404);
    return res.end();
  }
  res.setHeader(
    'content-type',
    f.endsWith('.webp')
      ? 'image/webp'
      : f.endsWith('.jpg')
        ? 'image/jpeg'
        : 'application/octet-stream',
  );
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1100, height: 830 },
  deviceScaleFactor: 1,
});
const fonts = await installLocalFonts(ctx);
try {
  for (const item of LP_SHOWCASE) {
    const p = await ctx.newPage();
    await p.goto(`http://127.0.0.1:${server.address().port}/${item.id}`, {
      waitUntil: 'networkidle',
    });
    await p.evaluate(() => document.fonts.ready);
    const consent = p.locator('#lhp-cookie-reject');
    if (await consent.isVisible()) await consent.click();
    const bytes = await p.screenshot();
    await sharp(bytes)
      .webp({ quality: 86 })
      .toFile(publicRoot + item.image);
    console.log(item.id, fs.statSync(publicRoot + item.image).size);
    await p.close();
  }
} finally {
  await ctx.close();
  await fonts.close();
  await browser.close();
  await new Promise((r) => server.close(r));
}
