// スマホ編集画面の回帰テスト。
//
// ビルダーはドラッグ前提でスマホでは使えず、MobileOverlay で止まっていた。
// 「作れないが、直せる」を成立させるための画面を別に用意した。
// 壊せないことを最優先にしているので、その線引きを固定する。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const edit = read('../app/laruHP/edit/page.tsx');
const builder = read('../app/laruHP/builder/page.tsx');

test('文章と並べ替えはできる', () => {
  assert.match(edit, /const setField = /, '文章を書き換えられない');
  assert.match(edit, /const move = \(blockId: string, dir: -1 \| 1\)/, '並べ替えができない');
  assert.match(edit, /aria-label="ひとつ上へ"/);
});

test('壊せる操作は入れない（追加・削除・レイアウト変更）', () => {
  for (const forbidden of ['deleteBlock', 'addBlock', 'blocks.splice', 'crypto.randomUUID']) {
    assert.ok(!edit.includes(forbidden), `${forbidden} がある＝スマホで壊せてしまう`);
  }
});

test('色・画像・URL・IDは編集対象にしない', () => {
  assert.match(edit, /const SKIP_KEY = /);
  const skip = edit.slice(edit.indexOf('const SKIP_KEY'), edit.indexOf('function isText'));
  for (const k of ['color', 'image', 'src', 'url', 'link', 'priceId', 'secret']) {
    assert.ok(skip.includes(k), `${k} が編集対象から除外されていない`);
  }
  assert.match(edit, /!\/\^#\[0-9a-fA-F\]\{3,8\}\$\/\.test\(v\)/, '色コードを文章として出してしまう');
  assert.match(edit, /!\/\^https\?:\\\/\\\/\/i\.test\(v\)/, 'URLを文章として出してしまう');
});

test('保存前の離脱で警告する', () => {
  assert.match(edit, /beforeunload/, '編集内容を失う');
});

test('v1（配列）と v2（pages）の両方の保存形式を読める', () => {
  assert.match(edit, /Array\.isArray\(bj\)/, '古い形式のサイトが開けない');
});

test('タップ領域と入力サイズの土台に乗っている', () => {
  assert.match(edit, /className="laru-touch min-h-screen/);
  assert.match(edit, /w-11 h-11/, '並べ替えボタンが44px未満');
});

test('ビルダーのスマホ案内から編集画面へ行ける', () => {
  assert.match(builder, /href="\/laruHP\/edit"/, 'スマホから編集画面へ辿れない');
  assert.ok(!builder.includes('このまま続ける（表示が崩れます）'),
    '案内が「崩れます」だけのまま＝代替手段を示せていない');
});

test('既定で中身のあるサイトを開く（空のサイトで壊れて見えない）', () => {
  assert.match(edit, /async function firstSiteWithBlocks/,
    '先頭のサイトが空だと、開いた瞬間まっさらで壊れて見える');
  assert.match(edit, /Number\(!!b\.published\) - Number\(!!a\.published\)/, '公開済みを優先していない');
});

test('中身が無いときは理由を出す', () => {
  assert.match(edit, /このサイトにはまだ中身がありません/);
});
