import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('管理APIは秘密値を固定時間で比較し、本文を実バイトで有限化する', () => {
  for (const file of [
    '../app/api/admin/republish-all/route.ts',
    '../app/api/admin/published-html-backup/route.ts',
    '../app/api/admin/generate-image-library/route.ts',
    '../app/api/admin/generate-video-library/route.ts',
  ]) {
    const source = read(file);
    assert.match(source, /verifySharedSecret/);
    assert.match(source, /readContactBody/);
    assert.doesNotMatch(source, /bearer === process\.env\.ADMIN_SECRET/);
    assert.doesNotMatch(source, /req\.json\(\)/);
  }
});

test('共通の管理者Bearerと定期処理Bearerも通常比較を使わない', () => {
  for (const file of ['../lib/adminAuth.ts', '../lib/scheduled-email.ts']) {
    const source = read(file);
    assert.match(source, /verifySharedSecret/);
    assert.doesNotMatch(source, /=== secret|=== `Bearer/);
  }
});

test('有料画像生成は一度に1業種だけを受け付ける', () => {
  const source = read('../app/api/admin/generate-image-library/route.ts');
  assert.match(source, /industry が必要です（1リクエストにつき1業種）/);
  assert.doesNotMatch(source, /\[\.\.\.IMAGE_INDUSTRIES\]/);
  assert.match(source, /heroCount > 10/);
  assert.match(source, /galleryCount > 20/);
});
