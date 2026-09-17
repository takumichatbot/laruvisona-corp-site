import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 予約が入ったのに、店主が知らないまま当日を迎える道があった。
 *
 * 通る順:
 *   1. お客様が予約する → /api/hp/booking/reserve
 *   2. lib/booking-finalize.ts が、内側で /api/contact を叩く
 *   3. /api/contact は、店主あてメールが失敗しても **200** を返す
 *      （受付そのものは保存できているため。これは正しい）
 *   4. finalize は res.ok しか見ていないので true を返す
 *   5. reserve は notified: true を返す
 *   6. PublicBooking.tsx は data.notified === false のときだけ
 *      「通知に失敗しました」を出す → **一度も出ない**
 *
 * さらに /api/contact 側の notified は `=== 'success'` と比べていた。
 * deliveryState が取る値は accepted / failed / not_configured の3つで、
 * **'success' は絶対に作られない。** いつ見ても false の旗だった。
 *
 * 結果: 予約は入る。店主は知らない。お客様には「送信できました」と出る。
 * 当日、誰も来ない。どちらにも、何が起きたか分からない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const contact = read('app/api/contact/route.ts');
const finalize = read('lib/booking-finalize.ts');
const reserve = read('app/api/hp/booking/reserve/route.ts');
const publicBooking = read('components/scheduling/PublicBooking.tsx');

test('作られない値と比べていない', () => {
  // deliveryState に入る値は3つだけ。ここと比べる値は、その中から選ぶ。
  const produced = [...contact.matchAll(/r\.ok \? '(\w+)' : '(\w+)'/g)].flatMap(m => [m[1], m[2]]);
  assert.ok(produced.length > 0, 'deliveryState の作り方が見つからない');
  const compared = [...contact.matchAll(/ownerNotifyState === '(\w+)'/g)].map(m => m[1]);
  assert.ok(compared.length > 0, '比べている所が見つからない');
  for (const c of compared) {
    assert.ok(produced.includes(c), `'${c}' は作られない値（作られるのは ${produced.join(' / ')}）`);
  }
});

test('知らせた／知らせていないを、実際の状態から答える', () => {
  assert.match(contact, /notified: ownerNotifyState === 'accepted'/);
  // 呼ぶ側が誤解しないよう、生の状態も一緒に返す
  assert.match(contact, /ownerNotifyState,/);
});

test('予約側は、200だけで「知らせた」と言わない', () => {
  assert.match(finalize, /if \(body\.notified !== true\) \{/, '中身を見ずに true を返している');
  assert.match(finalize, /console\.error\('\[booking-finalize\] owner not notified:'/);
  // res.ok だけで true を返す道が残っていないこと
  assert.doesNotMatch(finalize, /if \(!res\.ok\) \{[\s\S]{0,120}\}\s*return true;/, 'res.ok だけで返している');
});

test('お客様に出す警告が、実際につながっている', () => {
  // 旗が常に true だと、この警告は一度も出ない。
  assert.match(reserve, /notified: true/.test(reserve) ? /notified/ : /notified\b/);
  assert.match(reserve, /return NextResponse\.json\(\{ ok: true, notified \}\)/, '固定値を返している');
  assert.match(publicBooking, /data\.notified === false/);
});

test('配信IDを残せなかったら、記録に残す', () => {
  // 残せないと、あとから来る webhook がこの受付に結び付けられず、
  // 状態は永久に「受け付けました」で止まる。
  assert.match(contact, /if \(saved\.error\) console\.error\('\[Contact\] delivery ids not recorded:'/);
});

test('スマホへの通知が全滅したら、記録に残す', () => {
  // メールとLINEは状態を残しているのに、プッシュだけ何も残していなかった。
  assert.match(contact, /if \(push && push\.sent === 0 && push\.failed > 0\)/);
});
