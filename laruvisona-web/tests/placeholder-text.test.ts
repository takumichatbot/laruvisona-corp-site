import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isPlaceholderText, hasPlaceholderText } from '../lib/placeholder-text';
import { autoDescription } from '../lib/auto-description';
import { checkPublishReadiness, blockingItems } from '../lib/publish-readiness';

/**
 * ひな形のままの文字が、検索結果とLINEのプレビューに出ていた。
 *
 * 2026-09-17、本番で公開中のページを読んだら、こうなっていた。
 *
 *   <meta name="description" content="メニュー・料金プラン 紹介文を入力してください …">
 *   <meta property="og:description" content="… 紹介文を入力してください …">
 *   <meta name="twitter:description" content="… 紹介文を入力してください …">
 *
 * 出る場所は、検索結果と、**URLをLINEやXに貼ったときのプレビュー**。
 * お客様にURLを送ると、相手の画面に「紹介文を入力してください」と出る。
 *
 * 空っぽより悪い。空なら検索側が本文から拾うが、これは違う文が確定で出る。
 *
 * なぜそうなったか。ひな形の一覧が公開前の確認にしか無く、
 * **説明文を作る側は何も見ていなかった。** 同じ判断が要る場所が2つあり、
 * 片方にしか無かった。一覧は lib/placeholder-text.ts に1つだけ置く。
 *
 * ここに出てくる文字列は、すべて本番のデータから取ったもの。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** 本番の7サイトに実際に入っていた、ひな形のままの文字 */
const REAL = [
  'ここに見出しを入力',
  'サブタイトル・キャッチコピーを入力してください',
  '左側のコンテンツを入力してください。',
  '右側のコンテンツを入力してください。',
  'ここに本文テキストを入力してください。サービスの説明や会社の紹介など、伝えたいことを自由に記述できます。',
  '説明を入力してください',
  '実際の流れを入力してください',
  '料金を入力してください',
  '営業時間・定休日を入力してください',
  '紹介文を入力してください',
  'サンプル写真。公開前にご自身の写真へ差し替えてください。',
  '【例】カット',
  'お知らせ1のタイトルを入力',
  'テキスト・画像・ボタンをドラッグで好きな位置に置けます。',
  'サブテキスト（任意）',
];

/** お店の人が本当に書きそうな文。これを弾いたら、その人の言葉を捨てることになる */
const REAL_WRITING = [
  '朝、鏡の前でうまくいく髪を。',
  '一人ひとりの髪と向き合う、予約制のヘアサロンです。',
  '創業40年、地元の皆様に支えられてきました。',
  'カット 5,500円／カラー 8,800円（税込）',
  'ご予約はお電話またはフォームからお願いいたします。',
  '駅から徒歩3分、駐車場もございます。',
  '無添加の材料だけを使ったパンを焼いています。',
  'お子様連れでも安心してお越しいただけます。',
];

test('本番に入っていたひな形を、全部つかまえる', () => {
  const missed = REAL.filter(s => !isPlaceholderText(s));
  assert.deepEqual(missed, [], 'つかまえられていないひな形');
});

test('お店の人が書いた文は、弾かない', () => {
  const wrong = REAL_WRITING.filter(s => isPlaceholderText(s));
  assert.deepEqual(wrong, [], '本物の文を、ひな形と間違えている');
});

test('説明文に、ひな形を混ぜない', () => {
  // 本番で公開中のページと同じ並び
  const blocks = [
    { id: '1', type: 'heading', data: { text: 'メニュー・料金プラン' } },
    { id: '2', type: 'paragraph', data: { text: '紹介文を入力してください' } },
    { id: '3', type: 'paragraph', data: { text: '希望日時をお送りください。確認後にご連絡します。' } },
  ] as never;
  const desc = autoDescription(blocks, 'テスト店');
  assert.doesNotMatch(desc, /入力してください/, `説明文にひな形が入っている: ${desc}`);
  assert.match(desc, /希望日時をお送りください/, '本物の文まで落としている');
});

test('全部ひな形なら、無理に作らず当たり障りのない一文にする', () => {
  // ここで空文字を返すと、呼ぶ側が空のメタタグを出す。
  // 店名だけの一文のほうが、まだ読める。
  const blocks = [
    { id: '1', type: 'hero', data: { heading: 'ここに見出しを入力', subheading: 'サブタイトル・キャッチコピーを入力してください' } },
    { id: '2', type: 'two-col', data: { col1Text: '左側のコンテンツを入力してください。' } },
  ] as never;
  const desc = autoDescription(blocks, '結い庵');
  assert.equal(desc, '結い庵のホームページです。');
  assert.doesNotMatch(desc, /入力してください/);
});

test('公開前の確認と、説明文の判断が、同じ一覧を使う', () => {
  // 別々に持っていたから食い違った。書き写しが戻っていないこと。
  for (const path of ['lib/publish-readiness.ts', 'lib/auto-description.ts']) {
    const src = read(path);
    assert.match(src, /placeholder-text/, `${path} が共通の一覧を使っていない`);
    assert.doesNotMatch(src, /入力してください\|/, `${path} に一覧の書き写しがある`);
  }
});

test('公開前の確認が、ひな形の残りを見つける', () => {
  const items = checkPublishReadiness({
    name: 'テスト店',
    pages: [{ id: 'p', name: 'トップ', path: '/', blocks: [
      { id: '1', type: 'hero', data: { heading: 'ここに見出しを入力' } },
    ] }] as never,
  });
  const ids = blockingItems(items).map(i => i.id);
  assert.ok(ids.includes('placeholder'), `見つけられていない: ${ids.join(',')}`);
});

test('ちゃんと書いたサイトは、止めない', () => {
  const items = checkPublishReadiness({
    name: '結い庵',
    pages: [{ id: 'p', name: 'トップ', path: '/', blocks: [
      { id: '1', type: 'hero', data: { heading: '朝、鏡の前でうまくいく髪を。', bgImage: '/a.jpg' } },
      { id: '2', type: 'paragraph', data: { text: '一人ひとりの髪と向き合う、予約制のヘアサロンです。' } },
      { id: '3', type: 'contact', data: {} },
    ] }] as never,
    notifyEmail: 'owner@example.com',
  });
  assert.deepEqual(blockingItems(items).map(i => i.id), []);
});
