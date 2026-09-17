import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 「はじめてガイド」に、押せない項目が並んでいた。
 *
 * 1番目の「サイトを作成」は、**どの状態でも押せなかった。**
 *   サイトが0件 … href が undefined。リンクにならない
 *   1件以上     … done になるので、そもそもリンクとして出さない
 * 出す条件が `!step.done && step.href` なので、両方の状態で外れる。
 * いちばん必要な「まだ何も無い人」のときに、ただの灰色の文字だった。
 *
 * 「サイトを公開」と「独自ドメインを設定」は /laruHP/dashboard、
 * つまり**いま見ているそのページ**を指していた。押しても何も起きない。
 *
 * 登録した6人のうち5人がサイトを1つも作らずに消えている。
 * その人たちが見ていた画面の、いちばん上の案内がこれだった。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

function steps(): string {
  const src = read('app/laruHP/dashboard/DashboardClient.tsx');
  const at = src.indexOf('const steps = [');
  assert.ok(at > 0, 'はじめてガイドの項目が見つからない');
  return src.slice(at, src.indexOf('];', at));
}

test('1番目は、何も無い人でも押せる', () => {
  const block = steps();
  assert.match(block, /\{ label: 'サイトを作成', done: sites\.length > 0, href: '\/laruHP\/studio' \}/,
    'サイトが無いときに行き先が無い');
  assert.doesNotMatch(block, /href: sites\.length === 0 \? undefined/, '古い形が残っている');
});

test('自分自身を指す項目が無い', () => {
  // 押しても何も起きないリンクは、壊れているのと同じ。
  const block = steps();
  assert.doesNotMatch(block, /href: '\/laruHP\/dashboard'/, 'いま見ている画面を指している');
});

test('どの項目にも行き先がある', () => {
  const block = steps();
  const labels = [...block.matchAll(/label: '([^']+)'/g)].map(m => m[1]);
  const hrefs = [...block.matchAll(/href: (?:firstSite \?[^,]+|'[^']+')/g)];
  assert.equal(labels.length, 5, '項目の数が変わった');
  assert.equal(hrefs.length, 5, `行き先の無い項目がある: ${labels.length - hrefs.length} 件`);
});

test('公開の項目は、作りかけのサイトへ連れて行く', () => {
  const block = steps();
  assert.match(block, /firstSite \? `\/laruHP\/studio\?siteId=\$\{firstSite\}&step=edit` : '\/laruHP\/studio'/,
    '公開しに行く場所が分からない');
});

test('未完了のときだけリンクにする作りは、そのまま', () => {
  // 済んだ項目までリンクにすると、何が残っているのか分からなくなる。
  const src = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(src, /\{!step\.done && step\.href \? \(/);
});
