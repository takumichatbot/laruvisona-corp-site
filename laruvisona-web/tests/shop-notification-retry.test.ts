import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const helper = readFileSync(new URL('../lib/shop-notification.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/cron/shop-notifications/route.ts', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/hp_orders.sql', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');

test('注文通知は戻り値の失敗を成功にせず注文IDの冪等キーを使う', () => {
  assert.match(helper, /if \(response\.error\) return false/);
  assert.match(helper, /idempotencyKey: `hp-order-\$\{order\.id\}-owner`/);
  assert.match(helper, /23 \* 3600000/);
});

test('注文通知の再送は排他claimを完了トークンで閉じる', () => {
  assert.match(route, /laruhp_shop_claim_notifications/);
  assert.match(route, /laruhp_shop_finish_notification/);
  assert.match(route, /finish\.data !== true/);
  assert.match(sql, /for update of o skip locked/);
  assert.match(sql, /notification_attempts<5/);
  assert.match(sql, /notification_claimed_until=now\(\)\+interval '10 minutes'/);
  assert.match(sql, /notification_claim_token=p_claim_token/);
});

test('注文通知の再送は本番サーバから有限間隔で呼ぶ', () => {
  assert.match(server, /api\/cron\/shop-notifications/);
  assert.match(server, /setInterval\(retryShopNotifications,5\*60000\)/);
});
