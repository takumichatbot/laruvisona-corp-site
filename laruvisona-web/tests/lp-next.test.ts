import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 新LP（/laruHP/lp-next）の約束事を固定する。
// 既存LPに影響を出さないこと、事実だけを書くこと、
// ファーストビューで「内容・価格・次にすること」が分かること。

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const page = read('app/laruHP/lp-next/page.tsx');
const facts = read('app/laruHP/lp-next/facts.ts');
const oldLp = read('app/laruHP/page.tsx');
const layout = read('app/laruHP/layout.tsx');

test('プレビューは検索対象から外す', () => {
  assert.match(page, /robots: \{ index: false, follow: false/, 'noindexになっていない');
});

test('canonicalを本番LPに向けない（親レイアウトの指定を必ず上書きする）', () => {
  assert.match(layout, /canonical: 'https:\/\/laruvisona\.jp\/laruHP'/, '前提が変わった');
  assert.match(page, /canonical: 'https:\/\/laruvisona\.jp\/laruHP\/lp-next'/);
});

test('既存LPのURL・canonical・メタデータに触っていない', () => {
  assert.match(oldLp, /export default function LaruHPLandingPage/);
  assert.equal(/lp-next/.test(oldLp), false, '既存LPが新LPを参照している');
});

test('ファーストビューに自動再生の背景動画も3Dも置かない', () => {
  const hero = page.slice(page.indexOf('ファーストビュー'), page.indexOf('3ステップ'));
  assert.equal(/autoPlay/.test(hero), false, 'ヒーローに自動再生動画がある');
  assert.equal(/Canvas|three|LaruHPScene/.test(hero), false, 'ヒーローに3Dがある');
});

test('動画は押されるまで読み込まない', () => {
  const demo = read('app/laruHP/lp-next/DemoVideo.tsx');
  assert.match(demo, /\{started \? \(/, '最初から<video>を描いている');
  assert.match(demo, /onClick=\{\(\) => setStarted\(true\)\}/);
  assert.match(demo, /controls/, '再生後に止められない');
});

test('システムフォントで組む', () => {
  assert.match(page, /font-system-jp/);
  const css = read('app/globals.css');
  assert.match(css, /\.font-system-jp/);
  // 既存の body には Noto Sans JP のグローバル指定がある（従来からのもの）。
  // 今回追加したシステムフォントは、それを書き換えずクラスとして足すこと。
  // グローバルに当てると既存の全ページの見た目が変わってしまう。
  const globalRules = css.split('.font-system-jp')[0];
  assert.equal(/system-ui/.test(globalRules), false,
    'システムフォントをグローバルに当てている（既存ページに影響する）');
  assert.match(css, /\.font-system-jp \{[\s\S]*?system-ui/, 'クラスとして定義されていない');
});

test('主CTAは目的が1つで、長いページに繰り返し置かれている', () => {
  assert.match(facts, /PRIMARY_CTA = \{[\s\S]*?href: '\/laruHP\/auth\/signup'/);
  const ids = [...page.matchAll(/id="(cta-[a-z]+)"/g)].map(m => m[1]);
  assert.ok(ids.length >= 4, `CTAの設置が${ids.length}箇所しかない`);
  assert.equal(new Set(ids).size, ids.length, 'CTAのidが重複している');
  const hrefs = [...page.matchAll(/href=\{PRIMARY_CTA\.href\}/g)];
  assert.ok(hrefs.length >= 2, '主CTAの行き先がバラバラになっている');
});

test('ファーストビューに 内容・価格・次の行動 がそろっている', () => {
  const hero = page.slice(page.indexOf('ファーストビュー'), page.indexOf('3ステップ'));
  assert.match(hero, /<h1/, '見出しが無い');
  assert.match(hero, /hp\.monthly/, '価格が無い');
  assert.match(hero, /<PrimaryCta id="cta-hero"/, '次の行動が無い');
  assert.match(hero, /TERMS\.firstMonthFree/, '契約条件が無い');
});

/** コードコメントを落として、利用者が実際に目にする文字列だけを見る */
function withoutComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // JSX内のコメント
    .replace(/\/\*[\s\S]*?\*\//g, '')        // ブロックコメント
    .replace(/^\s*\/\/.*$/gm, '');            // 行コメント
}

test('裏の取れていない実績や効果を書かない', () => {
  // 判定はコメントを除いた本文に対して行う。
  // 「こう書かない」という説明コメント自体が引っかかっては意味がない。
  const all = withoutComments(page) + withoutComments(facts);
  const banned = [
    /導入\s*[0-9,]+\s*[社店件]/,
    /満足度\s*[0-9]/,
    /[0-9]+\s*%\s*(アップ|向上|改善|増加)/,
    /[0-9,]+\s*(社|店舗|事業者)(が|に)?(導入|利用)/,
    /No\.?1|ナンバーワン|第1位/i,
    /売上が.*倍/,
    // 他の顧客の行動についての主張（人気・選択率）も、裏が取れないので書かない
    /よく選ばれ|人気No|一番選ばれ|最も選ばれ|利用者の[0-9]/,
  ];
  for (const re of banned) {
    assert.equal(re.test(all), false, `裏の取れていない主張がある: ${re}`);
  }
});

test('価格と契約条件が一次情報と一致している', () => {
  assert.match(oldLp, /price: 999/);
  assert.match(oldLp, /price: 4980/);
  assert.match(oldLp, /price: 9800/);
  assert.match(facts, /monthly: 999/);
  assert.match(facts, /monthly: 4980/);
  assert.match(facts, /monthly: 9800/);
  assert.match(oldLp, /hp: 833, 'hp-bot': 4150, 'hp-bot-seo': 8166/);
  assert.match(facts, /annualPerMonth: 833/);
  assert.match(facts, /annualPerMonth: 4150/);
  assert.match(facts, /annualPerMonth: 8166/);
  assert.match(facts, /minimumMonths: 6/);
  assert.match(facts, /税別/);
});

test('タップできるものは十分な大きさがある', () => {
  assert.match(page, /min-h-\[56px\]/);
  const faq = read('app/laruHP/lp-next/Faq.tsx');
  assert.match(faq, /min-h-\[56px\]/);
  assert.match(page, /focus-visible:outline/);
  assert.match(faq, /focus-visible:outline/);
});

test('ログイン状態や顧客データを読まない（静的に配れる）', () => {
  assert.match(page, /export const dynamic = 'force-static'/);
  for (const re of [/getUser|createClient|cookies\(\)|headers\(\)/]) {
    assert.equal(re.test(page + facts), false, `ページが要求時のデータを読んでいる: ${re}`);
  }
});

test('主CTAの行き先が実在するページである', () => {
  const m = facts.match(/href: '([^']+)'/);
  assert.ok(m, 'PRIMARY_CTA.href が読めない');
  const route = m![1].replace(/^\//, '');
  assert.ok(fs.existsSync(path.join(root, 'app', route, 'page.tsx')),
    `CTAの行き先 ${m![1]} にページが無い`);
});

test('作例は横スクロールできることが分かる', () => {
  assert.match(page, /snap-x/, 'スナップが無い');
  assert.match(page, /横にスクロール/, 'スクロールできることが書かれていない');
});

test('作例は「作例」と分かる形で出す', () => {
  assert.match(page, /AIが生成した作例/);
  assert.match(page, /のホームページの作例/);
});
