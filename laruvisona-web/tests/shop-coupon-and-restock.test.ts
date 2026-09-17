import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { snapshotStripeItems } from '../lib/shop-order';
import { bareSource } from './helpers/bare-source';

/**
 * ネットショップの、お金が消える経路と、在庫が戻らない経路。
 *
 * ── 1. クーポン＋2個以上で、課金されたのに注文が作られなかった ──
 *
 * 決済画面はクーポンの入力を受け付けている（allow_promotion_codes: true）。
 * 2個以上の商品に割引が入ると、その明細の合計は数量で割り切れない。
 *   例: 1,000円×3個に500円オフ → 2,500円。2,500 ÷ 3 は割り切れない。
 *
 * 以前はそこで例外を投げていた。投げると注文の確定ごと失敗し、
 *   ・お客様には決済完了の画面が出て、**カードには請求される**
 *   ・hp_orders に注文が**1件も作られない**
 *   ・お店への通知も飛ばず、在庫も減らない
 *   ・Stripeの再送は毎回同じ理由で失敗し続ける
 * お店には「無い注文」として何も現れない。お客様は商品が届くのを待つ。
 *
 * ── 2. 返金しても、在庫が戻らなかった ──
 *
 * 在庫を減らす所はあるのに、**戻す所がどこにも無かった。**
 * 在庫1の商品なら「売り切れ」表示が続き、売れる物が売れなくなる。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

const cart = (...qs: number[]) => qs.map((q, i) => ({ id: `p${i}`, q }));
const line = (quantity: number, amount_total: number, description = '商品') =>
  ({ description, quantity, amount_total });

test('割引で割り切れなくても、注文を作る', () => {
  // ここが本体。1,000円×3個に500円オフ。
  const items = snapshotStripeItems(cart(3) as never, [line(3, 2500)]);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);
  assert.equal(items[0].lineTotal, 2500, '実際に決済された額を残していない');
  assert.equal(items[0].unit, 833, '1個あたりが丸まっていない');
});

test('照合は、決済された明細の合計で行う', () => {
  // 1個あたり×数量 を足すと、割引のぶんだけ総額と合わなくなる。
  // 合わないと例外になり、**課金されたのに注文が作られない。**
  const items = snapshotStripeItems(cart(3, 2) as never, [line(3, 2500), line(2, 1800)]);
  const byLineTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  assert.equal(byLineTotal, 4300, '明細の合計が決済額と合わない');

  const byUnit = items.reduce((s, i) => s + i.unit * i.quantity, 0);
  assert.notEqual(byUnit, 4300, 'この足し方だと合ってしまう（前提が崩れている）');

  const webhook = read('lib/shop-webhook.ts');
  assert.match(webhook, /sum \+ item\.lineTotal/, '古い足し方に戻っている');
  assert.doesNotMatch(webhook, /sum \+ item\.unit \* item\.quantity/, '古い足し方が残っている');
});

test('割り切れることを、もう求めない', () => {
  const src = read('lib/shop-order.ts');
  assert.doesNotMatch(src, /total % quantity !== 0/, '割り切れることを求めている');
});

test('数量・金額・商品名の検査は、これまでどおり残す', () => {
  // 直しついでに、守るべき所まで緩めていないこと。
  assert.throws(() => snapshotStripeItems(cart(3) as never, [line(2, 2000)]), /決済数量/);
  assert.throws(() => snapshotStripeItems(cart(1) as never, [line(1, -1)]), /決済金額/);
  assert.throws(() => snapshotStripeItems(cart(1) as never, [line(1, 100, '  ')]), /決済商品/);
  assert.throws(() => snapshotStripeItems(cart(1, 1) as never, [line(1, 100)]), /一致しません/);
});

test('何をいくつ買ったかを、注文に残す', () => {
  // items には名前と数量しか無く、**商品のIDが入っていない。**
  // だから「どの商品の在庫を戻すか」が特定できなかった。
  const webhook = read('lib/shop-webhook.ts');
  assert.match(webhook, /update\(\{ cart \}\)/, 'cart を残していない');
});

test('cart を残す更新は、注文の確定とは分ける', () => {
  /*
    この列はSQLを実行するまで存在しない。PostgREST は存在しない列を含む
    更新を**丸ごと**失敗させるので、必須の更新に混ぜると
    **SQLを実行するまで注文そのものが確定しなくなる。**
    課金されたのに注文が無い、という直したばかりの状態に戻る。

    これは既存の見張り（tests/schema-drift.test.ts）が見つけてくれた。
    「DBに無い列を読んでいる」と名指しされて、初めて気づいた。
  */
  const webhook = read('lib/shop-webhook.ts');
  // 必須の更新に cart を混ぜていないこと
  const at = webhook.indexOf('const linked = await db.from');
  assert.ok(at > 0);
  assert.doesNotMatch(webhook.slice(at, at + 260), /cart/, '必須の更新に混ざっている');
  // 失敗しても注文は通す。ただし黙らない
  assert.match(webhook, /if \(cartSaved\.error\) \{\s*console\.error/);
  assert.doesNotMatch(webhook, /cartSaved\.error[\s\S]{0,80}throw/, '注文を落としている');
});

test('返金・キャンセルのあと、在庫を戻しに行く', () => {
  const src = read('lib/shop-refunds.ts');
  assert.match(src, /laruhp_shop_restock_order/, '戻す処理を呼んでいない');
  // 返金の3つの終わり方すべてから呼ぶこと
  assert.ok((src.match(/await restock\(db,/g) || []).length >= 3,
    '呼んでいない終わり方がある');
  // 済んだ状態のときだけ戻す
  assert.match(src, /if\(status!=='refunded'&&status!=='canceled'\)return;/);
});

test('戻せなかったら、記録に残す（返金は取り消さない）', () => {
  // 返金は済んでいるので、ここで投げると「返金したのに失敗と出る」混乱になる。
  // ただし黙らない。SQLをまだ実行していない状態も、ここで分かる。
  const src = read('lib/shop-refunds.ts');
  assert.match(src, /console\.error\('\[shop\] stock not restored:'/);
  assert.ok((src.match(/stock not restored/g) || []).length >= 2,
    '失敗の記録が足りない（呼べなかった場合と、戻せなかった場合）');
});

test('在庫を戻せなくても、返金を失敗にしない', () => {
  /*
    返金はもう済んでいる。ここで投げると、返金したのに画面には
    「返金に失敗しました」と出て、店主は同じ操作をもう一度試す。
    在庫が戻らないより、そちらのほうが混乱が大きい。

    これは既存のテスト（tests/shop-refunds.test.ts）が見つけてくれた。
    あちらの偽のDBには rpc が無く、最初の実装はそこで落ちていた。
  */
  const src = read('lib/shop-refunds.ts');
  const at = src.indexOf('async function restock(');
  const fn = src.slice(at, src.indexOf('export async function refundShopOrder'));
  assert.match(fn, /try\{/, '投げうる呼び出しを囲っていない');
  assert.match(fn, /\}catch\(e\)\{[\s\S]{0,160}console\.error/, '投げたときに黙っている');
});

test('在庫を戻すSQLが、二重に戻さない作りになっている', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_orders_restock.sql', import.meta.url), 'utf8');
  assert.match(sql, /if coalesce\(v_order\.restocked, false\) then/, '2回押すと2回戻る');
  assert.match(sql, /for update/, '同時の購入とぶつかる');
  // 在庫を管理していない商品を、管理しているようにしない
  assert.match(sql, /在庫を管理していない/);
  assert.match(sql, /status not in \('refunded', 'canceled'\)/, 'まだ売れている注文の在庫を戻している');
  // cart が無い古い注文を、黙って「戻した」にしない
  assert.match(sql, /'cart_missing'/);
});
