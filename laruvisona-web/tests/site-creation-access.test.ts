import test from 'node:test';
import assert from 'node:assert/strict';
import { siteCreationAccess } from '../lib/site-creation-access.ts';

test('公開APIと同じ管理者は契約記録なしでも検証サイトを作れる', () => {
  assert.deepEqual(siteCreationAccess('Owner@example.com', null, 'inactive',
    ['support@example.com', ' owner@example.com, other@example.com ']),
  { allowed: true, limit: 999 });
});
test('設定なし・空のメールを管理者として許可しない', () => {
  for (const email of [undefined, '', 'owner@example.com'])
    assert.equal(siteCreationAccess(email, null, 'inactive', [undefined, ' ']).allowed, false);
});
test('ドメイン一致や部分一致では管理者にならない', () => {
  for (const email of ['other@example.com', 'owner@example.com.evil', 'xowner@example.com'])
    assert.equal(siteCreationAccess(email, null, 'inactive', ['owner@example.com']).allowed, false);
});
test('通常の契約・トライアル・サイト上限はそのまま', () => {
  for (const status of ['active', 'trialing'])
    assert.deepEqual(siteCreationAccess('customer@example.com', 'hp', status, ['owner@example.com']),
      { allowed: true, limit: 1 });
});
test('一般利用者の未契約・支払停止・解約を通さない', () => {
  for (const status of ['inactive', 'past_due', 'canceled', 'unpaid'])
    assert.equal(siteCreationAccess('customer@example.com', 'hp', status, ['owner@example.com']).allowed, false);
  assert.equal(siteCreationAccess('customer@example.com', null, 'active', ['owner@example.com']).allowed, false);
});
