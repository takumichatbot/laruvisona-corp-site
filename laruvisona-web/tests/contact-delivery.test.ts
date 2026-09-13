import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');

test('フォーム通知はResendの戻り値にある失敗も検出する', () => {
  assert.match(route, /result => \(\{ ok: !result\.error, channel: 'owner_email'/);
  assert.match(route, /result => \(\{ ok: !result\.error, channel: 'customer_email'/);
  assert.doesNotMatch(route, /emails\.send\([\s\S]{0,400}\}\.catch\(err/);
});

test('受付後の各配信結果を問い合わせ行へ保存する', () => {
  assert.match(route, /owner_email_status/);
  assert.match(route, /customer_email_status/);
  assert.match(route, /line_status/);
  assert.match(route, /webhook_status/);
  assert.match(route, /notified: deliveryState\.owner_email === 'success'/);
});

test('Webhook結果を書いてもメールとLINEの結果を消さない', () => {
  const uses = route.match(/\.\.\.notificationFields/g) || [];
  assert.equal(uses.length, 2);
});
