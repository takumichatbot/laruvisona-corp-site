import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('LARUbotの手動登録は入力・所有権・回数・待ち時間を有限化する', () => {
  const route = source('app/api/larubot/setup/route.ts');
  assert.match(route, /readContactBody\(req, 10_000\)/);
  assert.match(route, /UUID\.test\(site_id\)/);
  assert.match(route, /\.eq\('id', site_id\)[\s\S]*\.eq\('user_id', user\.id\)/);
  assert.match(route, /claimPublicRate\(createServiceClient\(\), 'larubot-setup'/);
  assert.match(route, /AbortSignal\.timeout\(15_000\)/);
  assert.doesNotMatch(route, /await res\.text\(/);
});

test('契約からのLARUbot登録も待ち時間を有限化し応答本文を読み切る', () => {
  const route = source('lib/larubot-provision.ts');
  assert.match(route, /AbortSignal\.timeout\(12_000\)/);
  // 2026-09-17: 以前は body.cancel() で捨てていた。捨てずに読むようにしたので、
  // 流しっぱなしにならないのは同じ。public_id が本文に入っていて、
  // 捨てていたせいでコールバック待ちになっていた。
  assert.match(route, /await res\.json\(\)\.catch/);
  assert.doesNotMatch(route, /await res\.text\(/);
});

test('代理店ロゴは有限なHTTPS URLだけを保存する', () => {
  const route = source('app/api/account/brand/route.ts');
  assert.match(route, /readContactBody\(req, 10_000\)/);
  assert.match(route, /url\.protocol !== 'https:'/);
  assert.match(route, /url\.username \|\| url\.password/);
  assert.match(route, /data\?\.length !== 1/);
  assert.doesNotMatch(route, /error: error\.message/);
});

test('APIルートはJSON本文を無制限に読み込まない', () => {
  const api = fileURLToPath(new URL('../app/api/', import.meta.url));
  const routes = readdirSync(api, { recursive: true, encoding: 'utf8' })
    .filter(path => path.endsWith('route.ts'));
  for (const path of routes) {
    assert.doesNotMatch(readFileSync(`${api}/${path}`, 'utf8'), /await\s+req\.json\(\)/, path);
  }
});

test('通知解除は壊れた本文を全端末削除として扱わない', () => {
  const route = source('app/api/pwa/route.ts');
  assert.match(route, /readContactBody\(req, 4_000\)/);
  assert.match(route, /\.eq\('user_id', user\.id\)\.eq\('endpoint', endpoint\.toString\(\)\)/);
  assert.doesNotMatch(route, /endpoint省略時はこの利用者の全端末を解除/);
});

test('代理店管理ドメインも共通の正規化とRenderアダプターを使う', () => {
  const route = source('app/api/agency/admin-domain/route.ts');
  assert.match(route, /normalizeDomain\(body\.domain\)/);
  assert.match(route, /isReservedHost\(/);
  assert.match(route, /registerDomain\(cfg, trimmed\)/);
  assert.doesNotMatch(route, /fetch\(`https:\/\/api\.render\.com/);
});
