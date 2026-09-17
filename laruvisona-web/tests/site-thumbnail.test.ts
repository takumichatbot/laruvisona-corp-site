import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * 注釈を落としたコード。
 * 「以前はこう書いていた」を注釈に残すと、その文字列を探す検査に引っかかる。
 * 経緯は残したいので、探すほうを注釈の外だけにする。
 */
const bare = (p: string) => code(p)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

/**
 * サイトカードに、実際の見た目を出す。
 *
 * 2026-09-17まで、カードの絵は灰色の面に屋号の頭文字が1つ大きく乗るだけだった。
 * 7件並ぶと「新」が6つ並び、どれがどれか分からない。
 * 「完成像を見ながら作る」と売っているのに、管理画面でその完成像が見えなかった。
 */

test('カードが、本物のHTMLを読んでいる', () => {
  const thumb = code('components/laruhp/SiteThumb.tsx');
  assert.match(thumb, /export-html\?inline=1/, '見た目の取得先が違う');
  const card = code('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(card, /<SiteThumb/);
  // 頭文字だけの面には戻らない
  assert.doesNotMatch(card, /text-\[84px\] font-bold text-gray-500/);
});

test('顧客サイトの中のスクリプトを、管理画面で走らせない', () => {
  const thumb = code('components/laruhp/SiteThumb.tsx');
  // 顧客サイトには外部の埋め込み（チャット等）が入る。縮小表示のために
  // それを管理画面で動かす理由は無いので、まとめて止める。
  assert.match(thumb, /sandbox=""/, 'sandbox が無いと、中のスクリプトが動く');
  const css = code('app/laruHP/app-shell.css');
  assert.match(css, /\.site-thumb-frame \{[\s\S]*?pointer-events: none/, '触れると中身を操作できてしまう');
  assert.match(thumb, /aria-hidden="true"/, '読み上げに縮小画像の中身が混ざる');
});

test('開いた瞬間に、全部を描きにいかない', () => {
  const thumb = code('components/laruhp/SiteThumb.tsx');
  // 7件ぶんを同時に取ると、サーバー側で7回ぶんの組み立てが一度に走る
  assert.match(thumb, /IntersectionObserver/, '画面に入るまで待っていない');
  assert.match(thumb, /loading="lazy"/);
});

test('読めなかったときに、真っ白にしない', () => {
  const thumb = code('components/laruhp/SiteThumb.tsx');
  assert.match(thumb, /site-thumb-fallback/);
  assert.match(thumb, /setState\('failed'\)/);
  const css = code('app/laruHP/app-shell.css');
  assert.match(css, /\.site-thumb-fallback/);
});

test('取り出し用のHTMLは、これまでどおり保存ダイアログを出す', () => {
  // inline=1 を足したせいで、書き出しがブラウザ表示に変わっていないこと
  const route = code('app/api/sites/[id]/export-html/route.ts');
  assert.match(route, /Content-Disposition/);
  assert.match(route, /inline'\) === '1'/);
  // 持ち主だけが読める状態は保つ
  assert.match(route, /\.eq\('user_id', user\.id\)/);
});

test('絵を、移り変わり頼みで見せない', () => {
  // opacity:0 から始めてクラスで 1 にする作りは、移り変わりが走らない
  // 状況（裏に回ったタブ・動きを減らす設定・描画の間引き）で 0 のまま止まる。
  // 本番で実際に止まり、中身は届いているのに頭文字の面だけが出ていた。
  const css = code('app/laruHP/app-shell.css');
  const rule = css.slice(css.indexOf('.site-thumb-frame {'));
  assert.doesNotMatch(rule.slice(0, rule.indexOf('}')), /opacity:\s*0/,
    '読み込み後に見せる作りに戻っている');
  assert.doesNotMatch(css, /\.site-thumb-frame\.is-ready/);
  assert.doesNotMatch(code('components/laruhp/SiteThumb.tsx'), /is-ready/);
});

test('絵を、縮小して見せない', () => {
  // 3倍で描いて1/3に縮める作りは、縮小を掛けた枠が描き直されず
  // **絵が白いまま残る**ことがあった。本番で7枚すべてがそうなった。
  // 枠も位置も大きさも正しく、返るHTMLも正しいので、コードからは正常に見える。
  // 等倍のまま、カードの幅で描く。
  const tsx = bare('components/laruhp/SiteThumb.tsx');
  assert.doesNotMatch(tsx, /transform:\s*`?scale/);
  assert.doesNotMatch(tsx, /SCALE/);
  assert.match(tsx, /width: '100%'/);
  const css = bare('app/laruHP/app-shell.css');
  const rule = css.slice(css.indexOf('.site-thumb-frame {'));
  assert.doesNotMatch(rule.slice(0, rule.indexOf('}')), /transform/);
});
