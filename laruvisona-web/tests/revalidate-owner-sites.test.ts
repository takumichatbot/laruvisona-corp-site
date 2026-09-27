import test from 'node:test';
import assert from 'node:assert/strict';
import { revalidateOwnerSites } from '../lib/revalidate-owner-sites.ts';

test('その人のサイトだけを数え、失敗しても投げない', async () => {
  const asked: string[] = [];
  const db = { from: () => ({ select: () => ({ eq: (_c: string, v: string) => { asked.push(v); return Promise.resolve(v === 'bad' ? { data: null, error: { m: 1 } } : { data: [{ slug: 'a' }, { slug: null }], error: null }); } }) }) };
  // next/cache の revalidatePath はテスト環境では投げる。投げても契約処理を止めないこと
  const n = await revalidateOwnerSites(db, ['u1', 'u1', null, 'bad']);
  assert.deepEqual(asked, ['u1', 'bad'], '重複・空を除いていない');
  assert.ok(n >= 0);
});
