import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canMoveOrder, nextOrderStatuses, parseOrderUpdate } from '../lib/order-contract.ts';

test('手動の注文状態は発送・完了の一方向だけに進める', () => {
  assert.equal(canMoveOrder('paid', 'shipped'), true);
  assert.equal(canMoveOrder('paid', 'completed'), true);
  assert.equal(canMoveOrder('shipped', 'completed'), true);
  assert.equal(canMoveOrder('review', 'shipped'), true);
  assert.equal(canMoveOrder('completed', 'paid'), false);
  assert.equal(canMoveOrder('paid', 'canceled'), false);
  assert.deepEqual(nextOrderStatuses('canceled'), []);
  assert.deepEqual(nextOrderStatuses('refund_pending'), []);
  assert.deepEqual(nextOrderStatuses('refunded'), []);
});

test('注文更新はUUIDと許可した変更先だけを受け付ける', () => {
  const id = 'a3f1c0de-1111-4111-8111-111111111111';
  assert.deepEqual(parseOrderUpdate({ id, status: 'shipped' }), { id, status: 'shipped' });
  assert.throws(() => parseOrderUpdate({ id: 'order-1', status: 'shipped' }));
  assert.throws(() => parseOrderUpdate({ id, status: 'canceled' }));
  assert.throws(() => parseOrderUpdate({ id, status: 'refunded' }));
});

test('注文APIは所有サイトへ閉じ、競合とDB失敗を成功扱いにしない', () => {
  const api = readFileSync(new URL('../app/api/orders/route.ts', import.meta.url), 'utf8');
  assert.match(api, /\.in\('site_id', owned\.ids\)/);
  assert.match(api, /\.eq\('site_id', order\.site_id\)/);
  assert.match(api, /\.eq\('status', order\.status\)/);
  assert.match(api, /changed\.length !== 1/);
  assert.match(api, /if \(updateError\) return databaseError\(\)/);
});

test('注文画面はAPI成功後だけ表示を変え、絵文字と直接DB更新を使わない', () => {
  const page = readFileSync(new URL('../app/laruHP/orders/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /fetch\('\/api\/orders'/);
  assert.match(page, /if \(!response\.ok \|\| !body\.order\) throw/);
  assert.doesNotMatch(page, /from\('hp_orders'\)/);
  assert.doesNotMatch(page, /📦|🛍️/u);
});

test('注文表は所有者の更新だけを許可し、外部からの追加と削除を閉じる', () => {
  const sql = readFileSync(new URL('../supabase/hp_orders.sql', import.meta.url), 'utf8');
  assert.match(sql, /for update using[\s\S]*with check/i);
  assert.match(sql, /revoke all on public\.hp_orders from anon, authenticated/i);
  assert.match(sql, /grant select on public\.hp_orders to authenticated/i);
  assert.match(sql, /grant update \(status, note\) on public\.hp_orders to authenticated/i);
  assert.match(sql, /create trigger lhp_order_status_guard_trg/i);
  assert.match(sql, /refund_requires_service_role/);
});
