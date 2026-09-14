import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const monitor = readFileSync(new URL('../scripts/check-laruhp-production.mjs', import.meta.url), 'utf8');

test('本番監視はService Workerの認証ページ非保存を検査する', () => {
  assert.match(monitor, /new URL\('\/sw\.js', apiOrigin\)/);
  assert.match(monitor, /const CACHE_NAME = 'laruhp-v6'/);
  assert.match(monitor, /function cacheableRequest/);
  assert.match(monitor, /if \\?\(!cacheableRequest/);
  assert.match(monitor, /_next\\?\/static/);
});

test('本番監視はrobotsとJSON-LDの実体を検査する', () => {
  assert.match(monitor, /new URL\('\/robots\.txt', origin\)/);
  assert.match(monitor, /JSON\.parse\(match\[1\]\)/);
  assert.match(monitor, /\['SoftwareApplication', 'WebSite'\]/);
  assert.match(monitor, /Sitemap: \$\{sitemapUrl\.href\}/);
});
