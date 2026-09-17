import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 予約枠の、2つの穴。
 *
 * ── 1. 誰でも、送信するだけでお店の枠を消せた ──
 *
 * 空き枠の一覧は、contacts の extra_fields.slot_id が付いた行を
 * 「その枠は埋まっている」として扱う。ところが問い合わせの受け口は
 * 公開フォーム用で、追加項目は**誰でも好きな鍵で送れた。**
 * 枠のIDは空き枠APIから読める。
 *
 * つまり誰でも、フォームに1回送るだけで枠を1つ消せる。
 * 期限も無く、解除する手立ても無い。店の画面には普通の問い合わせが
 * 1件増えるだけで、枠が消えたことは「予約が来なくなる」まで現れない。
 * 同業者でも、ただの暇な人でも、カレンダーを丸ごと空にできた。
 *
 * ── 2. 確認と確定が、別の所を見ていた ──
 *
 * 一覧は hp_reservations に加えて contacts も見るのに、確定側は
 * hp_reservations の重複禁止インデックスだけを頼りにしていた。
 * **contacts にしか記録が無い枠へ直接送ると、予約が通る。**
 * お客様には「予約できました」と出て、お店には同じ時間に2件が並ぶ。
 * 一覧からは消えている枠なので、店主には「なぜこの時間に2件？」しか見えない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('公開フォームからは、枠を押さえる鍵を送れない', () => {
  const src = read('app/api/contact/route.ts');
  assert.match(src, /const RESERVED_EXTRA_KEYS = \['slot_id', 'prepaid'\];/, '押さえる鍵を決めていない');
  assert.match(src, /if \(!internal\) \{[\s\S]{0,260}delete extraFields\[k\]/, '公開からの送信で落としていない');
});

test('こちらの中から呼ぶときは、これまでどおり通す', () => {
  // 予約の確定（lib/booking-finalize.ts）は内部から呼び、枠のIDを渡す。
  // ここまで塞ぐと、本物の予約が枠を押さえられなくなる。
  const src = read('app/api/contact/route.ts');
  const at = src.indexOf('const RESERVED_EXTRA_KEYS');
  const block = src.slice(at, at + 500);
  assert.match(block, /if \(!internal\)/, '内部からの呼び出しまで落としている');
  assert.doesNotMatch(block, /^\s*for \(const k of RESERVED_EXTRA_KEYS\) delete/m, '無条件に落としている');

  const finalize = read('lib/booking-finalize.ts');
  assert.match(finalize, /'x-internal-secret'/, '確定側が内部の印を付けていない');
  assert.match(finalize, /slot_id: opts\.slotId/, '確定側が枠のIDを渡していない');
});

test('落としたことを、記録に残す', () => {
  // 誰かが試しているなら、それは知りたい。
  const src = read('app/api/contact/route.ts');
  assert.match(src, /reserved extra fields dropped from public submission/);
});

test('確定側も、一覧と同じ所を見る', () => {
  const reserve = read('app/api/hp/booking/reserve/route.ts');
  const availability = read('app/api/hp/booking/availability/route.ts');
  // 一覧が見ている所
  assert.match(availability, /\.eq\('type', 'booking'\)/);
  assert.match(availability, /extra_fields/);
  // 確定側も同じ所を見ること
  assert.match(reserve, /\.eq\('extra_fields->>slot_id', slotId\)/, '古い形の予約を見ていない');
  assert.match(reserve, /status: 409/, '埋まっているのに通している');
});

test('空き状況を確認できないときは、通さない', () => {
  // 確認できないまま通すと二重予約になる。分からないときは断る。
  const reserve = read('app/api/hp/booking/reserve/route.ts');
  const at = reserve.indexOf('legacyError');
  assert.ok(at > 0);
  const around = reserve.slice(at, at + 400);
  assert.match(around, /status: 503/, '確認できないのに通している');
  assert.match(around, /console\.error\('\[booking\/reserve\] legacy hold check failed:'/, '黙っている');
});
