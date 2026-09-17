import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LARUHP_PUBLIC_PATHS, LARUHP_VS_SLUGS, laruHpSitemapXml, internalLaruHpPath } from '../lib/laruhp-public';
import { ARTICLES } from '../app/laruHP/articles/articles-data';
import { INDUSTRIES } from '../lib/laruhp-facts';
import { TROUBLES } from '../lib/trouble-data';
import { FAQ_PAGES, FAQ_SLUGS } from '../lib/laruhp-faq';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/**
 * 「書いてあるのに、誰も辿り着けない」を防ぐ。
 * 2026-09-17 の点検で、比較ページ4本が noindex かつ sitemap 外かつ laruhp.com では404、
 * 記事11本と業種15本のあいだにリンクが1本も無い、という状態が見つかった。
 */

test('比較ページが、案内サイトから配信されて索引される', () => {
  for (const slug of LARUHP_VS_SLUGS) {
    assert.ok(LARUHP_PUBLIC_PATHS.includes(`/vs/${slug}`), `/vs/${slug} が公開パスに無い（laruhp.comでは404になる）`);
    assert.equal(internalLaruHpPath(`/vs/${slug}`), `/laruHP/vs/${slug}`);
    assert.ok(laruHpSitemapXml().includes(`https://laruhp.com/vs/${slug}`), 'sitemapに無い');
  }
  const page = code('app/laruHP/vs/[competitor]/page.tsx');
  assert.match(page, /robots: \{ index: true, follow: true \}/);
});

test('比較ページは、他社の機能や金額をこちらから断定しない', () => {
  const page = code('app/laruHP/vs/[competitor]/page.tsx');
  // 出典も日付も無い「◯◯にはこれが無い」は、比較広告として持たない
  const forbidden = ['AI機能が弱い', 'SEO機能なし', '日本語サポート弱い', 'デザインが古め', 'チャットボット非対応'];
  for (const word of forbidden) {
    assert.ok(!page.includes(word), `他社の欠点を断定している: ${word}`);
  }
  assert.match(page, /officialUrl/, '相手の最新は相手の公式ページで確かめてもらう');
});

test('sitemapに更新日が入っている', () => {
  const xml = laruHpSitemapXml('2026-09-17');
  assert.match(xml, /<lastmod>2026-09-17<\/lastmod>/);
});

test('記事と業種ページが、互いにつながっている', () => {
  const industryIds = new Set<string>(INDUSTRIES.map(i => i.id));
  let linked = 0;
  for (const article of ARTICLES) {
    for (const id of article.relatedIndustries ?? []) {
      assert.ok(industryIds.has(id), `${article.slug} の関連業種 ${id} が業種一覧に無い`);
      linked++;
    }
  }
  assert.ok(linked >= ARTICLES.length, 'ほとんどの記事に関連業種が付いていない');

  // どの業種ページからも、少なくとも1本の記事へ行けること
  for (const industry of INDUSTRIES) {
    const found = ARTICLES.some(a => a.relatedIndustries?.includes(industry.id));
    assert.ok(found, `${industry.id} の業種ページから読み物へ行けない`);
  }

  assert.match(code('app/laruHP/articles/[slug]/page.tsx'), /relatedIndustries/);
  assert.match(code('app/laruHP/[industry]/page.tsx'), /relatedArticles/);
});

test('読み物の出口が、申し込みだけになっていない', () => {
  for (const path of [
    'app/laruHP/articles/[slug]/page.tsx',
    'app/laruHP/[industry]/page.tsx',
    'app/laruHP/vs/[competitor]/page.tsx',
  ]) {
    const src = code(path);
    assert.match(src, /laruhp\.com\/contact/, `${path}: まだ決めていない人の行き先（相談）が無い`);
  }
});

test('困りごとページが、後半だけ行き止まりにならない', () => {
  const src = code('app/trouble/[slug]/page.tsx');
  // 先頭から3本を出すと、4本目以降にリンクが集まらない
  assert.doesNotMatch(src, /TROUBLES\.filter\(o => o\.slug !== t\.slug\)\.slice\(0, 3\)/);
  assert.match(src, /TROUBLES\[\(here \+ n\) % TROUBLES\.length\]/);
  assert.ok(TROUBLES.length > 3);
});

test('会社サイトの下層ページから、ほかのページへ行ける', () => {
  for (const path of [
    'app/services/page.tsx',
    'app/trouble/page.tsx',
    'app/trouble/[slug]/page.tsx',
    'app/local/page.tsx',
    'app/works/page.tsx',
    'app/works/[slug]/page.tsx',
  ]) {
    assert.match(code(path), /CompanyFooter/, `${path} に共通のフッターが無い`);
  }
});

test('問い合わせの受け口を1つにしない', () => {
  for (const path of ['app/contact/page.tsx', 'app/services/page.tsx']) {
    assert.match(code(path), /mailto:info@laruvisona\.jp/, `${path}: フォームが出ないときの宛先が無い`);
  }
});

test('中身が空のページを、sitemapに載せない', () => {
  const sitemap = code('app/sitemap.ts');
  // /blog は 2026-09-17 にサーバー側描画へ切り替えた（本文がこちらのHTMLに載る）。
  // それでも **記事が0件の日は載せない**。本文の無いページを
  // 「毎週更新」と宣言すると、サイト全体の評価が下がる。
  assert.match(sitemap, /\.\.\.\(articles\.length\s*$/m, '件数で囲わずに /blog を載せない');
  const guarded = sitemap.slice(sitemap.indexOf('...(articles.length'));
  assert.match(guarded.slice(0, guarded.indexOf(': []')), /\$\{base\}\/blog`/);
});

test('画面に出しているFAQを、構造化データでも同じ内容で出す', () => {
  const lp = code('app/laruHP/page.tsx');
  assert.match(lp, /FAQPage/);
  assert.match(lp, /\[\.\.\.HOW_FAQ, \.\.\.FACT_FAQ\.slice\(0, 3\)\]\.map\(f => \(\{/, '画面と別の配列からFAQを作ると、いつかズレる');
  const services = code('app/services/page.tsx');
  assert.match(services, /SERVICE_FAQ/);
  assert.match(services, /FAQPage/);
});

test('案内サイトの公開ページは、CDNに置いてよいと伝える', () => {
  const proxy = code('proxy.ts');
  // /laruHP 配下は force-dynamic のため既定で private,no-store。
  // 検索から人が来るページだけ、CDNに短く置けるようにする（個人のデータは含まない）。
  assert.match(proxy, /s-maxage=\d+/);
  assert.match(proxy, /stale-while-revalidate/);
  // 端末側には残さない
  assert.match(proxy, /max-age=0/);
});

test('登録なしで見られる見本が、配信・索引・回遊のすべてに乗っている', () => {
  // 2026-09-17: 15業種ぶんの見本は前から作ってあったのに、
  //   ・laruhp.com の公開パスに無い（404）
  //   ・/laruHP 配下の既定で noindex
  //   ・どのページからもリンクされていない
  // ので、誰の目にも触れていなかった。作ってあるものを見せていないのは、
  // 置いていないのと同じなので、ここで固定する。
  assert.ok(LARUHP_PUBLIC_PATHS.includes('/demo'), '/demo が公開パスに無い（laruhp.comでは404）');
  assert.equal(internalLaruHpPath('/demo'), '/laruHP/demo');
  assert.ok(laruHpSitemapXml().includes('https://laruhp.com/demo'), 'sitemapに無い');

  const page = code('app/laruHP/demo/page.tsx');
  assert.match(page, /robots: \{ index: true, follow: true \}/, '親レイアウトのnoindexを戻していない');
  assert.match(page, /canonical: URL/);

  // 入口が1本も無いと、検索にしか頼れない
  const linkers = [
    'components/laruhp/PublicFooter.tsx',
    'app/laruHP/page.tsx',
    'app/laruHP/[industry]/page.tsx',
  ];
  for (const file of linkers) {
    assert.match(code(file), /https:\/\/laruhp\.com\/demo/, `${file}: 見本への導線が無い`);
  }
});

test('見本のCTAが、案内サイト側で行き止まりにならない', () => {
  const client = code('app/laruHP/demo/demo-client.tsx');
  // laruhp.com では /laruHP/* は配信していない。相対パスのままだと 404 になる。
  assert.doesNotMatch(client, /href="\/laruHP\//, '相対の /laruHP/... は案内サイト側で404になる');
  assert.match(client, /LARUHP_APP_ORIGIN/, 'アプリ側へは絶対URLで送ること');
});

test('見本が、登録だけで作りはじめられるかのように書いていない', () => {
  const client = code('app/laruHP/demo/demo-client.tsx');
  // 制作スタジオは契約が無いと 403（app/laruHP/studio/page.tsx の no_plan）。
  // 「クレジットカード登録のみ」は、登録すれば作れるとも読めてしまう。
  assert.ok(!client.includes('クレジットカード登録のみ'), '登録だけで作れると読める');
  assert.ok(!client.includes('プロ品質'), '確かめようのない品質の断定');
  assert.match(client, /プランの申し込みが必要/);
});

test('質問ページが、1問1URLで配信・索引される', () => {
  // LPの折りたたみの中だけにあると、答えを1つ探している検索にも、
  // その質問へリンクを貼りたい人にも、返せるURLが無い。
  assert.ok(LARUHP_PUBLIC_PATHS.includes('/faq'), '/faq が公開パスに無い');
  for (const slug of FAQ_SLUGS) {
    assert.ok(LARUHP_PUBLIC_PATHS.includes(`/faq/${slug}`), `/faq/${slug} が公開パスに無い`);
    assert.equal(internalLaruHpPath(`/faq/${slug}`), `/laruHP/faq/${slug}`);
    assert.ok(laruHpSitemapXml().includes(`https://laruhp.com/faq/${slug}`), `/faq/${slug} が sitemap に無い`);
  }
  assert.match(code('app/laruHP/faq/page.tsx'), /robots: \{ index: true, follow: true \}/);
  assert.match(code('app/laruHP/faq/[slug]/page.tsx'), /robots: \{ index: true, follow: true \}/);
});

test('質問ページに、中身がある', () => {
  // 一行だけのページを量産すると、かえって評価を落とす。
  for (const page of FAQ_PAGES) {
    assert.ok(page.sections.length >= 3, `${page.slug}: 節が3つ未満`);
    const text = [page.short, ...page.sections.flatMap(s => s.body)].join('');
    assert.ok(text.length >= 400, `${page.slug}: 本文が短すぎる（${text.length}字）`);
    assert.ok(page.related.length >= 2, `${page.slug}: 次に行く先が無い`);
    for (const link of page.related) {
      assert.match(link.href, /^https:\/\/(laruhp\.com|laruvisona\.jp)\//, `${page.slug}: 相対パスは案内サイト側で404になる`);
    }
  }
});

test('質問の答えの金額が、料金定義から来ている', () => {
  // 手で書き写すと、値上げ・値下げのときに片方だけ古くなる。
  const src = code('lib/laruhp-faq.ts');
  assert.match(src, /from '\.\/laruhp-facts'/);
  // 主要な金額の直書きが無いこと
  for (const literal of ['999円', '9,990円', '19,800円']) {
    assert.ok(!src.includes(literal), `金額を直書きしている: ${literal}`);
  }
});

test('質問ページへの入口がある', () => {
  for (const file of ['components/laruhp/PublicFooter.tsx', 'app/laruHP/page.tsx']) {
    assert.match(code(file), /https:\/\/laruhp\.com\/faq/, `${file}: 質問ページへの導線が無い`);
  }
});

test('会社サイトから、月額のサービスへ出口がある', () => {
  // 受託を探して来た人のうち、規模が合わない相手をそのまま帰していた。
  assert.match(code('components/company/CompanyFooter.tsx'), /laruhp\.com\/\?ref=corp/);
  const trouble = code('app/trouble/[slug]/page.tsx');
  assert.match(trouble, /REBUILD_FITS/);
  assert.match(trouble, /laruhp\.com\/\?ref=trouble/);
  // 症状と関係のないページに出すと邪魔になるので、当てはまるものだけ
  assert.match(trouble, /REBUILD_FITS\.has\(t\.slug\)/);
});

test('料金の見積りが、配信・索引・回遊に乗っている', () => {
  assert.ok(LARUHP_PUBLIC_PATHS.includes('/simulator'), '/simulator が公開パスに無い');
  assert.equal(internalLaruHpPath('/simulator'), '/laruHP/simulator');
  assert.ok(laruHpSitemapXml().includes('https://laruhp.com/simulator'), 'sitemapに無い');
  assert.match(code('app/laruHP/simulator/page.tsx'), /robots: \{ index: true, follow: true \}/);
  for (const file of [
    'components/laruhp/PublicFooter.tsx',
    'app/laruHP/page.tsx',
    'app/laruHP/plans/page.tsx',
  ]) {
    assert.match(code(file), /https:\/\/laruhp\.com\/simulator/, `${file}: 見積りへの導線が無い`);
  }
});
