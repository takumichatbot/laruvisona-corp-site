// ビルダーのキーボード操作に関する回帰テスト。
//
// 毎日触る画面なので、ショートカットの取りこぼしはそのまま体験の悪さになる。
// 見つかっていた2つの不具合を固定する。
//   1. Shift を押すと e.key は大文字（'Z'）になるため、小文字比較では
//      Cmd+Shift+Z（やり直し）が一度も発火していなかった。
//   2. Undo が入力欄の中でも効いていた。文字を打ち間違えて Cmd+Z を押すと、
//      その文字ではなくサイト全体が一手前まで巻き戻っていた。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/laruHP/builder/page.tsx', import.meta.url), 'utf8');
const handler = src.slice(
  src.indexOf('const handler = (e: KeyboardEvent) => {'),
  src.indexOf("window.addEventListener('keydown', handler)"),
);

test('キー比較は大文字小文字を区別しない（Cmd+Shift+Z が効く）', () => {
  assert.match(handler, /const k = e\.key\.toLowerCase\(\)/, 'キーを正規化していない');
  assert.ok(!/e\.key === 'z'/.test(handler), "小文字固定の比較が残っている（Shift 併用で発火しない）");
  assert.match(handler, /k === 'y' \|\| e\.shiftKey.*redo\(\)/, 'やり直しが Shift と Ctrl+Y の両方に対応していない');
});

test('文字入力中は Undo / Redo を横取りしない', () => {
  const undoBlock = handler.slice(handler.indexOf("k === 'z' || k === 'y'"));
  assert.match(undoBlock.slice(0, 200), /if \(inField\) return;/,
    '入力欄の中でも Undo が効くと、打ち間違いではなくサイト全体が巻き戻る');
});

test('保存は入力中でも効く', () => {
  const saveIdx = handler.indexOf("k === 's'");
  const inFieldIdx = handler.indexOf('if (inField) return;');
  assert.ok(saveIdx > 0 && saveIdx < inFieldIdx, '保存が入力中に効かなくなっている');
});

test('コピー・貼り付け・複製は入力中に効かせない', () => {
  for (const key of ["k === 'c'", "k === 'v'", "k === 'd'"]) {
    const i = handler.indexOf(key);
    assert.ok(i > 0, `${key} の分岐が無い`);
    assert.match(handler.slice(i, i + 120), /!inField/, `${key} が入力中でも発火する`);
  }
});

test('複製（Cmd/Ctrl+D）がある', () => {
  assert.match(handler, /k === 'd' && selectedId && !inField/);
  assert.match(handler, /const copy: Block = \{ \.\.\.structuredClone\(block\), id: crypto\.randomUUID\(\) \}/);
});

test('履歴に積んでから変更する（複製・貼り付けが取り消せる）', () => {
  const dup = handler.slice(handler.indexOf("k === 'd'"));
  assert.match(dup.slice(0, 400), /pushHistory\(siteRef\.current\)/, '複製が Undo できない');
});
