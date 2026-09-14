import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('契約からのLARUbot登録も待ち時間を有限化し応答本文を解放する', () => {
  const route = source('lib/larubot-provision.ts');
  assert.match(route, /AbortSignal\.timeout\(12_000\)/);
  assert.match(route, /await res\.body\?\.cancel\(\)/);
});

test('代理店ロゴは有限なHTTPS URLだけを保存する', () => {
  const route = source('app/api/account/brand/route.ts');
  assert.match(route, /readContactBody\(req, 10_000\)/);
  assert.match(route, /url\.protocol !== 'https:'/);
  assert.match(route, /url\.username \|\| url\.password/);
  assert.match(route, /data\?\.length !== 1/);
  assert.doesNotMatch(route, /error: error\.message/);
});
