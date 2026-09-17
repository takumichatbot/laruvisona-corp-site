import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isCompedProfile, COMP_MARKER, PROFILE_BILLING_COLUMNS } from '../lib/subscription-reconcile';
import { bareSource } from './helpers/bare-source';

/**
 * 「無償」の目印が、効かなくなっていた。
 *
 * 一斉停止の判定は admin_notes の `[無償]` を見る。ところが profiles を
 * 読む select が2箇所にあり、**止める側の select にだけ admin_notes が
 * 入っていなかった。**
 *
 * 値が undefined になるので目印は常に効かず、
 * **無償提供先・検証用アカウントが canceled に落ち、サイトが止まる。**
 * この目印を用意した目的（最初の本物の契約が入った瞬間の一斉停止を防ぐ）が、
 * そのまま起きる。
 *
 * 止まっても、ログには他の停止と同じ行が1つ増えるだけ。誰も気づかない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('読む列に、判定で使う項目が入っている', () => {
  // 判定が見る項目が select に無いと、その判定は**常に外れる**。
  assert.match(PROFILE_BILLING_COLUMNS, /\badmin_notes\b/, '目印を読めない');
  for (const col of ['id', 'stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'plan', 'contract_starts_at', 'contract_ends_at']) {
    assert.match(PROFILE_BILLING_COLUMNS, new RegExp(`\\b${col}\\b`), `${col} が抜けている`);
  }
});

test('profiles を読む所が、全部その一本を通る', () => {
  // 2箇所に書き写していたから食い違った。書き写しが戻っていないこと。
  const src = read('app/api/cron/subscription-sync/route.ts');
  const uses = (src.match(/\.select\(PROFILE_BILLING_COLUMNS\)/g) || []).length;
  assert.ok(uses >= 2, `共通の列を使っている所が${uses}箇所しかない`);
  assert.doesNotMatch(src, /\.select\('id, stripe_customer_id/, '列の書き写しが残っている');
});

test('目印のあるアカウントは、止めない側と判定される', () => {
  const comped = { id: 'a', admin_notes: `検証用 ${COMP_MARKER}`, subscription_status: 'active' };
  assert.equal(isCompedProfile(comped as never), true);
  // 目印が読めていない（undefined）と、必ず止める側に倒れる
  assert.equal(isCompedProfile({ id: 'a', subscription_status: 'active' } as never), false);
});
