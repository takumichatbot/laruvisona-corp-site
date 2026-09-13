import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLocalFonts } from './_local-fonts.mjs';
const { chromium } = createRequire(
  process.env.PLAYWRIGHT_FROM
    ? process.env.PLAYWRIGHT_FROM + '/'
    : import.meta.url,
)('playwright');
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
});
const rows = [];
const base = process.env.BASE_URL || 'http://127.0.0.1:3319';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw Error('Local only');
try {
  for (const width of [390, 1440])
    for (let run = 0; run < 3; run++) {
      const c = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 1000 },
        locale: 'ja-JP',
      });
      const fonts = await installLocalFonts(c);
      await c.route(/larubot\.tokyo|googletagmanager|clarity\.ms/, (r) =>
        r.abort(),
      );
      const p = await c.newPage();
      const cd = await c.newCDPSession(p);
      await cd.send('Network.enable');
      await cd.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cd.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: 75000,
      });
      await cd.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      let bytes = 0;
      cd.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
      await p.addInitScript(() => {
        window.__measure = { lcp: 0, cls: 0, video: 0, scene: 0 };
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__measure.lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries())
            if (!e.hadRecentInput) window.__measure.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        document.addEventListener(
          'playing',
          (e) => {
            if (e.target.tagName === 'VIDEO' && !window.__measure.video)
              window.__measure.video = performance.now();
          },
          true,
        );
        new MutationObserver(() => {
          if (
            document.querySelector('.lp-sculpture[data-ready=true]') &&
            !window.__measure.scene
          )
            requestAnimationFrame(() =>
              requestAnimationFrame(
                () => (window.__measure.scene ||= performance.now()),
              ),
            );
        }).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-ready'],
        });
      });
      await p.goto(base + '/laruHP', { waitUntil: 'domcontentloaded' });
      await p
        .waitForFunction(
          () => window.__measure.video && window.__measure.scene,
          { timeout: 40000 },
        )
        .catch(() => {});
      await p.waitForTimeout(2000);
      const row = {
        width,
        run,
        bytes,
        ...(await p.evaluate(() => ({
          ...window.__measure,
          fcp: performance.getEntriesByName('first-contentful-paint')[0]
            ?.startTime,
          visibility: document.visibilityState,
        }))),
      };
      rows.push(row);
      console.log(row);
      await c.close();
      await fonts.close();
    }
} finally {
  await browser.close();
  fs.writeFileSync(
    process.env.OUTPUT_FILE || '/tmp/lp-cinema-performance.json',
    JSON.stringify(
      {
        conditions:
          'local production build, matching local fonts, external analytics/chat blocked, 1.6Mbps/150ms/4x CPU, cold Chromium SwiftShader, not real device or production speed',
        samples: rows,
      },
      null,
      2,
    ),
  );
}
