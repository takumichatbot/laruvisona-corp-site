import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNewsPost } from '../lib/news-post-contract.ts';

test('記事は公開に必要な項目だけを整形する', () => {
  assert.deepEqual(parseNewsPost({
    title: '  お知らせ  ', content: ' 本文 ', category: '', image_url: '/images/post.webp',
    published: true, published_at: '2026-09-14T01:00:00+09:00',
  }, true), {
    title: 'お知らせ', content: '本文', category: null, image_url: '/images/post.webp',
    published: true, published_at: '2026-09-13T16:00:00.000Z',
  });
});

test('記事は任意列・危険な画像URL・過大な本文を拒否する', () => {
  assert.throws(() => parseNewsPost({ title: '題', site_id: 'other' }, true), /更新できない/);
  assert.throws(() => parseNewsPost({ image_url: 'javascript:alert(1)' }, false), /画像URL/);
  assert.throws(() => parseNewsPost({ content: 'a'.repeat(100_001) }, false), /本文/);
  assert.throws(() => parseNewsPost({}, false), /更新する内容/);
});

test('記事APIは本文上限とサイト公開状態を確認し削除0件を成功にしない', () => {
  const item = readFileSync(new URL('../app/api/posts/[postId]/route.ts', import.meta.url), 'utf8');
  const list = readFileSync(new URL('../app/api/sites/[id]/posts/route.ts', import.meta.url), 'utf8');
  assert.match(item, /readNewsPost\(req, false\)/);
  assert.match(item, /data\?\.length !== 1/);
  assert.doesNotMatch(item, /delete updates\.|req\.json\(\)|error: error\.message/);
  assert.match(list, /readNewsPost\(req, true\)/);
  assert.match(list, /eq\('published', true\)\.maybeSingle\(\)/);
});
