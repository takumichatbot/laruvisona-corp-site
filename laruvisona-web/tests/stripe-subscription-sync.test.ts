import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');

test('契約開始はプロフィールを実際に1件更新してから案内と機能発行へ進む', () => {
  const beforeMail = route.slice(route.indexOf('const profileSaved'), route.indexOf('// サブスク開始メール'));
  assert.match(beforeMail, /\.select\('id'\)/);
  assert.match(beforeMail, /profileSaved\.data\?\.length !== 1/);
});

test('支払い成功・失敗・プラン変更・解約はDB失敗と更新0件を成功にしない', () => {
  for (const name of ['renewed','failedUpdate','subscriptionUpdated','canceled']) {
    assert.match(route, new RegExp(`${name}\\.error \\|\\| ${name}\\.data\\?\\.length !== 1`));
  }
});

test('解約通知は対象プロフィールの読み取りと状態保存後にだけ送る', () => {
  assert.match(route, /canceledLookup\.error/);
  assert.ok(route.indexOf('const canceled =') < route.indexOf('// 解約メール'));
});
