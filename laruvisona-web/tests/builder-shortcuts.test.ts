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

// ── 保存の中身 ──
//
// 保存は3か所（自動保存・保存ボタン・新規作成）から呼ばれる。組み立てが
// 分かれていると、片方に入れ忘れた設定が保存のたびに消える。実際そうなっていた:
//   ・30秒ごとの自動保存 …… globalFooter（フッター）が入っていなかった
//   ・保存ボタン        …… sitePassword（サイトのパスワード）が入っていなかった
//
// さらに、設定を丸ごと送り返すと、別の画面で変えた値が古い値へ戻る。
// いまは「編集画面が持っている設定だけ」を送り、サーバ側で重ねる。

test('保存する中身を組み立てる場所は1つだけ', () => {
  assert.equal((src.match(/settings_json: owned/g) || []).length, 1);
  assert.equal((src.match(/settings_json_patch: owned/g) || []).length, 1);
  assert.match(src, /const buildSavePayload = useCallback/);
  // 自動保存・保存ボタン・新規作成が同じ組み立てを使う
  assert.equal((src.match(/buildSavePayload\((s|s0|site)(, 'full')?\)/g) || []).length, 4,
    '自動保存・保存ボタン・新規作成・公開時の作成が、同じ組み立てを使っていない');
});

test('編集画面が持っている設定だけを送る（古い値で上書きしない）', () => {
  const payload = src.slice(src.indexOf('const buildSavePayload'), src.indexOf('// Keep siteRef in sync'));
  // 画面を開いたときの設定を丸ごと送り返さない
  assert.equal(/loadedSettingsRef/.test(src), false,
    '読み込んだ設定を丸ごと送り返している（別画面の更新や失効したURLが戻る）');
  for (const k of ['globalFooter', 'sitePassword', 'customCss', 'lineNotifyToken', 'webhookUrl', 'clarityId', 'customPalette', 'design']) {
    assert.match(payload, new RegExp(`${k}: s\\.${k}`), `保存に含まれていない設定: ${k}`);
  }
  // 既存サイトの保存は「重ねる」側を使う
  assert.match(payload, /mode === 'full'/);
});

test('自動保存は、失敗を保存済みにしない', () => {
  const auto = src.slice(src.indexOf('// 30秒ごとの自動保存'), src.indexOf('// Warn before leaving'));
  assert.match(auto, /if \(!res\.ok\)/, '応答を確かめずに保存済みにしている');
  assert.match(auto, /setSaveError\(/);
  assert.match(auto, /catch \{[\s\S]*setSaveError\(/, '通信エラーを保存済みにしている');
  // 失敗したら未保存のまま
  assert.ok(auto.indexOf('return;') < auto.indexOf('setIsDirty(false)'),
    '失敗しても保存済みにしている');
});

test('保存している間の編集を、保存済みにしない', () => {
  // 送った時点の版番号を控え、戻ったときに進んでいれば未保存のままにする
  assert.match(src, /const editSeqRef = useRef\(0\)/);
  assert.match(src, /editSeqRef\.current \+= 1/);
  assert.equal((src.match(/if \(editSeqRef\.current === seq\)/g) || []).length, 2,
    '自動保存と保存ボタンの両方で、保存中の編集を見ていない');
});

test('編集画面の文字は、HTMLとして描かない', () => {
  // AIの生成結果やURL取り込みの文字列も同じ場所に入る
  assert.equal(/dangerouslySetInnerHTML=\{\{ __html: (d|item)\./.test(src), false,
    'ブロックの中身をHTMLとして描いている');
  assert.match(src, /function EditableText\(/);
  assert.match(src, /el\.textContent = value/);
});
