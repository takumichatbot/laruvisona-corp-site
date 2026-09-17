import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { siteCreationAccess } from '../lib/site-creation-access.ts';

/**
 * 書いてあることと、動きを合わせておく。
 *
 * この製品で繰り返し起きているのは、同じ形の壊れ方だった。
 *   料金表に「メールシーケンス3件まで」と書いてあるのに、APIに上限が無かった
 *   プランに「毎週AIがSEO記事を自動公開」と書いてあるのに、動かす処理が無かった
 *   登録画面に「決済は公開するときで構いません」と書いてあるのに、
 *     保存の時点で契約を求めていた
 *
 * 売り文句のほうが先に書かれ、実装がついてこない。そして**誰も気づかない。**
 * 気づくのは、期待して入ってきたお客様だけ。そして黙って帰る。
 *
 * ここでは「無料で作れる」という約束だけを見張る。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('登録画面の約束が、いまも本当である', () => {
  const signup = read('app/laruHP/auth/signup/SignupClient.tsx');
  // 約束の文言（変わったらここも見直す）
  assert.match(signup, /アカウントを作るところまでは無料です。決済は、公開するときで構いません。/);
  // その約束どおり、契約が無くてもサイトを作れること
  const free = siteCreationAccess('someone@example.com', null, null, []);
  assert.equal(free.paying, false);
  assert.ok(free.limit >= 1, '「無料で始める」と書いてあるのに、1つも作れない');
});

test('一覧の空の画面の約束も、本当である', () => {
  const dash = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(dash, /クレジットカード不要・今すぐ無料で試せます/);
  assert.ok(siteCreationAccess('someone@example.com', null, 'inactive', []).limit >= 1);
});

test('制作の最初の画面が、無い壁を立てていない', () => {
  /*
    ここに「保存・公開にはログインとご契約が必要です」と書いてあった。
    4つの質問に答える前に、**まだ無い壁**を自分で見せていた。
    保存に契約は要らない。要るのは公開のときだけ。
  */
  const start = read('components/studio/StudioStart.tsx');
  assert.doesNotMatch(start, /保存・公開にはログインとご契約が必要です/, '古い断りが残っている');
  assert.match(start, /保存はログインだけでできます/);
  assert.match(start, /公開するとき/, '公開に契約が要ることを書いていない');
});

test('公開には契約が要る、と書いてある所は残す', () => {
  // 只で配るわけではない。そこは曖昧にしない。
  const publish = read('app/api/sites/[id]/publish/route.ts');
  assert.match(publish, /hasServiceAccess/);
  const signup = read('app/laruHP/auth/signup/SignupClient.tsx');
  assert.match(signup, /決済は、公開するときで構いません/);
});

test('AIの提案は、契約が要るままで文言も合っている', () => {
  // こちらは実際に契約を見ている（app/api/ai/section-proposal）。文言は正しい。
  const assistant = read('components/studio/SectionAssistant.tsx');
  assert.match(assistant, /ログインとご契約が必要です/);
  const api = read('app/api/ai/section-proposal/route.ts');
  assert.match(api, /hasServiceAccess\(profile\.subscription_status\)/);
});
