import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 新LP（/laruHP/lp-next）の約束事を固定する。
// 既存LPに影響を出さないこと、事実だけを書くこと、
// ファーストビューで「内容・価格・次にすること」が分かること。

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const page = read('app/lp-next/page.tsx');
const facts = read('lib/laruhp-facts.ts');
const factsStub = read('app/lp-next/facts.ts');
const oldLp = read('app/laruHP/page.tsx');
const layout = read('app/laruHP/layout.tsx');

test('プレビューは検索対象から外す', () => {
  assert.match(page, /robots: \{ index: false, follow: false/, 'noindexになっていない');
});

test('canonicalを本番LPに向けない', () => {
  // 実体は app/lp-next（ルートレイアウトのみ）に移したので、
  // laruHPレイアウトの canonical は継承しない。それでも明示しておく。
  assert.match(layout, /canonical: 'https:\/\/laruhp\.com\/'/, '正式LPは専用ドメインをcanonicalにする');
  assert.match(page, /canonical: 'https:\/\/laruvisona\.jp\/laruHP\/lp-next'/);
});

test('URLは /laruHP/lp-next のまま、実体はレイアウト配下の外に置く', () => {
  // app/laruHP/layout.tsx の force-dynamic は子ページの force-static で
  // 上書きできない（本番のレスポンスヘッダで確認済み）。
  // 配下48ページに影響する変更を避けるため、実体だけ外に出して rewrite で繋ぐ。
  const cfg = read('next.config.ts');
  assert.match(cfg, /async rewrites\(\)/, 'rewriteが無い');
  assert.match(cfg, /source: '\/laruHP\/lp-next', destination: '\/lp-next'/);
  // 実ルートが残っていると rewrite より優先されるので、page ファイルが無いことを見る。
  // （空ディレクトリは Next.js のルートにならず、git も追跡しないので対象外）
  const strays = ['page.tsx', 'page.ts', 'page.jsx', 'page.js']
    .filter((f) => fs.existsSync(path.join(root, 'app/laruHP/lp-next', f)));
  assert.deepEqual(strays, [],
    'laruHP配下に残っていると実ルートがrewriteより優先される');
  assert.ok(fs.existsSync(path.join(root, 'app/lp-next/page.tsx')));
  // ルートレイアウトが動的でないこと（ここが動的なら静的化できない）
  assert.equal(/export const dynamic/.test(read('app/layout.tsx')), false,
    'ルートレイアウトが動的になっている');
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
  const demo = read('app/lp-next/DemoVideo.tsx');
  assert.match(demo, /\{started \? \(/, '最初から<video>を描いている');
  assert.match(demo, /onClick=\{\(\) => setStarted\(true\)\}/);
  assert.match(demo, /controls/, '再生後に止められない');
});

test('システムフォントで組む', () => {
  assert.match(page, /font-system-jp/);
  const css = read('app/globals.css');
  assert.match(css, /\.font-system-jp/);
  assert.match(css, /\.font-system-jp[\s\S]{0,600}?system-ui/, 'クラスとして定義されていない');
  // globals.css の h1〜h4 への直接指定に負けないよう、見出しにも明示的に当てる。
  // これが無いと見出しだけ Web フォントのままになり、実測で11ファイル245KBが残った。
  assert.match(css, /\.font-system-jp :is\(h1, h2, h3, h4, h5, h6\)/,
    '見出しにシステムフォントが当たらない');
  // 新LPはブランド書体を読み込まない（読み込んでも使わないので転送量だけ増える）
  assert.equal(/BrandFonts/.test(page), false, '新LPが使わないWebフォントを読み込んでいる');
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
  // 数字の置き場は lib/laruhp-facts.ts の1か所だけ。
  // 案内ページ・料金ページ・このプレビューは、そこから読む。
  const src = facts;
  assert.match(src, /monthly: 999/);
  assert.match(src, /monthly: 4980/);
  assert.match(src, /monthly: 9800/);
  assert.match(src, /MONTHLY = \{ hp: 999, lite: 2980, hpBot: 4980, hpBotSeo: 9800, agency: 19800 \}/);
  assert.match(factsStub, /export \* from '@\/lib\/laruhp-facts'/, 'プレビューが自前の数字を持ち直している');
  assert.match(oldLp, /from '@\/lib\/laruhp-facts'/, '案内ページが一次情報から読んでいない');
  assert.match(read('app/laruHP/plans/page.tsx'), /from '@\/lib\/laruhp-facts'/, '料金ページが自前の数字を持っている');
  assert.match(src, /annualPerMonth: 833/);
  assert.match(src, /annualPerMonth: 4150/);
  assert.match(src, /annualPerMonth: 8166/);
  assert.match(src, /minimumMonths: 6/);
  assert.match(src, /税別/);
});

test('タップできるものは十分な大きさがある', () => {
  assert.match(page, /min-h-\[56px\]/);
  const faq = read('app/lp-next/Faq.tsx');
  assert.match(faq, /min-h-\[56px\]/);
  assert.match(page, /focus-visible:outline/);
  assert.match(faq, /focus-visible:outline/);
});

test('文字リンクも指で押せる大きさにする', () => {
  // 実測で、副CTA（高さ15px）とフッターの5リンク（高さ20px）が44px未満だった。
  // 下線つきの文字リンクでも、押す前提のものは高さを確保する。
  const links = page.match(/className="[^"]*underline[^"]*"/g) || [];
  const small = links.filter(l => !/min-h-\[44px\]/.test(l));
  assert.deepEqual(small, [], '44pxを確保していない文字リンクがある');
});

test('操作できる要素にはすべてフォーカス表示がある', () => {
  // キーボードで辿ったときに、いま自分がどこにいるか見えないと操作できない。
  // この環境では実際のTabキーがページに届かない（裏タブのため）ので、
  // ソース側で網羅を確かめる。
  const demo = read('app/lp-next/DemoVideo.tsx');
  const faq = read('app/lp-next/Faq.tsx');
  for (const [name, src] of [['page', page], ['Faq', faq], ['DemoVideo', demo]] as const) {
    const tags = (src.match(/<(?:Link|a|button|summary)\b/g) || []).length;
    const rings = (src.match(/focus-visible:outline\b/g) || []).length;
    assert.ok(tags === 0 || rings >= tags,
      `${name}: 操作できる要素 ${tags} 件に対し focus-visible の指定が ${rings} 件しかない`);
  }
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
