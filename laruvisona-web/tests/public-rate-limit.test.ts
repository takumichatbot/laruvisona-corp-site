import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimPublicRate } from '../lib/public-rate-limit.ts';

test('公開フォームの制限キーは生の識別子をDBへ送らない', async () => {
  process.env.PUBLIC_RATE_LIMIT_SECRET = 'test-only-secret';
  let args: Record<string, unknown> = {};
  const db = { rpc: async (_name: string, value: Record<string, unknown>) => { args = value; return { data: true, error: null }; } };
  assert.equal(await claimPublicRate(db as never, 'site-contact', 'site:203.0.113.1', 5), 'allowed');
  assert.match(String(args.p_key_hash), /^[0-9a-f]{64}$/);
  assert.equal(args.p_window_seconds, 3600);
  assert.doesNotMatch(JSON.stringify(args), /203\.0\.113\.1/);
});

test('公開フォームは共有DBが読めないとき無制限に通さない', async () => {
  process.env.PUBLIC_RATE_LIMIT_SECRET = 'test-only-secret';
  const db = { rpc: async () => ({ data: null, error: { message: 'down' } }) };
  assert.equal(await claimPublicRate(db as never, 'company-inquiry', 'ip', 5), 'unavailable');
  const contact = readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');
  const inquiry = readFileSync(new URL('../app/api/inquiry/route.ts', import.meta.url), 'utf8');
  for (const source of [contact, inquiry]) {
    assert.match(source, /claimPublicRate/);
    assert.match(source, /rate === 'unavailable'/);
  }
});

test('公開フォーム制限SQLはサービス以外から閉じ、原子的に上限を守る', () => {
  const sql = readFileSync(new URL('../supabase/hp_public_rate_limits.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on public\.hp_public_rate_limits from public,anon,authenticated/i);
  assert.match(sql, /security definer set search_path=public/i);
  assert.match(sql, /where hp_public_rate_limits\.used<p_limit/i);
  assert.match(sql, /grant execute on function public\.laruhp_public_claim_rate\(text,text,integer,integer\) to service_role/i);
  assert.match(sql, /extract\(epoch from now\(\)\)\/p_window_seconds/i);
});

test('ニュースレターと会員認証もプロセス内だけの制限に依存しない', () => {
  const files = [
    '../app/api/newsletter/subscribe/route.ts', '../app/api/hp/members/signup/route.ts',
    '../app/api/hp/members/login/route.ts', '../app/api/hp/members/request-reset/route.ts',
    '../app/api/hp/members/reset/route.ts',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /claimPublicRate/);
    assert.doesNotMatch(source, /rateLimit\(/);
  }
});

test('分析・認証・決済・通知の外部作用も共有利用枠を通る', () => {
  const files = [
    '../app/api/pageview/route.ts', '../app/api/heatmap/route.ts',
    '../app/api/auth/request-password-reset/route.ts', '../app/api/admin/verify/route.ts',
    '../app/api/bridge/token/route.ts', '../app/api/hp/members/subscribe/route.ts',
    '../app/api/hp/members/portal/route.ts', '../app/api/stripe/checkout/route.ts',
    '../app/api/stripe/buy/route.ts', '../app/api/shop/checkout/route.ts',
    '../app/api/orders/refund/route.ts', '../app/api/sites/[id]/members/route.ts',
    '../app/api/sites/[id]/schedule/payments/route.ts', '../app/api/sites/[id]/shop/payments/route.ts',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /claimPublicRate/);
    assert.doesNotMatch(source, /rateLimit\(/);
  }
});
