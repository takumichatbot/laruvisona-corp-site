import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLES, getArticle } from '../app/laruHP/articles/articles-data.ts';
import { LARUHP_ARTICLE_SLUGS, LARUHP_PUBLIC_PATHS } from '../lib/laruhp-public.ts';

test('記事と、公開するslugの一覧が一致している', () => {
  // 書いたのに公開パスへ足し忘れると、404になり sitemap にも出ない。
  const written = ARTICLES.map(a => a.slug).sort();
  const published = [...LARUHP_ARTICLE_SLUGS].sort();
  assert.deepEqual(published, written);
  for (const slug of written) {
    assert.ok(LARUHP_PUBLIC_PATHS.includes(`/articles/${slug}`), `/articles/${slug} が公開パスに無い`);
    assert.ok(getArticle(slug), `${slug} が引けない`);
  }
});

test('記事の体裁がそろっている', () => {
  for (const a of ARTICLES) {
    assert.ok(a.title.length >= 10, a.slug);
    assert.ok(a.description.length >= 30, `${a.slug}: 説明文が短い`);
    // 薄い記事は、検索側から見ても読む側から見ても価値が無い。全記事この線を守る。
    assert.ok(a.body.trim().length >= 1000, `${a.slug}: 本文が ${a.body.trim().length} 字`);
    assert.match(a.body, /^\s*##\s/m, `${a.slug}: 見出しが無い`);
    assert.match(a.publishedAt, /^\d{4}-\d{2}-\d{2}$/, a.slug);
  }
});

test('タイトルと説明文が、記事どうしで重複していない', () => {
  const titles = ARTICLES.map(a => a.title);
  assert.equal(new Set(titles).size, titles.length);
  const descs = ARTICLES.map(a => a.description);
  assert.equal(new Set(descs).size, descs.length);
});

test('料金を書いた記事は、条件が変わりうることを断っている', () => {
  // 記事の金額は古くなる。断りが無いまま数字だけ残るのがいちばん悪い。
  for (const a of ARTICLES) {
    // 一般論としての「月額」ではなく、LARU HP の具体的な金額を書いた記事だけ。
    if (!/(999|2,980|4,980|9,800|19,800)円/.test(a.body)) continue;
    assert.match(a.body, /(条件は変わ|変更される場合|ご確認ください)/, `${a.slug}: 料金の断りが無い`);
  }
});
