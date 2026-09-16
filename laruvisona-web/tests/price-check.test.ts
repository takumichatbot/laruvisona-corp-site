import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/admin/price-check/route.ts', import.meta.url), 'utf8');

test('料金の照合は、画面の数字をlib/laruhp-facts.tsから取る', () => {
  // 照合の相手を別に書き写すと、写し間違いを照合できなくなる
  assert.match(route, /from '@\/lib\/laruhp-facts'/);
  assert.doesNotMatch(route, /monthly: 999/);
});

test('検査する組み合わせに抜けがない', () => {
  const plans = ['hp', 'lite', 'hp-bot', 'hp-bot-seo', 'agency'];
  for (const plan of plans) assert.match(route, new RegExp(`plan: '${plan}'`), plan);
  // 決済ルートが見ている環境変数と同じ名前を見ている
  const checkout = readFileSync(new URL('../app/api/stripe/checkout/route.ts', import.meta.url), 'utf8');
  for (const name of (checkout.match(/STRIPE_[A-Z_]*PRICE_ID/g) || [])) {
    assert.match(route, new RegExp(name), name);
  }
});

test('読むだけで、StripeにもDBにも書かない', () => {
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /\.create\(|\.update\(|\.del\(/);
});

test('通貨と請求間隔も見る（金額だけ合っていても違う契約になる）', () => {
  assert.match(route, /price\.currency === 'jpy'/);
  assert.match(route, /interval === wantInterval/);
});
