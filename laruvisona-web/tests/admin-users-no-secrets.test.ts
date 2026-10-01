import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safeProfile } from '../lib/admin-safe-profile.ts';

test('管理画面の利用者一覧: token などの値を返さず、持っているかだけ返す', () => {
  const got = safeProfile({
    id: 'u1', plan: 'hp', google_refresh_token: 'x', instagram_access_token: '', stripe_customer_id: 'cus_1',
  });
  assert.equal(got.google_refresh_token, undefined);
  assert.equal(got.instagram_access_token, undefined);
  assert.equal(got.has_google_refresh_token, true);
  assert.equal(got.has_instagram_access_token, false);
  assert.equal(got.plan, 'hp');
  assert.equal(got.stripe_customer_id, 'cus_1');
  assert.deepEqual(safeProfile(undefined), {});
});

test('管理画面の利用者一覧: profiles をそのまま広げて返さない', () => {
  const src = readFileSync('app/api/admin/users/route.ts', 'utf8');
  assert.ok(src.includes('...safeProfile(profileMap.get(u.id))'));
  assert.ok(!/\.\.\.profileMap\.get\(/.test(src));
});
