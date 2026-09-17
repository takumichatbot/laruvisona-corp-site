import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 支払い待ちの枠が、永久に埋まったままになっていた。
 *
 * 通る順:
 *   1. お客様が事前決済の予約に進む。hp_payment_prepare が attempted_at を立て、
 *      枠（hp_booking_allocations）を押さえる。押さえは60分。
 *   2. そのあとの Stripe セッション作成が一度失敗する
 *      （通信が切れた、タブを閉じた、など）。
 *   3. 以後の照合は、毎回「もう過ぎた hold_until」を期限にしてセッションを
 *      作ろうとする。Stripe は30分より近い期限を受け付けないので**毎回失敗する。**
 *   4. 失敗は投げられ、照合はそこで止まる。だから下にある
 *      「押さえが切れていたら手放す」所まで**たどり着かない。**
 *   5. 23時間経つと review に落ちて休眠する。
 *
 * 予約は pending_payment のまま、**枠の押さえだけが残り続ける。**
 * お客様は一円も払っていないのに、その時間が永久に埋まる。
 * 店側の画面には「支払い待ち／Stripeで要確認」と出るだけで、解放するボタンが
 * 無い。誰も解放できず、誰にも通知が飛ばない。
 *
 * しかもDB側にも逃げ道が無かった。押さえを外す状態（abandoned）の条件が
 *   p.attempted_at is not null → payment_mismatch
 * で、attempted_at は押さえを作った時点で必ず立つ。
 * **つまり、まさに解放したい状態のときだけ解放できない。**
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const sql = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('押さえの残りが足りないときは、作りに行かない', () => {
  const src = read('lib/scheduling/payments.ts');
  // Stripe は30分より近い期限を受け付けない
  assert.match(src, /if\(Date\.parse\(a\.hold_until\)-Date\.now\(\)<31\*60000\)return null;/,
    '残り時間を見ずに作りに行っている');
  // 期限には hold_until を渡し続けること（延ばすと、切れた枠に払えてしまう）
  assert.match(src, /expires_at:Math\.floor\(Date\.parse\(a\.hold_until\)\/1000\)/);
});

test('作りに行かなかったら、押さえを手放す所へ進む', () => {
  // null を返すと「セッションは無い」として扱われ、
  // 押さえが切れていれば abandoned へ進む（＝枠が空く）。
  const src = read('lib/scheduling/payments.ts');
  assert.match(src, /if\(!s\)\{[\s\S]{0,200}hold_until\)<=Date\.now\(\}?\)?[\s\S]{0,60}'abandoned'/,
    '手放す道につながっていない');
});

test('DB側が、立ち往生した予約を解放できる', () => {
  const migration = sql('supabase/hp_scheduling_stuck_hold.sql');
  // 押さえが続いているうちは外さない
  assert.match(migration, /if a\.hold_until>now\(\) then raise exception 'payment_mismatch'; end if;/);
  // 支払われた可能性の判定は session_id で行う
  assert.match(migration, /if p\.session_id is not null then raise exception 'payment_mismatch'; end if;/);
  // attempted_at で弾く古い条件が残っていないこと
  assert.doesNotMatch(migration, /p\.attempted_at is not null or a\.hold_until>now\(\)/,
    '古い条件が残っている（立ち往生した予約だけ解放できない）');
});

test('解放したら、押さえを消して枠を空ける', () => {
  const migration = sql('supabase/hp_scheduling_stuck_hold.sql');
  const at = migration.indexOf("elsif p_state in ('expired','abandoned') then");
  assert.ok(at > 0, '解放の分岐が無い');
  assert.match(migration.slice(at, at + 300), /delete from hp_booking_allocations where appointment_id=p_id;/);
});

test('置き換えたSQLが、元の処理を落としていない', () => {
  /*
    最初にこの関数を書き直したとき、返金の action_name、last_checked_at の更新、
    hp_booking_events への記録、返り値から鍵を落とす処理など**6箇所を
    落としていた。** 決済まわりの関数なので、そのまま実行すれば壊れていた。

    いまは元のテキストをそのまま写し、1箇所だけ差し替えている。
    落ちていないことを、ここで見る。
  */
  const migration = sql('supabase/hp_scheduling_stuck_hold.sql');
  for (const kept of [
    "action_name:='refund';",
    'update hp_booking_payments set last_checked_at=now() where appointment_id=p_id;',
    'insert into hp_booking_events(site_id,appointment_id,revision,action,snapshot)',
    "to_jsonb(a)-'token_hash'-'request_hash'-'client_key'",
    "else raise exception 'invalid_action';",
    "update hp_appointments set payment_status='review',updated_at=now()",
  ]) {
    assert.ok(migration.includes(kept), `元の処理が落ちている: ${kept}`);
  }
  // 支払い済みの判定も、そのまま残っていること
  assert.match(migration, /if p_amount is distinct from a\.price or p_intent is null then raise exception 'payment_mismatch'; end if;/);
});
