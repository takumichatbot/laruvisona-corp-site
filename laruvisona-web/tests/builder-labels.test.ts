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

test('小さなボタンに、入らない文字を置かない', () => {
  // w-6 h-6（24px）の丸に3文字は入らない。隣（↑↓⧉✕）に合わせる。
  const small = builder.split('\n').filter(l => /className="w-6 h-6 /.test(l) && />[ぁ-んァ-ヶ一-龯]{2,}</.test(l));
  assert.deepEqual(small, []);
});
