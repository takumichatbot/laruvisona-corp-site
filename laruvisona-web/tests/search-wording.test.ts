import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, getArticle } from '../app/laruHP/articles/articles-data';
import { LARUHP_ARTICLE_SLUGS } from '../lib/laruhp-public';

/**
 * 実際に検索された言い方と、それに答えるページを結びつけて固定する。
 *
 * Search Console（laruvisona.jp / 2026年6月16日〜9月14日）で分かったこと。
 *   クリック55・表示310・平均掲載順位6.1。出ていたクエリは8件だけで、
 *   そのうち商売に直結するのは次の4つだった。
 *
 *   | クエリ                               | 表示 | 掲載順位 | クリック |
 *   |--------------------------------------|------|----------|----------|
 *   | 工務店 ホームページ 見積り            |  3   |   13     |   0      |
 *   | リフォーム会社 ホームページ 月額料金  |  2   |   26     |   0      |
 *   | ホームページ作成 無料                 |  1   |   10     |   0      |
 *   | ホームページ作成ツール 比較           |  1   |    5     |   1      |
 *
 * 分かったのは「言い方がずれている」こと。
 *   ・見積りの記事は工務店を扱っているのに、題に「工務店」が無かった
 *   ・月額の記事の題は「月額制」で、探されている「月額料金」が入っていなかった
 *   ・「無料」は1ページ目（10位）まで来ているのに、答える記事が1本も無かった
 *
 * 書き換えた題が、あとで元に戻らないようにここで固定する。
 * **数字が古くなったら、このコメントごと新しい計測で置き換えること。**
 */

const titleOf = (slug: string) => getArticle(slug)!.title;
const textOf = (slug: string) => {
  const a = getArticle(slug)!;
  return `${a.title}\n${a.description}\n${a.body}`;
};

test('探されている言い方が、答えるページの題に入っている', () => {
  // 題に無い語は、検索結果でも太字にならず、押される理由にならない
  assert.match(titleOf('hp-mitsumori-mikata'), /工務店/);
  assert.match(titleOf('hp-mitsumori-mikata'), /見積り/);
  assert.match(titleOf('hp-getsugaku-ikkatsu'), /月額料金/);
  assert.match(titleOf('hp-muryou-de-tsukureru-ka'), /無料/);
  assert.match(titleOf('hp-tool-hikaku'), /ホームページ作成ツール/);
});

test('探されている業種の言い方が、本文にある', () => {
  assert.match(textOf('hp-getsugaku-ikkatsu'), /リフォーム会社/);
  assert.match(textOf('hp-mitsumori-mikata'), /工務店/);
});

test('「無料」に答える記事が、嘘をつかずに答えている', () => {
  const article = getArticle('hp-muryou-de-tsukureru-ka');
  assert.ok(article, '「ホームページ作成 無料」に答える記事が無い');
  assert.ok(LARUHP_ARTICLE_SLUGS.includes('hp-muryou-de-tsukureru-ka' as never), '公開パスに無い');

  // 「無料で作れる」を頭から否定すると、探している人の役に立たない
  assert.match(article.body, /無料で作れるのは、?本当/);
  // 自社が無料でないことを、ぼかさずに書く
  assert.match(article.body, /LARU HP に無料プランはありません/);
  // 他社の条件をこちらから断定しない（条件は各社で変わる）
  for (const claim of ['どのサービスも広告が出ます', '無料プランでは必ず', '他社では使えません']) {
    assert.ok(!article.body.includes(claim), `他社の条件を断定している: ${claim}`);
  }
  assert.match(article.body, /各社の(公式|料金)/, '最新は相手の公式で確かめてもらうこと');
});

test('題と説明文が、記事どうしで重なっていない', () => {
  // 言い方を寄せていくと、題が似てくる。似た題は共食いになる。
  const titles = ARTICLES.map(a => a.title);
  assert.equal(new Set(titles).size, titles.length);
  const descriptions = ARTICLES.map(a => a.description);
  assert.equal(new Set(descriptions).size, descriptions.length);
});
