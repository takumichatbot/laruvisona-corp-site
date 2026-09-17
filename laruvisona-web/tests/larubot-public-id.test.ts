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

test('設置タグを出す側が、補い合う規則を通っている', () => {
  /*
    2026-09-17まで、設置タグは**2箇所から出ていた。**
      公開HTML（lib/html-export.ts が焼き込む）… 補い合う規則と入切を見る
      配信するページ（app/hp/[slug]）      … 生の laruseoPublicId だけ

    公開HTMLの中の script は配信時に本物へ作り直して実行されるので、
    **両方が動き、記事一覧が二重に描かれていた。**
    しかも判定が違うので、チャットの識別子しか入っていない人には
    ページ側から何も出ず、逆にLARUSEOを「切」にしても出続けた。

    配信するページ側に一本化した。あちらは保存されている値をそのつど
    読むので、識別子が入った次の表示から効く（公開し直す必要が無い）。
    この検査もそちらへ移す。
  */
  const page = code('app/hp/[slug]/page.tsx');
  assert.match(page, /chatPublicId\(settings\)/, '補い合う規則を使っていない');
  assert.match(page, /blogPublicId\(settings\)/, '補い合う規則を使っていない');
  assert.match(page, /settings\.laruseo === false \? '' :/, '入切を見ていない');

  // 公開HTML側からは出さない（出すと二重になる）
  const exporter = code('lib/html-export.ts');
  assert.match(exporter, /const laruSeoScript = '';/, '公開HTMLがまだ出している');
});

test('編集画面が、食い違いを黙って通さない', () => {
  const src = code('app/laruHP/builder/page.tsx');
  assert.match(src, /publicIdMismatch\(\{ larubotPublicId, laruseoPublicId \}\)/);
  assert.match(src, /このままだと記事が1件も出ません/);
  // 「別のID」という案内に戻さない
  assert.ok(!src.includes('LARUSEOダッシュボード → 設定 で確認'),
    '別のIDであるかのような案内が残っている');
});
