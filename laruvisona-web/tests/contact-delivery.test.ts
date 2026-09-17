import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * 問い合わせの通知が「届いた」と言えるのは、どこまでか。
 *
 * 2026-09-17、本番で2回、公開したサイトの問い合わせフォームから送った。
 *   ・どちらも管理画面には即座に出た
 *   ・どちらもお客さまへの自動返信は届いた
 *   ・**どちらも店主あての通知メールが届かなかった**（受信箱・迷惑メール・
 *     すべての場所を探して0件）
 *   ・それでも記録は `owner_email_status: "success"`、応答は `notified: true`
 *
 * 送った側が持っているのは「配信会社が受け付けた」までで、
 * 届いたかどうかは、あとから知らせてもらう以外に知る方法が無い。
 * それを success と書いていたので、**届いていないことが誰にも見えなかった。**
 *
 * この製品は「問い合わせを受け取る」ために売っている。
 * 知らせが行かないのは、いちばん困る壊れ方。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('受け付けられただけの状態を、成功と書かない', () => {
  const route = read('app/api/contact/route.ts');
  assert.match(route, /r\.ok \? 'accepted' : 'failed'/);
  assert.doesNotMatch(route, /result\.ok \? 'success'/, '受け付け＝成功に戻っている');
});

test('控え番号を残す', () => {
  // 番号が無いと、「来ていない」と言われたときに追いかける手がかりが1つも無い。
  const route = read('app/api/contact/route.ts');
  assert.match(route, /id: result\.data\?\.id \?\? null/);
  assert.match(route, /`\$\{r\.channel\}_id`/);
});

test('店主へ知らせが行かなかったときは、必ず記録に残す', () => {
  const route = read('app/api/contact/route.ts');
  assert.match(route, /console\.error\('\[Contact\] owner notification not accepted:'/);
});

test('届いたかどうかを、あとから受け取って書き込む', () => {
  const hook = read('app/api/resend/webhook/route.ts');
  assert.match(hook, /'email\.delivered': 'delivered'/);
  assert.match(hook, /'email\.bounced': 'bounced'/);
  assert.match(hook, /recordContactDelivery/);
  // 控え番号から問い合わせを引く
  assert.match(hook, /extra_fields->>\$\{channel\}_id/);
});

test('画面が、受け付けと到着を言い分ける', () => {
  const page = read('app/laruHP/contacts/page.tsx');
  assert.match(page, /accepted: '送信を受け付けました（到着は未確認）'/);
  assert.match(page, /delivered: '届きました'/);
  assert.match(page, /bounced: '届きませんでした/);
  // 戻ってきたときは、送れなかったより強く出す
  assert.match(page, /extra\[k\] === 'bounced' \|\| extra\[k\] === 'complained'/);
});
