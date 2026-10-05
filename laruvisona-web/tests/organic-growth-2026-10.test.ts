import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARTICLES, getArticle, relatedArticlesFor } from '../app/laruHP/articles/articles-data';
import { MONTHLY } from '../lib/laruhp-facts';

/**
 * 2026-10-06 Organic Growth（docs/growth/2026-10-06-organic-growth-baseline.md）で決めた割り当てを固定する。
 * 数字が古くなったら、ドキュメントの再計測で置き換えること。
 */
const read = (p: string) => readFileSync(p, 'utf8');

test('業種ページの読み物：業種別ガイドが先。工務店には工務店向けの4本が出る', () => {
  const c = relatedArticlesFor('construction').map(a => a.slug);
  assert.equal(c.length, 4);
  for (const slug of ['koumuten-sekou-jirei-kakikata', 'koumuten-hp-jisaku-dekiru-ka', 'koumuten-hp-mitsumori-mae-ni-kimeru', 'reform-hp-toiawase-konai']) {
    assert.ok(c.includes(slug), `${slug} が工務店ページに出ていない`);
  }
  // 業種別ガイドが 3 本以下の業種は、これまでどおり 3 本まで（業種を問わない記事で補う）
  for (const id of ['beauty', 'clinic', 'restaurant', 'legal']) {
    const list = relatedArticlesFor(id);
    assert.ok(list.length <= 3 && list.length >= 1, id);
    assert.ok(list.every(a => a.relatedIndustries?.includes(id)), id);
    const firstGeneric = list.findIndex(a => a.category !== '業種別ガイド');
    assert.ok(firstGeneric === -1 || list.slice(firstGeneric).every(a => a.category !== '業種別ガイド'), `${id}: 業種別ガイドが後ろに回っている`);
  }
  assert.ok(relatedArticlesFor('beauty').some(a => a.slug === 'biyoushitsu-hp-jibun-de-tsukuru'));
  assert.ok(relatedArticlesFor('clinic').some(a => a.slug === 'seitai-chiryouin-hp-hyougen'));
  const page = read('app/laruHP/[industry]/page.tsx');
  assert.match(page, /relatedArticlesFor\(industry\)/);
  assert.match(page, /relatedArticles\.length >= 4 \? 'md:grid-cols-2' : 'md:grid-cols-3'/);
});

test('見積りの記事：題に「工務店」「見積り」「見積書」。見積り前の準備・費用の内訳・料金へ送る（相互リンク）', () => {
  const a = getArticle('hp-mitsumori-mikata')!;
  assert.match(a.title, /工務店/);
  assert.match(a.title, /見積り/);
  assert.match(a.title, /見積書/);
  assert.match(a.body, /\]\(\/articles\/koumuten-hp-mitsumori-mae-ni-kimeru\)/);
  assert.match(a.body, /\]\(\/articles\/hp-sakusei-cost\)/);
  assert.match(a.body, /\]\(https:\/\/laruhp\.com\/plans\)/);
  assert.match(a.body, /\]\(https:\/\/laruhp\.com\/simulator\)/);
  // 逆向き：見積り前の記事から見積書の見方へ
  assert.match(getArticle('koumuten-hp-mitsumori-mae-ni-kimeru')!.body, /\]\(\/articles\/hp-mitsumori-mikata\)/);
  // 共食い防止：見積り前の記事は題に「見積書」を持たない（役割を分ける）
  assert.doesNotMatch(getArticle('koumuten-hp-mitsumori-mae-ni-kimeru')!.title, /見積書/);
  const titles = ARTICLES.map(x => x.title);
  assert.equal(new Set(titles).size, titles.length);
});

test('laruhp.com：トップの題に「ホームページ作成」とブランドの一文。料金は facts から。プランへのリンクは laruhp.com を直接', () => {
  const top = read('app/laruHP/page.tsx');
  assert.match(top, /title: 'ホームページ作成 LARU HP｜その仕事に、ふさわしいホームページを。'/);
  assert.match(top, /PLANS\[0\]\.monthly\.toLocaleString\('ja-JP'\)\}円（税別）から、\$\{TERMS\.firstMonthFree\}/);
  assert.ok(!top.includes('https://laruvisona.jp/laruHP/plans'), '308 する旧 URL へのリンクが残っている');
  const plans = read('app/laruHP/plans/layout.tsx');
  assert.match(plans, /title: `料金プラン｜ホームページ作成 月額\$\{MONTHLY\.hp\.toLocaleString\('ja-JP'\)\}円〜・初月無料 \| LARU HP`/);
  assert.equal(MONTHLY.hp, 1980, '料金は変えていない');
});

test('laruvisona.jp/services：題に頼める内容。自社サービスで済む相談は専用ページへ（同じ説明を複製しない）', () => {
  const s = read('app/services/page.tsx');
  assert.match(s, /title: '受託開発サービスと料金｜ホームページ制作・システム修理・業務システム \| 株式会社LaruVisona'/);
  for (const href of ['https://larubot.tokyo', 'https://larubot.tokyo/laru-call', 'https://laruhp.com/', 'https://larubot.tokyo/laru-seo']) {
    assert.ok(s.includes(`href: '${href}'`), `${href} への行き先が無い`);
  }
  // 狙わないと決めたビッグワードを題・説明に入れていない
  const meta = s.slice(s.indexOf('export const metadata'), s.indexOf('};', s.indexOf('export const metadata')));
  for (const w of ['AI開発会社', 'DX支援', 'AI導入支援']) assert.ok(!meta.includes(w), w);
  // H1（ブランドの一文）は変えていない
  assert.match(s, /つくって、売って、<span[^>]*>運用している。<\/span>/);
});
