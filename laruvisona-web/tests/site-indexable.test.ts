import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * 「公開しているのに検索に出ない」を、誰にも気づかれないまま成立させない。
 *
 * 2026-09-17、本番で1件公開して見つけた。
 * 出てきたHTMLに robots の指定が**2つ**あり、しかも中身が逆だった。
 *
 *   <meta name="robots" content="noindex, nofollow">   ← Next 側
 *   <meta name="robots" content="index,follow">        ← 書き出したHTML側
 *
 * 検索側は厳しいほうを採る。つまり **検索に出ない。**
 * ところがソースを見ると index,follow も書いてあるので、見た人は
 * 「出るはずだ」と思う。
 *
 * 元をたどると `settings_json.noIndex` という欄で、
 *   ・読む所は4つあるのに、**書く所が1つも無い**
 *   ・型（SiteSettings）にも無い
 *   ・画面のどこにも出ていない
 * つまり一度 true になったら、誰にも直せず、誰にも見えない。
 * 集客のために払ってもらっているサービスで、これがいちばん困る壊れ方。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('書き出すHTMLの robots が、設定に従う', () => {
  const html = read('lib/html-export.ts');
  // 決め打ちに戻ると、Next 側の指定と食い違う。食い違えば厳しいほうが勝つ。
  assert.doesNotMatch(html, /content="index,follow"/, 'robots を決め打ちしている');
  assert.match(html, /settings\.noIndex \? 'noindex,nofollow' : 'index,follow'/);
});

test('robots の指定が、1つの設定から出ている', () => {
  // Next 側と書き出し側が、同じ `settings.noIndex` を見ていること。
  assert.match(read('app/hp/[slug]/page.tsx'), /settings\.noIndex/);
  assert.match(read('lib/html-export.ts'), /settings\.noIndex/);
  assert.match(read('app/hp/[slug]/robots.txt/route.ts'), /settings\.noIndex === true/);
});

test('設定が、型にある', () => {
  // 型に無い欄は、書く側が存在に気づけない。実際1つも書く所が無かった。
  assert.match(read('types/laruHP.ts'), /noIndex\?: boolean;/);
});

test('画面から変えられる', () => {
  const seo = read('app/laruHP/seo/page.tsx');
  assert.match(seo, /handleIndexable/);
  assert.match(seo, /settings_patch: \{ noIndex: !indexable \}/);
  assert.match(seo, /検索結果に出す/);
  // 押したまま固まらない
  assert.match(seo, /finally \{[\s\S]{0,120}setSavingIndexable\(false\)/);
});

test('公開中で検索に出ない組み合わせを、必ず知らせる', () => {
  // 画面には「公開中」としか出ないので、見つけてもらえていないことに
  // 持ち主が気づけない。カードで知らせる。
  const card = read('app/laruHP/dashboard/DashboardClient.tsx');
  assert.match(card, /site\.published && \(site\.settings_json as \{ noIndex\?: boolean \} \| null\)\?\.noIndex === true/);
  assert.match(card, /検索に出ない設定です/);
  assert.match(card, /laruHP\/seo\?siteId=/, '直せる場所へ連れて行く');
});
