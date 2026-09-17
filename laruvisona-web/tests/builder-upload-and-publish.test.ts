import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 押したのに固まる／上げたのに壊れる、の2つ。
 *
 * ── 1. 「公開する」が永久に固まっていた ──
 * setPublishing(true) のあとの通信が try/catch の外にあった。
 * 回線が切れるとその場で止まり、**setPublishing(false) に一生たどり着かない。**
 * ボタンは disabled のまま「公開中...」。画面には何も出ない。
 * 直すには再読み込みしかないが、それを思いつく人ばかりではない。
 *
 * 公開を押すのは、ここまで作ってきた人が最後に踏む一歩。
 *
 * ── 2. 画像を上げ損ねると、サイトが保存できない体になっていた ──
 * 上げるのに失敗すると、**黙って base64 を中身に埋めていた。**
 * 画面には画像が出るので、店主は上がったと思う。実際は:
 *   ・5MBの写真が約6.7MBの文字列になって blocks_json に入る
 *   ・保存の受け口は本文2MBまで → 以後どの保存も400で落ちる
 *   ・下書きのローカル保存も容量超過で黙って止まる
 * 1回の上げ損ねで、そのサイトは保存できなくなる。画面には何も出ない。
 * 店主は編集を続け、全部消える。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const builder = read('app/laruHP/builder/page.tsx');

const bare = bareSource(builder);

test('公開が、どう転んでも押せる状態に戻る', () => {
  const at = bare.indexOf('setPublishing(true);');
  assert.ok(at > 0, '公開の処理が見つからない');
  const fn = bare.slice(at, bare.indexOf('const handleOpenHistory'));
  assert.match(fn, /setPublishing\(true\);\s*try \{/, '通信が try の外にある');
  assert.match(fn, /\} finally \{\s*setPublishing\(false\);\s*\}/, 'finally で戻していない');
  // 途中の return で抜けても finally が効くので、手で戻す場所は残っていないこと
  assert.equal((fn.match(/setPublishing\(false\)/g) || []).length, 1, '戻す場所が2箇所以上ある（取りこぼしの元）');
});

test('公開が失敗したら、黙らない', () => {
  const at = bare.indexOf('setPublishing(true);');
  const fn = bare.slice(at, bare.indexOf('const handleOpenHistory'));
  assert.match(fn, /\} catch \{\s*setSaveError\(/, '例外のときに何も出していない');
});

test('画像を上げ損ねたら、埋めずに伝える', () => {
  // base64 をサイトの中身に埋める道が、1本も残っていないこと
  assert.doesNotMatch(bare, /readAsDataURL/, 'base64 を埋める道が残っている');
  assert.match(bare, /async function uploadImageFile\(file: File\)/);
  assert.match(bare, /onUploadError\(up\.error\)/);
  // 上げる所は5箇所ある。どこも「失敗したら何か出す」で終わること
  for (const sink of ['onUploadError(up.error)', 'setUploadError(up.error)', 'setImgError(up.error)']) {
    assert.ok(bare.includes(sink), `失敗の行き先が無い: ${sink}`);
  }
});

test('上げる所は、全部その一本を通る', () => {
  // 1つでも素の fetch が残っていると、その経路だけ黙って壊れる
  const raw = (bare.match(/fetch\('\/api\/images\/upload'/g) || []).length;
  assert.equal(raw, 1, `画像アップロードの素の呼び出しが${raw}箇所ある（共通処理の中の1つだけにする）`);
  const uses = (bare.match(/await uploadImageFile\(/g) || []).length;
  assert.ok(uses >= 5, `共通処理を使っている場所が${uses}箇所しかない（画像を上げる所は5箇所ある）`);
});

test('上げ損ねの知らせが、店主の見える所へ出る', () => {
  // 受け取る口があっても、渡していなければ何も出ない
  assert.match(bare, /onUploadError=\{setBuilderToast\}/, '知らせの行き先がつながっていない');
  assert.match(bare, /onUploadError: \(message: string\) => void;/, '受け口の型が無い');
});

test('上げる側は、状態と中身の両方を見る', () => {
  // data.url だけ見ると、200以外でも url らしきものが入っていれば通ってしまう
  assert.match(bare, /if \(res\.ok && typeof data\.url === 'string' && data\.url\) return \{ url: data\.url \};/);
  // 通信そのものが落ちたときも、理由を返すこと
  assert.match(bare, /catch \{\s*return \{ error: '画像を送れませんでした/);
});
