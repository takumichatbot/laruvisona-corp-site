// 実機幅（390px）で測って見つかった問題の回帰テスト。
//
// 測って分かったこと:
//   - 管理画面の入力欄が 10px / 12px。iOS Safari は16px未満の入力欄に
//     フォーカスするとページ全体を自動拡大するため、打つたびに画面が飛ぶ。
//   - LPのショーケースにある「このテンプレで →」（主要導線）が高さ31pxしかない。
//   - 管理画面に高さ40px未満の操作が複数あった。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const css = read('../app/globals.css');
const dashboard = read('../app/laruHP/dashboard/DashboardClient.tsx');
const lp = read('../app/laruHP/page.tsx');

test('スマホで入力欄が16px未満にならない（iOSの自動拡大対策）', () => {
  const block = css.slice(css.indexOf('@media (max-width: 767px)'));
  assert.match(block, /input, select, textarea \{\s*font-size: 16px !important;/,
    '16px未満のままだと、入力のたびにページが勝手に拡大する');
});

test('管理画面のタップ領域を44px以上にする仕組みがある', () => {
  assert.match(css, /\.laru-touch a\[href\],/);
  assert.match(css, /min-height: 44px;/);
  assert.match(dashboard, /className="laru-touch min-h-screen/,
    'ダッシュボードのルートに laru-touch が付いていない＝ルールが効かない');
});

test('管理画面の最小文字サイズを11pxまで引き上げる', () => {
  assert.match(css, /\.laru-touch \.text-\\\[10px\\\]/, '10pxの文字が実機で読めないまま');
});

test('公開サイトのプレビューやLPのモックには適用しない', () => {
  // laru-touch は管理画面だけ。LPに付けると、見せるための偽ボタンまで44pxに膨らむ。
  assert.ok(!/className="laru-touch/.test(lp), 'LPに laru-touch が付いている');
});

test('ショーケースの主要導線が44px以上ある', () => {
  const ctas = lp.match(/このテンプレで →/g) || [];
  assert.equal(ctas.length, 6, 'テンプレ導線の数が変わっている');
  const sized = lp.match(/inline-flex items-center min-h-\[44px\] px-4 py-2 rounded-lg hover:bg-/g) || [];
  assert.equal(sized.length, 6, `44px未満の導線が残っている（${sized.length}/6）`);
});
