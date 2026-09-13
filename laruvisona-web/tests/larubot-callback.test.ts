import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/larubot/webhook/route.ts', import.meta.url), 'utf8');

test('LARUbot callbackは共有鍵確認後にサーバー権限で保存する', () => {
  assert.match(route, /createServiceClient/);
  assert.doesNotMatch(route, /import \{ createClient \}/);
  assert.ok(route.indexOf("secret !== process.env.LARU_HP_API_SECRET") < route.indexOf('createServiceClient()'));
});

test('callbackは利用者・サイト・公開IDの形と所属を検査する', () => {
  assert.match(route, /UUID\.test\(user_id\)/);
  assert.match(route, /UUID\.test\(site_id\)/);
  assert.match(route, /PUBLIC_ID\.test\(larubot_public_id\)/);
  assert.match(route, /\.eq\('id', site_id\)[\s\S]*?\.eq\('user_id', user_id\)/);
});

test('callbackは不存在・DB失敗・更新0件を成功にしない', () => {
  assert.match(route, /site lookup failed/);
  assert.match(route, /site not found/);
  assert.match(route, /saved\.error \|\| saved\.data\?\.length !== 1/);
  assert.match(route, /site update failed/);
});
