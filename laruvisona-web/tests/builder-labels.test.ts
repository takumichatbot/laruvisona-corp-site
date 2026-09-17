import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BLOCK_ICON_PATHS, blockIconPath, BLOCK_ICON_FALLBACK } from '../lib/laruhp-block-icons';

/**
 * ビルダーの、最初に目に入る所。
 *
 * 2026-09-17まで、部品一覧と上の帯に**絵の代わりの短い日本語**が入っていて、
 * 右に本当の名前が並ぶので、こう見えていた。
 *
 *   見出 見出し      ← 同じ言葉が2回
 *   動画 動画        ← 同じ言葉が2回
 *   文  テキスト
 *   写真 画像
 *   速度 速度
 *   URL URLインポート
 *   コピー コピー
 *
 * 初めて開いた人には、**壊れている画面**に見える。
 * ここは作りはじめの人がいちばん最初に見る所で、
 * 7件中6件が下書きのまま止まっている画面でもある。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const builder = read('app/laruHP/builder/page.tsx');

/** 注釈を落としたコード。決めごとを注釈にも書くので、探すのは外だけにする。 */
const bare = builder
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

test('同じ言葉を2回出さない', () => {
  const stutter: string[] = [];
  builder.split('\n').forEach((line, i) => {
    // 「語 語」「語 語+なにか」の形を、画面に出る文字として探す
    const m = line.match(/>\s*([ぁ-んァ-ヶ一-龯A-Za-z0-9]{1,4})\s+([ぁ-んァ-ヶ一-龯A-Za-z0-9/]{1,12})\s*</);
    if (m && (m[2].startsWith(m[1]) || m[1] === m[2])) stutter.push(`${i + 1}: ${m[1]} ${m[2]}`);
  });
  assert.deepEqual(stutter, []);
});

test('部品一覧は、文字ではなく絵を出す', () => {
  assert.match(builder, /<BlockIcon type=\{item\.type\} \/>/);
  assert.doesNotMatch(builder, /className="text-base leading-none">\{item\.icon\}/);
  // 絵の代わりの文字（icon: '案内' など）は、定義ごと消えていること
  assert.doesNotMatch(builder, /as BlockType, label: '[^']*', icon: '/);
});

test('部品の絵が、全部そろっている', () => {
  // 一覧に出る部品を拾って、絵があるか見る。
  const types = [...builder.matchAll(/\{ type: '([a-z-]+)' as BlockType, label:/g)].map(m => m[1]);
  assert.ok(types.length >= 30, `部品が${types.length}件しか拾えていない`);
  const missing = types.filter(t => !BLOCK_ICON_PATHS[t]);
  assert.deepEqual(missing, [], '絵の無い部品');
});

test('知らない部品でも、穴を開けない', () => {
  assert.equal(blockIconPath('nav'), BLOCK_ICON_PATHS.nav);
  assert.equal(blockIconPath('まだ無い部品'), BLOCK_ICON_FALLBACK);
});

test('絵の描き方を、道しるべと揃える', () => {
  // 画面ごとに描き方が変わると、同じ製品に見えなくなる。
  assert.match(builder, /viewBox="0 0 24 24"[\s\S]{0,120}strokeWidth="1\.75"/);
  for (const [type, path] of Object.entries(BLOCK_ICON_PATHS)) {
    assert.doesNotMatch(path, /fill="(?!none)/, `${type}: 塗りを使っている`);
    assert.ok(path.length > 10, `${type}: 中身が薄い`);
  }
});

test('絵の場所に、大きな文字を置かない', () => {
  // 絵を入れるつもりの正方形（w-N h-N）に、大きな日本語を入れると枠からはみ出す。
  //   w-16 h-16（64px）に text-3xl（30px）で「スマホ」＝ 約90px。入らない。
  // 小さなバッジ（w-8 h-8 に text-[11px] で「SEO」「代理」）は別物なので見逃す。
  // 見分けは文字の大きさ。base 以上を大きいとする。
  const BIG = /text-(base|lg|xl|2xl|3xl|4xl|5xl|\[(1[6-9]|[2-9]\d)px\])/;
  const bad: string[] = [];
  bare.split('\n').forEach((line, i) => {
    const box = line.match(/className="w-(\d+) h-(\d+)[ "]/);
    if (!box || box[1] !== box[2]) return;
    if (!BIG.test(line)) return;
    const text = line.match(/>([ぁ-んァ-ヶ一-龯]{2,})</);
    if (text) bad.push(`${i + 1}: w-${box[1]} h-${box[1]} の枠に大きく「${text[1]}」`);
  });
  assert.deepEqual(bad, []);
});

test('見張りが、本当に見つけられること', () => {
  // 直した3つと同じ形を食わせて、落ちることを確かめる。
  const BIG = /text-(base|lg|xl|2xl|3xl|4xl|5xl|\[(1[6-9]|[2-9]\d)px\])/;
  const bad = '<div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6">スマホ</div>';
  const box = bad.match(/className="w-(\d+) h-(\d+)[ "]/)!;
  assert.equal(box[1], box[2]);
  assert.ok(BIG.test(bad));
  assert.ok(/>([ぁ-んァ-ヶ一-龯]{2,})</.test(bad));
  // 小さなバッジは見逃すこと
  const ok = '<div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold">代理</div>';
  assert.ok(!BIG.test(ok));
});

test('スマホで最初に出る画面が、同じ言葉を2回出さない', () => {
  // 「スマホ」の絵文字代わりの文字 + 見出し「スマホでは編集画面へ」で2回だった。
  const at = bare.indexOf('スマホでは編集画面へ');
  assert.ok(at > 0);
  const before = bare.slice(Math.max(0, at - 900), at);
  assert.doesNotMatch(before, />スマホ</, '見出しの前に「スマホ」の文字が置いてある');
  assert.match(before, /<svg[\s\S]*strokeWidth="1\.75"/, '絵になっていない');
});
