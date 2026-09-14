import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('予約とショップはDB障害を不存在や決済準備中へ変換しない', () => {
  const link = read('app/api/hp/scheduling/link/route.ts');
  const scheduling = read('app/api/hp/scheduling/route.ts');
  const server = read('lib/scheduling/server.ts');
  const shop = read('app/api/shop/checkout/route.ts');

  assert.match(link, /\.maybeSingle\(\);[\s\S]*if \(error\)[\s\S]*status: 503/);
  assert.match(scheduling, /if \(se\) return fail\(se\);[\s\S]*if \(!site\?\.published\)/);
  assert.match(scheduling, /if\(site\.error\)return fail\(site\.error\);/);
  assert.match(scheduling, /if\(siteError\)return fail\(siteError\);/);
  assert.match(server, /if \(error\)[\s\S]*response: fail\(error\)[\s\S]*if \(!site\)/);
  assert.match(shop, /if \(siteError\)[\s\S]*status: 503/);
});
