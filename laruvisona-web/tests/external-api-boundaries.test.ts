import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('外部API呼び出しは有限時間で失敗を利用者へ返す', () => {
  for (const path of [
    '../lib/larubot-provision.ts',
    '../app/api/google/reviews/route.ts',
    '../app/api/sites/[id]/pagespeed/route.ts',
    '../app/api/instagram/route.ts',
  ]) {
    assert.match(read(path), /AbortSignal\.timeout\(/, path);
  }
  assert.match(read('../app/api/contact/route.ts'), /api\.line\.me[\s\S]+AbortSignal\.timeout\(8_000\)/);
});

test('Instagramの秘密入力を有限化し、保存エラーの内部詳細を返さない', () => {
  const route = read('../app/api/instagram/route.ts');
  assert.match(route, /readContactBody\(req, 8_000\)/);
  assert.match(route, /access_token\.length > 4096/);
  assert.match(route, /encodeURIComponent\(access_token\)/);
  assert.doesNotMatch(route, /req\.json\(\)|error: error\.message/);
});

test('PageSpeedは片方だけ失敗した結果を正常な採点として返さない', () => {
  const route = read('../app/api/sites/[id]/pagespeed/route.ts');
  assert.match(route, /r\.ok \? r\.json\(\) : Promise\.reject/);
  assert.match(route, /PageSpeed API unavailable/);
});
