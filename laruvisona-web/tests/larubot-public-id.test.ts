import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { blogPublicId, chatPublicId, publicIdMismatch } from '../lib/larubot-public-id';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * LARUbot 側の回答（2026-09-17 ③⑪）:
 *   「laruseo_public_id は larubot_public_id と同じ値です。別の ID ではありません。」
 *
 * こちらは別の値として持ち、編集画面にも別々の入力欄を出していた。
 * 食い違うと、公開HTMLの設置タグに違う値が入り、**記事が0件になる**。
 * エラーは1つも出ないので、気づくのはサイトの持ち主だけで、こちらには何も届かない。
 */

test('片方しか無くても、設置タグが出る', () => {
  assert.equal(blogPublicId({ larubotPublicId: 'abc' }), 'abc', 'LARUSEO欄が空だと記事が出ない');
  assert.equal(chatPublicId({ laruseoPublicId: 'abc' }), 'abc');
  assert.equal(blogPublicId({ larubotPublicId: ' abc ' }), 'abc', '前後の空白で別物になる');
  assert.equal(blogPublicId({}), '');
});

test('両方あるときは、それぞれの値を尊重する', () => {
  assert.equal(blogPublicId({ larubotPublicId: 'a', laruseoPublicId: 'b' }), 'b');
  assert.equal(chatPublicId({ larubotPublicId: 'a', laruseoPublicId: 'b' }), 'a');
});

test('食い違いを見つけられる', () => {
  assert.equal(publicIdMismatch({ larubotPublicId: 'a', laruseoPublicId: 'b' }), true);
  assert.equal(publicIdMismatch({ larubotPublicId: 'a', laruseoPublicId: 'a' }), false);
  // 片方だけなら食い違いではない（もう片方は補われる）
  assert.equal(publicIdMismatch({ larubotPublicId: 'a' }), false);
  assert.equal(publicIdMismatch({ laruseoPublicId: 'b' }), false);
  assert.equal(publicIdMismatch({}), false);
});

test('公開HTMLが、補い合う側を通っている', () => {
  const src = code('lib/html-export.ts');
  assert.match(src, /blogPublicId\(settings\)/);
  assert.match(src, /chatPublicId\(settings\)/);
  // 直に読むのに戻っていないこと
  assert.ok(!src.includes('settings.laruseo && settings.laruseoPublicId'),
    'LARUSEO欄が空だと設置タグが出ない形に戻っている');
});

test('編集画面が、食い違いを黙って通さない', () => {
  const src = code('app/laruHP/builder/page.tsx');
  assert.match(src, /publicIdMismatch\(\{ larubotPublicId, laruseoPublicId \}\)/);
  assert.match(src, /このままだと記事が1件も出ません/);
  // 「別のID」という案内に戻さない
  assert.ok(!src.includes('LARUSEOダッシュボード → 設定 で確認'),
    '別のIDであるかのような案内が残っている');
});
