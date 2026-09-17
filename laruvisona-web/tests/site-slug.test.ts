import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSiteSlug, isValidSiteSlug, isAutoSiteSlug, cleanSiteSlugInput } from '../lib/site-slug';

/**
 * 公開URLに入る文字列の検査。
 *
 * 2026-09-17、本番で見つけたこと。
 * 作る側と直す側で**別の決まり**を使っていた。
 *   作る  ひらがな・漢字を残す
 *   直す  英数字とハイフンだけ、連続ハイフンも禁止
 * その結果、すべてのサイトが「直す側では通らない値」で生まれていた。
 *   実際の値: 新しい--mtzlm6eu
 *
 * 貼ると laruvisona.jp/hp/%E6%96%B0%E3%81%97%E3%81%84--mtzlm6eu になる。
 * しかも作った直後の名前は「新しいサイト」なので、
 * **全員のURLに「新しい」が残る。** お客様が配るチラシに載るのが、その文字。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('作った値が、直す側の決まりでも通る', () => {
  // ここが食い違うと、生まれた時点で直せない値ができる。
  for (const name of [
    '新しいサイト', 'カフェ木もれ日', '鈴木整体院', 'LARU Cafe', 'ＡＢＣ商店',
    '   ', '---', 'a', 'あ', '🍰🍰', 'My Shop!!', 'x'.repeat(200),
  ]) {
    const slug = makeSiteSlug(name);
    assert.ok(isValidSiteSlug(slug), `「${name}」→「${slug}」が決まりを満たさない`);
  }
});

test('URLに日本語を入れない', () => {
  // 貼った先で %E6%96%B0... になる。怪しいリンクに見える。
  for (const name of ['新しいサイト', 'カフェ木もれ日', '鈴木整体院']) {
    const slug = makeSiteSlug(name);
    assert.match(slug, /^[a-z0-9-]+$/, `「${name}」→「${slug}」に日本語が残っている`);
    assert.doesNotMatch(slug, /新|し|い|木|鈴/);
  }
});

test('日本語だけの屋号は、読み替えずに預かる', () => {
  // 「木もれ日」を komorebi と読むか kimoreb i と読むかは、こちらには分からない。
  // 間違えた読みがURLとして一生残るより、画面で本人に決めてもらう。
  const slug = makeSiteSlug('カフェ木もれ日', 1_700_000_000_000);
  assert.ok(isAutoSiteSlug(slug), `「${slug}」が「決めてください」の対象にならない`);
  assert.match(slug, /^site-/);
});

test('英字のある屋号は、その字を使う', () => {
  assert.match(makeSiteSlug('LARU Cafe', 1_700_000_000_000), /^laru-cafe-/);
  assert.match(makeSiteSlug('Suzuki Seitai', 1_700_000_000_000), /^suzuki-seitai-/);
  // 英字から作った値は「決めてください」を出さない
  assert.ok(!isAutoSiteSlug(makeSiteSlug('LARU Cafe', 1_700_000_000_000)));
});

test('ハイフンが2つ続かない', () => {
  // 直す側が禁じている形。作る側が作っていた（新しい--mtzlm6eu）。
  for (const name of ['LARU  Cafe', 'a - - b', '新しいサイト', 'A!!!B']) {
    assert.doesNotMatch(makeSiteSlug(name), /--/, name);
  }
});

test('長い屋号でも、決まりの長さに収まる', () => {
  const slug = makeSiteSlug('a'.repeat(300));
  assert.ok(slug.length <= 60, `${slug.length}文字`);
  assert.ok(isValidSiteSlug(slug));
  assert.doesNotMatch(slug, /-$/, '切った末尾がハイフンで終わっている');
});

test('入力欄は、使えない文字をその場で落とす', () => {
  assert.equal(cleanSiteSlugInput('My Shop!'), 'myshop');
  assert.equal(cleanSiteSlugInput('カフェ'), '');
  assert.equal(cleanSiteSlugInput('A-B_C'), 'a-bc');
  assert.ok(cleanSiteSlugInput('x'.repeat(200)).length <= 60);
});

test('決まりを書き写した場所が、ほかに無い', () => {
  // 食い違いは「同じ規則を2箇所に書いた」ことから起きた。
  const copies: string[] = [];
  for (const path of [
    'app/api/sites/route.ts',
    'app/api/sites/[id]/route.ts',
    'app/laruHP/dashboard/DashboardClient.tsx',
  ]) {
    const src = read(path);
    if (/\[\^a-z0-9ぁ-ん一-龯\]/.test(src)) copies.push(`${path}: 日本語を残す古い規則`);
    if (/\^\[a-z0-9\]\(\[a-z0-9-\]\*\[a-z0-9\]\)\?\$/.test(src)) copies.push(`${path}: 規則の書き写し`);
    assert.match(src, /site-slug/, `${path} が lib/site-slug.ts を使っていない`);
  }
  assert.deepEqual(copies, []);
});

test('自動で付いた値は、画面で「決めてください」と出す', () => {
  const card = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(card, /isAutoSiteSlug\(site\.slug\)/);
  assert.match(card, /URLを決める/);
  // 指で触る画面には hover が無い。鉛筆だけに頼らない。
  const auto = card.slice(card.indexOf('URLを決める') - 600, card.indexOf('URLを決める') + 200);
  assert.doesNotMatch(auto, /opacity-0 group-hover/);
});
