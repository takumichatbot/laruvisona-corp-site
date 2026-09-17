import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * サイトカードの面。
 *
 * 2026-09-17、カードの中に**実物**を出そうとして、外した。
 * 下書きからHTMLを作る口（export-html?inline=1）に sandbox="" の iframe を
 * 読ませる作りで、3回出荷して3回とも本番で白いままだった。
 *   ・枠は読み込み済み（onLoad は発火する）
 *   ・位置も大きさも正しい
 *   ・返るHTMLも正しい（62KB・本文41,000字）
 *   ・その枠を手で1px動かすと、その場で絵が出る
 * **コードからは、どこも壊れていないように見える。**
 *
 * 白い四角は、頭文字の面より悪い。頭文字は「そういう見た目」に見えるが、
 * 白い四角は壊れて見える。だから戻した。
 *
 * ここで押さえるのは2つだけ。
 *   ・戻した状態が、白い穴を作らないこと
 *   ・材料（出す口）を消してしまわないこと。次はサーバー側で1枚の絵にする
 */

test('カードの面は、白い穴にならない', () => {
  const thumb = code('components/laruhp/SiteThumb.tsx');
  assert.match(thumb, /site-thumb-fallback/);
  assert.match(thumb, /site-thumb-initial/);
  const css = code('app/laruHP/app-shell.css');
  assert.match(css, /\.site-thumb-fallback/);
  assert.match(css, /\.site-thumb \{[^}]*height: 152px/);

  const card = code('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(card, /<SiteThumb/);
});

test('描かれるかどうかをブラウザ任せにしない', () => {
  // 出るまでに「読み込み」「縮小」「描き直し」を挟むほど、
  // どれか1つが動かなかった日に何も出なくなる。実際に3回そうなった。
  const thumb = code('components/laruhp/SiteThumb.tsx');
  assert.doesNotMatch(thumb, /<iframe/, 'また枠で出そうとしている');
  assert.doesNotMatch(thumb, /requestAnimationFrame/);
  assert.doesNotMatch(thumb, /transform:\s*`?scale/);
});

test('実物を出す材料は、残してある', () => {
  // 次にやるときは、公開・更新のときに**サーバー側で1枚の絵にして**保存する。
  // その材料がこの口。消さないこと。
  const route = code('app/api/sites/[id]/export-html/route.ts');
  assert.match(route, /inline'\) === '1'/, '下書きから画面用のHTMLを作る口');
  assert.match(route, /X-Robots-Tag/, '検索に拾わせない');
  // 取り出し（ダウンロード）は、これまでどおり保存ダイアログを出す
  assert.match(route, /Content-Disposition/);
  // 持ち主だけが読める
  assert.match(route, /\.eq\('user_id', user\.id\)/);
});
