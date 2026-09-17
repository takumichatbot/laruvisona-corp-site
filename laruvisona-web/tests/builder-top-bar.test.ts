import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * ビルダーの上の帯を、押せる状態にする。
 *
 * 2026-09-17まで、上の帯にはAIで始まるボタンが**4つ**横に並んでいた。
 *
 *   AIチャット / AIレイアウト / AI生成 / AIで作り直す
 *
 * どれも技術の名前で、押すと何が起きるかは書いていない。
 * しかも一番右の「AIで作り直す」は、いま作ったページを全部消す。
 * 美容室の店主が、どれを押せばいいか分かるはずがない。
 * 分からないボタンは押されない。押されないまま下書きで止まる。
 *
 * さらに、最初に出る案内には「保存は自動。」とだけ書いてあり、
 * 同じ画面の右上には「未保存」と出ていた。**どちらかが嘘。**
 * 本当は「30秒ごとに自動、押せばすぐ」。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const builder = read('app/laruHP/builder/page.tsx');

/** 注釈を落としたコード。決めごとを注釈にも書くので、探すのは外だけにする。 */
const bare = builder
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

/** 上の帯に、画面の文字として出るボタンの名前 */
function topBarLabels(): string[] {
  const start = bare.indexOf('onClick={undo}');
  const end = bare.indexOf("{publishing ? '公開中...'");
  assert.ok(start > 0 && end > start, '上の帯を見つけられない');
  const bar = bare.slice(start, end);
  return [...bar.matchAll(/^\s{10,}([ぁ-んァ-ヶ一-龯A-Za-z][^<>{}\n]{1,14})$/gm)].map(m => m[1].trim());
}

test('AIで始まるボタンが、横に並んでいない', () => {
  const ai = topBarLabels().filter(l => l.startsWith('AI'));
  assert.ok(ai.length <= 1, `上の帯にAIのボタンが${ai.length}個ある: ${ai.join(' / ')}`);
});

test('まとめた中身は、起きることの言葉で書く', () => {
  // 「AIレイアウト」ではなく「ページの構成を考えてもらう」。
  for (const label of [
    'ページの構成を考えてもらう',
    '文章を書いてもらう',
    'このページを一から作り直す',
  ]) {
    assert.ok(bare.includes(label), `「${label}」が無い`);
  }
  // 技術の名前のままのボタンが残っていないこと
  for (const gone of ['>AIレイアウト<', '>AI生成<', '>AIで作り直す<']) {
    assert.ok(!bare.includes(gone), `${gone} が残っている`);
  }
});

test('消えるものがある選択肢は、押す前に言う', () => {
  const at = bare.indexOf('このページを一から作り直す');
  const around = bare.slice(at, at + 500);
  assert.match(around, /すべて消して/, '何が消えるか書いていない');
  assert.match(around, /rose-/, '他と同じ見た目で並んでいる');
});

test('3つとも、行き先の処理につながっている', () => {
  // 見た目だけ直して、押しても何も起きない状態にしない。
  for (const fn of ['handleAiLayout', 'handleAiGenerate', 'handleAiFullSite']) {
    assert.match(bare, new RegExp(`setShowAiMenu\\(false\\); ${fn}\\(\\);`), `${fn} につながっていない`);
  }
});

test('開いたら、外を触って閉じられる', () => {
  // 閉じられない被せ物は、画面が固まったように見える。
  const at = bare.indexOf('{showAiMenu && (');
  assert.ok(at > 0, 'まとめが無い');
  assert.match(bare.slice(at, at + 400), /onClick=\{\(\) => setShowAiMenu\(false\)\}/);
});

test('案内と、右上のボタンが、同じことを言う', () => {
  // 案内が「保存は自動。」だけだと、右上の「未保存」と食い違う。
  assert.ok(!bare.includes('保存は自動。'), '古い言い切りが残っている');
  assert.match(bare, /保存は30秒ごとに自動/);
  // 実際に30秒であること（文言だけ直して中身が違う、を防ぐ）
  assert.match(bare, /if \(editSeqRef\.current === seq\) setIsDirty\(false\);\s*\}, 30000\);/);
  // 案内の中のボタン名が、実物と同じ綴りであること
  assert.match(bare, /「公開する」を押すまでは/);
  assert.match(bare, /published \? '再公開' : '公開する'/);
});

test('公開するまで見えないことを、最初に言う', () => {
  // これが分からないと、作りかけを見られている気がして手が止まる。
  assert.match(bare, /あなた以外には見えません/);
});
