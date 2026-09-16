import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  reconcileSubscription,
  profileStatusFor,
  isPlanSubscription,
  customerIdOf,
  isOrphanedActiveProfile,
} from '../lib/subscription-reconcile.ts';

const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  status: 'active',
  start_date: Math.floor(Date.parse('2026-01-15T00:00:00.000Z') / 1000),
  current_period_end: Math.floor(Date.parse('2026-02-15T00:00:00.000Z') / 1000),
  metadata: { plan: 'hp', supabase_user_id: 'u1' },
  customer: 'cus_1',
  ...over,
});

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  subscription_status: 'active',
  plan: 'hp',
  contract_starts_at: '2026-01-15T00:00:00.000Z',
  contract_ends_at: '2026-02-15T00:00:00.000Z',
  ...over,
});

test('同じならDBに触らない', () => {
  assert.equal(reconcileSubscription(profile(), sub()).action, 'in-sync');
});

test('時刻の表記が違うだけなら同じとみなす', () => {
  const out = reconcileSubscription(profile({ contract_starts_at: '2026-01-15T00:00:00+00:00' }), sub());
  assert.equal(out.action, 'in-sync');
});

test('webhookが落ちて未契約のままの人を、課金どおりに戻す', () => {
  // これが本命。Stripeでは課金されているのにDBが inactive のまま、という状態。
  const out = reconcileSubscription(
    profile({ stripe_subscription_id: null, subscription_status: 'inactive', plan: null, contract_starts_at: null, contract_ends_at: null }),
    sub(),
  );
  assert.equal(out.action, 'update');
  if (out.action !== 'update') return;
  assert.equal(out.updates.subscription_status, 'active');
  assert.equal(out.updates.stripe_subscription_id, 'sub_1');
  assert.equal(out.updates.plan, 'hp');
  assert.equal(out.updates.contract_starts_at, '2026-01-15T00:00:00.000Z');
});

test('contract_starts_at には start_date を使う（請求のたびに未来へ動かさない）', () => {
  const out = reconcileSubscription(
    profile({ contract_starts_at: '2026-01-15T00:00:00.000Z' }),
    sub({ current_period_end: Math.floor(Date.parse('2026-06-15T00:00:00.000Z') / 1000) }),
  );
  assert.equal(out.action, 'update');
  if (out.action !== 'update') return;
  assert.equal('contract_starts_at' in out.updates, false);
  assert.equal(out.updates.contract_ends_at, '2026-06-15T00:00:00.000Z');
});

test('Stripeで解約済みなら、DBも解約にして契約IDを外す', () => {
  const out = reconcileSubscription(profile(), sub({ status: 'canceled' }));
  assert.equal(out.action, 'update');
  if (out.action !== 'update') return;
  assert.equal(out.updates.subscription_status, 'canceled');
  assert.equal(out.updates.stripe_subscription_id, null);
});

test('DBが見ていない死んだ契約は触らない', () => {
  const out = reconcileSubscription(profile({ stripe_subscription_id: 'sub_new' }), sub({ id: 'sub_old', status: 'canceled' }));
  assert.equal(out.action, 'ignore');
});

test('生きた契約が2本あるときは、機械が決めずに人へ回す', () => {
  const out = reconcileSubscription(profile({ stripe_subscription_id: 'sub_other' }), sub());
  assert.equal(out.action, 'conflict');
});

test('metadataにプランが無くても、DBのプランを消さない', () => {
  const out = reconcileSubscription(profile({ subscription_status: 'inactive' }), sub({ metadata: {} }));
  assert.equal(out.action, 'update');
  if (out.action !== 'update') return;
  assert.equal('plan' in out.updates, false);
});

test('知らない状態を active にしない', () => {
  assert.equal(profileStatusFor('なにかの新状態'), 'inactive');
  assert.equal(profileStatusFor('unpaid'), 'past_due');
  assert.equal(profileStatusFor('trialing'), 'trialing');
});

test('サイト会員の課金はここでは扱わない', () => {
  assert.equal(isPlanSubscription(sub({ metadata: { kind: 'member' } })), false);
  assert.equal(isPlanSubscription(sub()), true);
  assert.equal(customerIdOf(sub({ customer: { id: 'cus_2' } })), 'cus_2');
  assert.equal(customerIdOf(sub({ customer: null })), null);
});

test('Stripeに契約が無いのに有効なままの人を見つける', () => {
  const live = new Set(['sub_1']);
  assert.equal(isOrphanedActiveProfile(profile(), live), false);
  assert.equal(isOrphanedActiveProfile(profile({ stripe_subscription_id: 'sub_gone' }), live), true);
  assert.equal(isOrphanedActiveProfile(profile({ stripe_subscription_id: null }), live), true);
  assert.equal(isOrphanedActiveProfile(profile({ subscription_status: 'canceled' }), live), false);
});

test('書き込む状態は、DBのcheck制約に収まる値だけ', () => {
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const allowed = schema.match(/subscription_status in \(([^)]*)\)/)![1]
    .split(',').map(v => v.trim().replace(/^'|'$/g, ''));
  const source = readFileSync(new URL('../lib/subscription-reconcile.ts', import.meta.url), 'utf8');
  const mapped = source.match(/const STATUS_MAP[^}]*}/)![0].match(/'([a-z_]+)',?\n/g) || [];
  for (const raw of mapped) {
    const value = raw.replace(/[',\n]/g, '');
    assert.ok(allowed.includes(value), `${value} は profiles.subscription_status に入れられない`);
  }
});

test('鍵を持ち出さずに確かめられる口がある', () => {
  const route = readFileSync(new URL('../app/api/cron/subscription-sync/route.ts', import.meta.url), 'utf8');
  // 管理者がブラウザで開くGETは、必ず空打ち（書かない）
  assert.match(route, /export async function GET[\s\S]*?return run\(true\)/);
  // 認可は、共有の鍵か、管理者本人のログインのどちらか
  assert.match(route, /requireBearer\(req, process\.env\.CRON_SECRET\) \|\| requireBearer\(req, process\.env\.ADMIN_SECRET\)/);
  assert.match(route, /=== admin/);
  // 認可を通らないものが run\(\) へ届かない
  const guards = route.match(/if \(!await allowed\(req\)\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/g) || [];
  assert.equal(guards.length, 2);
});

test('Stripeに契約が1件も無いときは、DB側を一斉に止めない', () => {
  // 「全員解約された」より「鍵の環境(test/live)が入れ替わっている」ほうが
  // ありそう。その状態で走らせると、払っている人を全員止めてしまう。
  const route = readFileSync(new URL('../app/api/cron/subscription-sync/route.ts', import.meta.url), 'utf8');
  assert.match(route, /if \(complete && planSubs\.length === 0 && !force\)/);
  assert.match(route, /stopWithoutStripeSubscriptions/);
  // 空打ちでも本実行でも、同じ判断を通ってから停止処理に入る
  assert.match(route, /\} else if \(complete\) \{/);
});
