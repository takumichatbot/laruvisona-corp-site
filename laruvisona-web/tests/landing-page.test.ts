// LARU HP の案内ページ（/laruHP）の約束事を固定する。
//
// 以前のページは、GSAPの入場演出が完走しないと見出しもCTAも見えなかった。
// 3D（WebGL）と背景動画も載っていて、通信量と発熱の割に商品の説明をしていなかった。
// 作り直したので、同じ失敗に戻らないための条件をここで固定する。
//
// 見た目そのものはテストできないが、「内容が必ず見える」「重いものを勝手に読まない」
// 「書いてよい事実だけを書く」は固定できる。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/laruHP/page.tsx', import.meta.url), 'utf8');
const demo = readFileSync(new URL('../components/lp/AssembleDemo.tsx', import.meta.url), 'utf8');

test('内容を隠してから見せる演出に依存しない', () => {
  assert.ok(!/opacity:\s*0/.test(src), '演出が動かない環境で見えなくなる書き方が戻っている');
  assert.equal(/gsap|ScrollTrigger/.test(src), false, '入場演出のためのライブラリが戻っている');
});

test('ファーストビューに3D（WebGL）を載せない', () => {
  assert.equal(/LaruHPScene|@react-three|from 'three'/.test(src), false, '3Dが戻っている');
  assert.equal(/@react-three|from 'three'/.test(demo), false, '組み上がるデモに3Dが入っている');
});

test('案内ページが動画を読み込まない', () => {
  // 素材が届いたら足すが、そのときも「静止画が先・条件が揃ってから」を守る。
  assert.equal(/<video|HeroBackgroundVideo|LoopVideo/.test(src), false, '動画が戻っている');
});

test('作例と画面写真は、必要になるまで読まない', () => {
  // 最初の画面は文字だけなので、先読みする画像は置かない。
  // 置くと、回線の細い環境で見出しの表示と取り合いになる（実測で約250ms）。
  const priority = src.match(/priority/g) || [];
  assert.equal(priority.length, 0, `先読みする画像がある（${priority.length}枚）`);
  assert.equal(/<img /.test(src), false, '素の <img> は使わない（大きさ指定と遅延読み込みが外れる）');
  // すべての画像に説明文がある
  const images = (src.match(/<Image\b/g) || []).length;
  assert.ok(images >= 3, `画像が少なすぎる（${images}）`);
  const alts = (src.match(/alt=\{?["s]/g) || []).length;
  assert.ok(alts >= images, `説明文の無い画像がある（画像 ${images} / 説明 ${alts}）`);
});

test('料金と契約条件を、画面に直接書かない', () => {
  // 数字を画面に書くと、料金ページや特商法と食い違う
  assert.match(src, /from '@\/lib\/laruhp-facts'/, '一次情報から読んでいない');
  assert.equal(/999|4,?980|9,?800/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), false,
    '料金の数字が画面側に直接書かれている');
});

test('裏の取れていない主張を書かない', () => {
  const banned = [
    /導入\s*[0-9,]+\s*[社店件]/, /満足度\s*[0-9]/, /[0-9]+\s*%\s*(アップ|向上|改善|増加)/,
    /No\.?1|ナンバーワン|第1位/i, /売上が.*倍/, /よく選ばれ|人気No|一番選ばれ|最も選ばれ/,
  ];
  const body = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const re of banned) assert.equal(re.test(body), false, `裏の取れていない主張がある: ${re}`);
});

test('見本が架空であることを、見本のそばに書く', () => {
  assert.match(src, /架空のお店/, '見本の断りが無い');
  assert.match(src, /生成した素材/, '写真が生成素材であることを書いていない');
});

test('押せるものは指で押せる大きさにする', () => {
  // 主要な導線（作りはじめる・見る・プランで始める・相談する）
  const big = src.match(/min-h-\[52px\]/g) || [];
  assert.ok(big.length >= 5, `52px未満の導線がある（${big.length}個しか無い）`);
});

/* ── 組み上がるデモ ──
   動画で「それらしく見せる」のではなく、実物を動かしている。
   その性質が失われていないかを見る。 */

test('デモの中身は、公開ページと同じ仕組みが作ったHTML', () => {
  assert.match(demo, /import \{ exportToHTML \} from '@\/lib\/html-export'/,
    '公開用のHTML生成を通っていない（見せかけになっている）');
  assert.match(demo, /data-lhp-block/, '公開HTMLの節をそのまま使っていない');
});

test('デモは、動きを減らす設定なら組み上がった状態で出す', () => {
  assert.match(demo, /prefers-reduced-motion: reduce/);
  assert.match(demo, /if \(mq\.matches\) setAssembled\(true\)/);
});

test('デモのボタンは本物で、押すと作り直す', () => {
  assert.match(demo, /onClick=\{\(\) => setPresetId\(p\.id\)\}/);
  assert.match(demo, /onClick=\{\(\) => setFont\(f\.value\)\}/);
  assert.match(demo, /useMemo\(\(\) => withDemoBridge\(exportToHTML\(/, '押しても作り直していない');
  assert.match(demo, /aria-pressed=/, '押した状態が読み上げに伝わらない');
});

test('デモは3Dの見た目をCSSだけで作る', () => {
  assert.match(demo, /perspective:1800px/);
  assert.match(demo, /translate3d\(/);
  assert.equal(/WebGLRenderingContext|canvas/.test(demo), false);
});

test('デモは画面の幅に合わせる（固定の縮尺にしない）', () => {
  // 1440px の組み方を固定の倍率で縮めていたので、スマホでは横が切れて
  // 文字も読めなかった。幅を測って、狭いところではスマホの組み方に切り替える。
  assert.match(demo, /ResizeObserver/, '幅を測っていない');
  assert.match(demo, /device === 'sp' \? 390 : 1440/, '画面ごとの組み方になっていない');
  assert.equal(/transform: 'scale\(0\.\d+\)'/.test(demo), false, '固定の倍率が残っている');
});

test('デモの中は、組み上がったあと本当に触れる', () => {
  // 「押せる実物」と説明する以上、pointer-events で殺してはいけない。
  // ばらけているあいだだけ止める。
  assert.equal(/^\s*a,button,form\{pointer-events:none\}/m.test(demo), false, '中の操作を全部止めている');
  assert.match(demo, /html\[data-locked="1"\] \[data-lhp-block\]\{pointer-events:none\}/);
  assert.match(demo, /type: 'goto'/, 'ページ内の移動ができない');
});

test('冒頭のデモは、最初の画面までにとどめる', () => {
  // スマホで、架空サロンの料金と予約フォームが延々と続いてから操作ボタンが
  // 来る形になっていた。最初は「完成した最初の画面＋組み上がるところ」までにして、
  // 予約フォームまでは押したときだけ開く。
  assert.match(demo, /PC_PEEK/);
  assert.match(demo, /SP_PEEK/);
  assert.match(demo, /このお店の予約フォームまで試す/, '開くための入口が無い');
  assert.match(demo, /LARU HP のお申し込みではありません/, '見本の予約と自社の申し込みを区別していない');
  assert.match(demo, /架空の美容室/, '見本であることを書いていない');
});

test('デモの送信は、どこへも送らない', () => {
  // 実際の予約を入れてしまわないこと。中の fetch を差し替えて、
  // その場で受け付けたとだけ出す。
  assert.match(demo, /window\.fetch = function\(\)/);
  assert.match(demo, /実際の予約は送っていません/);
});

test('デモの入れ物は、この画面から切り離す', () => {
  assert.match(demo, /sandbox="allow-scripts allow-forms"/);
  assert.equal(/allow-same-origin/.test(demo), false);
});
