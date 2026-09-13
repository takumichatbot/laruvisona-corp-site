import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/larubot/conversations/route.ts', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../lib/shared-secret.ts', import.meta.url), 'utf8');

test('LARUbot共有鍵は長さ確認付きの一定時間比較を使う', () => {
  assert.match(shared, /timingSafeEqual/);
  assert.match(shared, /left\.length === right\.length/);
  assert.match(route, /verifySharedSecret/);
});

test('会話受信は実バイト・件数・各文字列を制限する', () => {
  assert.match(route, /readRequestText\(req, 512_000\)/);
  assert.match(route, /body\.messages\.length > 500/);
  assert.match(route, /item\.content\.length > 0 && item\.content\.length <= 8_000/);
  assert.match(route, /body\.summary\.length > 10_000/);
  assert.match(route, /SESSION_ID\.test\(body\.session_id\)/);
});

test('会話受信はサイト不存在とDB失敗を成功にせず内部エラーを返さない', () => {
  assert.match(route, /site lookup failed/);
  assert.match(route, /site not found/);
  assert.match(route, /conversation could not be saved/);
  assert.doesNotMatch(route, /error: error\.message/);
});
