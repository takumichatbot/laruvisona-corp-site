// LP のファーストビューに関する回帰テスト。
//
// 以前は見出し・説明文・CTAボタンに style={{ opacity: 0 }} を直接書いており、
// GSAP の入場演出が完走しない限り何も見えなかった。
// 演出が動かない条件（JS無効・読み込み失敗・動きを減らす設定・別タブで開かれて
// 描画が止まる）ではファーストビューが空のまま＝見出しもCTAも無い状態になる。
//
// 見た目そのものはテストできないが、「内容が必ず見える」ための仕掛けは固定できる。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/laruHP/page.tsx', import.meta.url), 'utf8');

test('ヒーローの要素に opacity:0 を直接書かない', () => {
  assert.ok(!/style=\{\{\s*opacity:\s*0\s*\}\}/.test(src),
    'JSXに opacity:0 を書くと、演出が動かない環境で永久に見えなくなる');
});

test('隠すのはJSが動く環境だけ（.lp-anim が付いた時のみ）', () => {
  assert.match(src, /\.lp-anim \.lp-hero-h1 span,/, '初期状態のCSSが .lp-anim で限定されていない');
  assert.match(src, /\.lp-anim \.lp-hero-cta,/, 'CTAが初期状態のCSSに含まれていない');
  assert.match(src, /d\.classList\.add\('lp-anim'\)/, 'ハイドレーション前に class を付ける処理が無い');
});

test('動きを減らす設定と、別タブで開かれた場合は演出しない', () => {
  assert.match(src, /prefers-reduced-motion: reduce/);
  assert.match(src, /document\.visibilityState !== 'visible'/,
    '別タブで開かれると描画が止まり演出が進まないため、そのまま見せる必要がある');
  assert.match(src, /if \(reduceMotion \|\| notVisible\) \{/);
});

test('演出が完走しなかった場合に必ず表示へ戻す保険がある', () => {
  // React 側（ハイドレーション後）
  assert.match(src, /const fuse = window\.setTimeout\(revealHero, \d+\)/, 'React側の保険が無い');
  assert.match(src, /revealHero = \(\) => \{[\s\S]*?el\.style\.opacity = '1'/, '強制表示の実装が無い');
  // インラインスクリプト側（ハイドレーションが起きなかった場合）
  assert.match(src, /if\(window\.__lpAnimDone\)return;[\s\S]*?el\.style\.opacity='1'/,
    'ハイドレーションが起きなかった場合の保険が無い');
});

test('演出が終わったら保険を解除する', () => {
  assert.match(src, /__lpAnimDone = true/);
  assert.match(src, /window\.clearTimeout\(fuse\)/);
});
