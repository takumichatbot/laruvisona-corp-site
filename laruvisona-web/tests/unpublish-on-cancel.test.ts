import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { unpublishSitesOfUser } from '../lib/unpublish-on-cancel';

/**
 * 契約が終わっても、公開サイトが止まっていなかった（2026-09-27 本番で確認）。
 * FAQ と解約完了メールは「契約期間終了後、公開中のサイトは非公開」と案内している。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function fakeDb(result: { data: { id: string }[] | null; error: unknown }) {
  const calls: unknown[] = [];
  const db = {
    from(t: string) { calls.push(['from', t]); return this; },
    update(v: unknown) { calls.push(['update', v]); return this; },
    eq(c: string, v: unknown) { calls.push(['eq', c, v]); return this; },
    select(c: string) { calls.push(['select', c]); return Promise.resolve(result); },
  };
  return { db, calls };
}

test('その人の公開中のサイトだけを、利用者の「非公開」と同じ形で止める', async () => {
  const { db, calls } = fakeDb({ data: [{ id: 's1' }, { id: 's2' }], error: null });
  const r = await unpublishSitesOfUser(db, 'u1');
  assert.deepEqual(r, { ok: true, count: 2 });
  assert.deepEqual(calls, [
    ['from', 'sites'],
    ['update', { published: false, published_html: null }],
    ['eq', 'user_id', 'u1'],
    ['eq', 'published', true],
    ['select', 'id'],
  ]);
});

test('失敗は失敗として返す（呼び出し側が再試行できるように）', async () => {
  const { db } = fakeDb({ data: null, error: { message: 'x' } });
  assert.deepEqual(await unpublishSitesOfUser(db, 'u1'), { ok: false, count: 0 });
});

test('Stripe の解約通知で、契約状態を書き換える前にサイトを止める', () => {
  const s = read('app/api/stripe/webhook/route.ts');
  const block = s.slice(s.indexOf("case 'customer.subscription.deleted'"), s.indexOf('// 解約メール'));
  const unpub = block.indexOf('unpublishSitesOfUser(supabase, canceledProfile.id)');
  const cancel = block.indexOf(".update({ subscription_status: 'canceled'");
  assert.ok(unpub > 0, '解約時にサイトを止めていない');
  assert.ok(unpub < cancel, '状態を書き換えたあとに止めている（失敗時の再送で通らなくなる）');
  assert.match(block, /canceledProfile\.stripe_subscription_id === sub\.id/, '乗り換え済みの人のサイトまで止める');
  assert.match(block, /Sites could not be unpublished' \}, \{ status: 500 \}/);
});

test('定期同期で契約が終わったと分かったときも、同じように止める', () => {
  const s = read('app/api/cron/subscription-sync/route.ts');
  const n = (s.match(/unpublishSitesOfUser\(db, profile\.id\)/g) || []).length;
  assert.equal(n, 2, '同期の2つの停止経路の両方で止めていない');
  const stopIdx = s.indexOf(".update({ subscription_status: 'canceled', stripe_subscription_id: null })");
  assert.ok(s.lastIndexOf('unpublishSitesOfUser(db, profile.id)', stopIdx) > s.indexOf('isOrphanedActiveProfile'), '孤立した契約の停止でサイトを止めていない');
});

test('案内（FAQ・解約メール）が、この動きと一致している', () => {
  assert.match(read('lib/laruhp-faq.ts'), /公開は止まりますが、作った内容は、契約が切れたあとでもHTMLとして書き出せます/);
  assert.match(read('app/api/stripe/webhook/route.ts'), /ご契約期間終了後、公開中のサイトは非公開となります/);
  // 書き出しは中身（blocks_json）から作る。published_html を消しても書き出せる。
  assert.match(read('app/api/sites/[id]/export-html/route.ts'), /select\('id, name, blocks_json/);
});
