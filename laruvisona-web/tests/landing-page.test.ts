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
const showcase = readFileSync(new URL('../components/lp/Showcase.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/laruHP/landing.css', import.meta.url), 'utf8');
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

test('最初の完成例だけを優先し、寸法付き画像を配信する', () => {
  assert.match(showcase, /fetchPriority=\{active\s*===\s*0\s*\?\s*'high'\s*:\s*'auto'\}/);
  assert.match(showcase, /width=\{1100\}\s+height=\{830\}/);
  assert.match(showcase, /sizes=/);
  assert.equal(/priority|loading="eager"/.test(src), false, '下の制作画面を先読みしない');
  assert.match(src, /width=\{1200\}\s+height=\{780\}/);
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
  assert.match(showcase, /架空のお店/, '見本の断りが無い');
  assert.match(showcase, /生成した素材/, '写真が生成素材であることを書いていない');
});

test('主要導線と作例の選択にタッチ用の寸法を用意する', () => {
  assert.match(css, /\.lp-button\s*\{[^}]*min-height:\s*56px/);
  assert.match(css, /\.lp-industry-tabs button\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
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
  assert.match(demo, /onClick=\{\(\) => choose\(c\.id\)\}/);
  assert.match(demo, /exportToHTML\(/, '押しても作り直していない');
  assert.match(demo, /aria-checked=/, '押した状態が読み上げに伝わらない');
});

test('デモの選択は1種類だけ', () => {
  // 雰囲気・書体・画面と3つ並べると、何を触ればよいのか分からなくなる。
  // 選ぶのは「見せ方」だけにして、書体はその見せ方に含める。
  assert.equal((demo.match(/role="radiogroup"/g) || []).length, 1, '選ぶ操作が2種類以上ある');
  assert.equal(/setFont\(/.test(demo), false, '書体の選択が残っている');
  assert.equal(/setAutoDevice\(/.test(demo), false, '画面の選択が残っている');
  assert.equal((demo.match(/CHOICE_IDS = \[[^\]]*\]/)?.[0].match(/'/g) || []).length / 2, 3, '3択になっていない');
});

test('スマホでは、選ぶところが見本より前にある', () => {
  // 見本の後ろに大きな札を縦に積むと、押した瞬間に見本の見出しと写真が
  // 画面の外へ出る。選ぶところは見本のすぐ上に置く。
  const group = demo.indexOf('role="radiogroup"');
  const stage = demo.indexOf('ref={stageRef}');
  assert.ok(group > 0 && stage > 0 && group < stage, '選ぶところが見本より後ろにある');
  assert.equal(/order-1 sm:order-2|order-2 sm:order-1/.test(demo), false,
    '画面の幅で並びを入れ替えている（スマホで見本が先になる）');
});

test('スマホの説明は、選んでいる1案だけ', () => {
  // 札ごとの説明を3つ縦に積むと、それだけで冒頭が伸びる。
  assert.match(demo, /hidden sm:block[\s\S]{0,140}\{c\.detail\}/, '札ごとの説明がスマホでも出る');
  assert.match(demo, /sm:hidden[^>]*>\s*\{busy \? `\$\{pickedChoice\.name\}/,
    'スマホ用の1行がない');
  assert.match(demo, /grid-cols-3/, 'スマホで横3択になっていない');
});

test('デモは、押しても画面を勝手に動かさない', () => {
  // 配置で見せる。スクロールで帳尻を合わせない。
  const choose = demo.slice(demo.indexOf('const choose = useCallback'), demo.indexOf('/* 中からの知らせ'));
  assert.equal(/scrollTo|scrollIntoView/.test(choose), false, '選んだときに画面を動かしている');
});

test('デモは、既存の設定（雰囲気のひな形）をそのまま使う', () => {
  // デモ専用の設定体系を作らない。制作画面で顧客が選べるものと同じでなければ、
  // ここで見せた見え方を顧客が再現できない。
  assert.match(demo, /import \{ DESIGN_PRESETS \} from '@\/lib\/site-design'/);
  assert.equal(/design: \{[^}]*ink:/.test(demo), false, 'デモの中に独自の配色を書いている');
});

test('デモの選択は、この画面の中だけで完結する', () => {
  // 見せ方を選んだだけで顧客のデータを書きに行かない。
  assert.equal(/fetch\(['"`]\/api/.test(demo), false, '保存APIを呼んでいる');
  assert.equal(/settings_json_patch|\/api\/hp\//.test(demo), false, '顧客データに触れている');
});

test('続けて選び直しても、古い描き終わりが最後の選択を上書きしない', () => {
  // 押すたびに世代番号を振り、いま最後に押されたものだけを表に出す。
  assert.match(demo, /genRef\.current \+= 1|\+\+genRef\.current/, '世代番号を振っていない');
  assert.match(demo, /if \(genRef\.current !== gen\) return;/, '古い世代を捨てていない');
  assert.match(demo, /d\.gen !== slot\.gen/, '古い入れ物からの知らせを捨てていない');
});

test('入れ替えのあいだ、前の画面を消さない', () => {
  // 作り直しのたびに白い画面を挟むと、「その場で変わる」体験にならない。
  // 入れ物を2つ持ち、描き終わってから入れ替える。
  assert.match(demo, /type Slot =/);
  assert.match(demo, /\[slots, setSlots\] = useState<\[Slot, Slot\]>/);
  assert.match(demo, /type: 'painted'/, '描き終わりを待たずに入れ替えている');
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
