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

// ── ファーストビューから3Dを外した ───────────────────────────────
// 外した理由:
//  1. Veoの背景映像を敷いたので、同じ場所に装飾レイヤーが2枚重なっていた
//  2. three + @react-three/fiber + drei で200KB前後(gzip)のJSを配っていた。
//     見返りは抽象的な浮遊オブジェクトで、商品の説明を何もしていない
//  3. prefers-reduced-motion を見ておらず、LPの他の演出と方針が食い違っていた
//  4. モバイル判定も frameloop 制御も無く、スクロールで見えなくなった後も
//     WebGLのループが回り続けていた（発熱・電池）
// 部品(components/Canvas/LaruHPScene.tsx)は消していないので、戻すのは1行。
test('LPのファーストビューに3D(WebGL)を載せない', () => {
  assert.equal(/LaruHPScene/.test(src), false, 'ファーストビューに3Dが戻っている');
  assert.equal(/@react-three|from 'three'|Canvas\//.test(src), false, 'three系がLPに混ざっている');
});

// 背景映像も外した。Veoで作った1本が「開店前の無人の店内」で、
// 業種ショーケース用の6本と同じジャンルだった。HPを作るサービスの
// ファーストビューで「お客さんのお店」を流しても商品の説明にならない。
// 3Dを外したのと同じ理由。素材と配信経路は残してあるので復帰は数行。
test('ファーストビューは装飾レイヤーを重ねない', () => {
  const at = src.indexOf('<section ref={heroRef}');
  const hero = src.slice(at, at + 1400);
  assert.equal(/<HeroBackgroundVideo/.test(hero), false, '背景映像が戻っている');
  assert.equal(/<LaruHPScene/.test(hero), false, '3Dが戻っている');
  // 下地（放射グラデ・ぼかし円・グリッド）は残す。ここが無いと素っ気なくなる
  assert.match(hero, /radial-gradient\(ellipse_at_top/, 'ファーストビューの下地が消えている');
});
