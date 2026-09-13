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
  assert.match(sql, /grant execute on function public\.laruhp_public_claim_rate\(text,text,integer\) to service_role/i);
});
