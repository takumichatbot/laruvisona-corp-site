// 公開HTMLの品質に関する回帰テスト。
// 見た目の良し悪しはテストできないが、「入れ忘れると素人臭くなる」
// 土台の指定と、体感速度・アクセシビリティに直結する指定は固定できる。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

process.env.NEXT_PUBLIC_APP_URL = 'https://laruvisona.jp';

const { exportToHTML, EXPORT_VERSION } = await import('../lib/html-export.ts');

const seo = { title: 'テスト院', description: '説明', keywords: '', ogTitle: '', ogDescription: '', ogImage: '' };
const settings = {
  colorScheme: 'blue', style: 'clean', designStyle: 'modern',
  larubot: false, laruseo: false,
  accentColor: '#0ea5e9', heroLayout: 'center' as const,
  headerStyle: 'transparent' as const, animLevel: 'full' as const,
};

function render(blocks: Array<{ id: string; type: string; data: Record<string, unknown> }>) {
  const page = { id: 'home', name: 'ホーム', path: '/', blocks: blocks as never, seo };
  return exportToHTML([page], seo, settings, 'テスト院');
}

const basic = render([
  { id: 'b1', type: 'hero', data: { heading: '見出し', subheading: 'サブ', ctaText: 'CTA', ctaLink: '#', bgColor: '#0f172a', textColor: '#fff' } },
]);

test('和文タイポグラフィの土台が入っている（palt・禁則・行の均し）', () => {
  assert.match(basic, /font-feature-settings:'palt' 1/, 'palt が無いと和文の字間が間延びして素人臭くなる');
  assert.match(basic, /text-wrap:balance/, '見出しの行の均しが無い');
  assert.match(basic, /line-break:strict/, '和文の禁則指定が無い');
});

test('キーボード操作のフォーカスが必ず見える', () => {
  assert.match(basic, /:focus-visible\{[^}]*outline:3px solid/, 'フォーカスリングが無い');
  // 入力欄は outline:none を当てているので、打ち消しが後ろに来ていること
  const noneAt = basic.indexOf('outline:none');
  const ringAt = basic.indexOf('focus-visible');
  assert.ok(noneAt === -1 || ringAt > noneAt, 'outline:none より後ろに focus-visible が無い');
});

test('動きを減らす設定を尊重し、その場合も内容は見える', () => {
  assert.match(basic, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(basic, /\[data-lhp-anim\]\{opacity:1!important;transform:none!important\}/,
    '動きを止めたときにスクロールアニメが透明のまま残る');
});

test('注意を引くアニメは永久ループしない（ホバー時のみ継続）', () => {
  assert.ok(!/animation:lhpPulse [^;}]*infinite\}/.test(basic) || /:hover\{animation:lhpPulse[^;}]*infinite/.test(basic),
    'CTA が常時点滅し続けている');
  assert.match(basic, /\.lhp-btn-primary\{animation:lhpPulse 2\.8s ease-in-out 3\}/);
});

test('常時動く背景装飾はスマホでは止める', () => {
  assert.match(basic, /body::before,body::after\{animation:none!important;display:none!important\}/);
});

test('先頭の画像は遅延読み込みにしない（LCPが遅れる）', () => {
  const html = render([
    { id: 'b1', type: 'hero', data: { heading: 'h', subheading: 's', ctaText: 'c', ctaLink: '#' } },
    { id: 'b2', type: 'team', data: { heading: 'スタッフ', items: [
      { name: 'A', role: '院長', photo: 'https://example.com/a.jpg', bio: '' },
      { name: 'B', role: 'スタッフ', photo: 'https://example.com/b.jpg', bio: '' },
    ] } },
  ]);
  const first = html.indexOf('https://example.com/a.jpg');
  const second = html.indexOf('https://example.com/b.jpg');
  assert.ok(first > 0 && second > first, 'テスト用の画像が出力されていない');
  const firstTag = html.slice(html.lastIndexOf('<img', first), first);
  const secondTag = html.slice(html.lastIndexOf('<img', second), second);
  assert.match(firstTag, /fetchpriority="high"/, '先頭画像に fetchpriority が無い');
  assert.ok(!/loading="lazy"/.test(firstTag), '先頭画像が遅延読み込みになっている');
  assert.match(secondTag, /loading="lazy"/, '2枚目以降が遅延読み込みになっていない');
});

test('最初の画面に写真があるとき、下の写真を優先して読み込まない', () => {
  // 最初の画面の写真は <picture> で出て、自分で loading と fetchpriority を書く。
  // 以前はそれを数え落とし、「loading未指定の1枚目」＝ページのずっと下にある
  // スタッフ写真に fetchpriority="high" を付けていた。
  const page = {
    id: 'home', name: 'ホーム', path: '/', seo,
    blocks: [
      { id: 'b1', type: 'hero', data: {
        heading: 'h', subheading: 's', ctaText: 'c', ctaLink: '#',
        bgImage: '/salon/hero-1600.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
      } },
      { id: 'b2', type: 'team', data: { heading: 'スタッフ', items: [
        { name: 'A', role: '院長', photo: 'https://example.com/a.jpg', bio: '' },
      ] } },
    ] as never,
  };
  // 最初の画面を写真つき（split）にすると、その <img> が自分で優先を書く
  const html = exportToHTML([page], seo, { ...settings, heroLayout: 'split' } as never, 'テスト院');
  const heroAt = html.indexOf('/salon/hero-1600.jpg');
  const staffAt = html.indexOf('https://example.com/a.jpg');
  assert.ok(heroAt > 0 && staffAt > heroAt, 'テスト用の画像が出力されていない');
  const staffTag = html.slice(html.lastIndexOf('<img', staffAt), staffAt);
  assert.ok(!/fetchpriority="high"/.test(staffTag), '下の写真が優先で読み込まれる');
  assert.match(staffTag, /loading="lazy"/, '下の写真があとで読む指定になっていない');
  // 最初の画面の写真のほうは、これまでどおり優先
  assert.equal((html.match(/fetchpriority="high"/g) || []).length, 1, '優先する画像が1枚ではない');
});

test('別のページのヒーローが、表示するページの優先度に混ざらない', () => {
  /* 複数ページの作品では、2ページ目以降は hidden で出る。
     以前は全ページを繋いだHTMLで「写真つきヒーローがあるか」を見ていたので、
     2ページ目にヒーローがあるだけで、1ページ目の先頭画像まで遅延扱いになった。
     判定はページごとに閉じる。 */
  const page1 = {
    id: 'p1', name: '1ページ目', path: '/', seo,
    blocks: [
      { id: 'a1', type: 'team', data: { heading: 'スタッフ', items: [
        { name: 'A', role: '院長', photo: '/first-visible.jpg', bio: '' },
      ] } },
    ] as never,
  };
  const page2 = {
    id: 'p2', name: '2ページ目', path: '/other', seo,
    blocks: [
      { id: 'b1', type: 'hero', data: {
        heading: 'h', subheading: 's', ctaText: 'c', ctaLink: '#',
        bgImage: '/other-hero.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
      } },
    ] as never,
  };
  const html = exportToHTML([page1, page2] as never, seo, { ...settings, heroLayout: 'split' } as never, 'テスト院');

  const tagFor = (src: string) => {
    const at = html.indexOf(src);
    assert.ok(at > 0, `${src} が出力されていない`);
    return html.slice(html.lastIndexOf('<img', at), at);
  };
  const first = tagFor('/first-visible.jpg');
  assert.match(first, /fetchpriority="high"/, '表示するページの先頭画像が優先されていない');
  assert.ok(!/loading="lazy"/.test(first), '表示するページの先頭画像が遅延読み込みになっている');

  // 隠れているページの画像に、こちらから優先を配らない
  //（写真つきヒーローが自分で書く分はそのまま。そこは別の話として残す）
  const hiddenTeam = exportToHTML(
    [page1, { ...page2, blocks: [
      { id: 'b2', type: 'team', data: { heading: 'スタッフ', items: [
        { name: 'B', role: 'スタッフ', photo: '/hidden-first.jpg', bio: '' },
      ] } },
    ] as never }] as never,
    seo, { ...settings, heroLayout: 'split' } as never, 'テスト院');
  const hidden = hiddenTeam.slice(hiddenTeam.lastIndexOf('<img', hiddenTeam.indexOf('/hidden-first.jpg')), hiddenTeam.indexOf('/hidden-first.jpg'));
  assert.match(hidden, /loading="lazy"/, '隠れているページの画像に優先が配られている');
  assert.equal((hiddenTeam.match(/fetchpriority="high"/g) || []).length, 1, '優先する画像が1枚ではない');
});


test('ヒーローの見出しは、書いた位置で折り返せる', () => {
  // 和文の見出しは語の途中でも折り返せてしまう。実測でも
  // 「朝、鏡の前でう / まくいく髪を。」と切れており、balance でも auto-phrase でも
  // 直らなかった。折り返す位置は書き手が決められるようにしてある。
  const h = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h1', type: 'hero', data: {
        heading: '朝、鏡の前で\nうまくいく髪を。', subheading: 'サブ', ctaText: 'CTA', ctaLink: '#',
        bgImage: '/salon/hero-1600.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
      } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  assert.match(h, /<h1>朝、鏡の前で<br>うまくいく髪を。<\/h1>/, '改行が <br> になっていない');
  // 代替テキストには改行を持ち込まない
  assert.match(h, /alt="朝、鏡の前で うまくいく髪を。"/, '画像の説明文に改行が混ざっている');
});

test('見出しに書かれたHTMLは、これまでどおり文字として出す', () => {
  const h = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h1', type: 'hero', data: { heading: '<img src=x onerror=alert(1)>危険', subheading: '', ctaText: '', ctaLink: '#' } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/<img src=x/.test(h), false, '見出しのHTMLがそのまま出ている');
  assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;危険/);
});


/* ── 生成された文字を、HTMLとして動かさない ───────────────────────────
   ブロックの中身にはAIの生成結果や他サイトからの取り込みも入る。
   公開ページでも編集画面でも、それらが札として動いてはいけない。 */

const NASTY = '<img src=x onerror=alert(1)>';

test('見出し・本文の記号は、どのブロックでも文字として出す', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'b1', type: 'hero', data: { heading: NASTY, subheading: NASTY, ctaText: NASTY, ctaLink: '#' } },
      { id: 'b2', type: 'paragraph', data: { text: NASTY, align: 'left' } },
      { id: 'b3', type: 'faq', data: { heading: NASTY, items: [{ q: NASTY, a: NASTY }] } },
      { id: 'b4', type: 'price-table', data: { heading: NASTY, plans: [
        { name: NASTY, price: '1,000', period: '円', description: NASTY, features: [NASTY], highlighted: false, buttonText: NASTY, buttonLink: '#' },
      ] } },
      { id: 'b5', type: 'team', data: { heading: NASTY, items: [{ name: NASTY, role: NASTY, bio: NASTY, photo: '' }] } },
      { id: 'b6', type: 'three-col', data: { col1Icon: NASTY, col1Title: NASTY, col1Text: NASTY } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/<img src=x onerror/.test(html), false, '生成テキストがHTMLとして出ている');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), '文字として出ていない');
});

test('リンクの欄に javascript: を入れても押せる形にしない', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'b1', type: 'hero', data: { heading: 'h', subheading: 's', ctaText: 'c', ctaLink: 'javascript:alert(1)' } },
      { id: 'b2', type: 'cta', data: { heading: 'h', buttonText: 'b', buttonLink: 'javascript:alert(1)' } },
      { id: 'b3', type: 'nav', data: { logo: 'L', links: [], showCta: true, ctaText: 'c', ctaLink: 'javascript:alert(1)' } },
      { id: 'b4', type: 'image', data: { src: 'javascript:alert(1)', alt: 'a' } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/javascript:/.test(html), false, 'javascript: のリンクが残っている');
});

test('色や高さの欄から、属性や別の宣言へ抜け出せない', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'b1', type: 'hero', data: { heading: 'h', subheading: 's', ctaText: 'c', ctaLink: '#', bgColor: '"><script>alert(1)</script><x y="' } },
      { id: 'b2', type: 'image', data: { src: '/a.jpg', alt: 'a', height: '1;background:url(javascript:alert(1))' } },
      { id: 'b3', type: 'map', data: { heading: 'm', embedUrl: 'javascript:alert(1)', height: 320 } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/<script>alert\(1\)<\/script>/.test(html), false, '属性から抜け出せている');
  assert.equal(/javascript:/.test(html), false);
});

test('カウントダウンの日付を、スクリプトの外へ出さない', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'b1', type: 'countdown', data: { heading: 'h', subtext: '', targetDate: '2026-01-01"));alert(1);//', bgColor: '#000', textColor: '#fff' } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  // 属性側はエスケープされている
  assert.match(html, /data-target="2026-01-01&quot;\)\);alert\(1\);\/\/"/);
  // スクリプト側は、引用符を閉じずに文字列のまま渡している
  const asString = 'new Date("2026-01-01\\"));alert(1);//")';
  assert.ok(html.includes(asString), '日付をスクリプトの文字列として渡していない');
});

test('送信後の転送先に、スクリプトを書けない', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'b1', type: 'contact', data: { heading: 'h', subtext: '', fields: ['name', 'email', 'message'], buttonText: 'send', redirectUrl: "javascript:alert(1)" } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/javascript:/.test(html), false);
});


test('動きのあるヒーローは、写真を先に出して動画をあとから重ねる', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: {
        heading: 'あ', subheading: '', ctaText: 'c', ctaLink: '#',
        bgImage: '/salon/hero-1600.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
        heroVideo: '/salon/hero.mp4', heroVideoWebm: '/salon/hero.webm',
      } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  // 写真は今までどおり最優先で読む
  assert.match(html, /<img class="lhp-hero-img" src="\/salon\/hero-1600\.jpg"[^>]*fetchpriority="high"/);
  // 動画はHTMLに置かない。読み込みで見出しやボタンを待たせないため
  assert.equal(/<video/.test(html), false, '動画をHTMLに直接置いている');
  assert.match(html, /data-lhp-hero-video data-src="\/salon\/hero\.mp4" data-src-webm="\/salon\/hero\.webm"/);
  // 止める手段がある
  assert.match(html, /class="lhp-hero-vbtn" data-lhp-vtoggle/);
  // 音は出さず、画面の中で再生する
  assert.match(html, /v\.muted=true; v\.defaultMuted=true; v\.loop=true; v\.playsInline=true;/);
  // 端末が「動きを減らす」設定のときは取りに行かない。
  // 作品側の「動き」の設定（スクロール演出の強弱）とは別に扱う。
  // 静かな作品でも、書き手が動く背景を置いたなら出す。
  assert.match(html, /if\(reduceDevice\|\|\(!mp4&&!webm\)\)return;/);
  assert.match(html, /var reduceDevice=!!\(window\.matchMedia&&window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
  // 出す合図は1つに絞らない（playing が遅れる端末で、止めるボタンだけ出ないのを防ぐ）
  assert.match(html, /v\.addEventListener\('loadeddata',show\);/);
  // 画面に入ってから読む
  assert.match(html, /new IntersectionObserver\([\s\S]{0,200}rootMargin:'200px'/);
});

test('動画を入れていないヒーローは、動画の仕掛けを持ち込まない', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: { heading: 'あ', subheading: '', ctaText: 'c', ctaLink: '#', bgImage: '/a.jpg' } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  assert.equal(/class="lhp-hero-media"/.test(html), false, '動画の入れ物が出ている');
});

test('写真の見せ場を、パソコンとスマホで別に決められる', () => {
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: {
        heading: 'あ', subheading: '', ctaText: 'c', ctaLink: '#',
        bgImage: '/a.jpg', bgImagePosition: '50% 30%', bgImagePositionSp: '40% 20%',
      } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  assert.match(html, /--lhp-hero-pos:50% 30%;/);
  assert.match(html, /--lhp-hero-pos-sp:40% 20%;/);
  assert.match(html, /@media\(max-width:768px\)\{\.lhp-hero-img\{object-position:var\(--lhp-hero-pos-sp,var\(--lhp-hero-pos,center\)\)\}\}/);
  // 設定していないサイトは、これまでどおり中央
  assert.match(html, /\.lhp-hero-img\{object-position:var\(--lhp-hero-pos,center\)\}/);
});


test('一括再生成は、範囲を絞れる（1件・件数・書かずに対象だけ）', () => {
  // 絞れないと、同じデータベースの他のサイトまで作り直してしまう。
  // 検証環境では、別の検証が使っている印が消えて原因の分からない失敗になり、
  // 本番では、1件直したいだけのときに全件へ触れることになる。
  const route = readFileSync(new URL('../app/api/admin/republish-all/route.ts', import.meta.url), 'utf8');
  assert.match(route, /onlyOutdated, slug, limit, dryRun/);
  assert.match(route, /if \(typeof slug === 'string' && slug\) query = query\.eq\('slug', slug\)/);
  assert.match(route, /if \(typeof limit === 'number' && limit > 0\) query = query\.limit\(/);
  assert.match(route, /if \(dryRun\) \{/);
});

test('起動しただけでは、顧客の公開HTMLを作り直さない', () => {
  // 作り直すとデータベースの published_html が上書きされる。生成物は行に残るので、
  // コードを戻しても表示は戻らない。自社ページだけ先に出したいときに、
  // デプロイした時点で全顧客の再生成が始まってしまうと、出す範囲を選べない。
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  const fn = server.slice(
    server.indexOf('async function triggerRepublishOutdated'),
    server.indexOf('setTimeout(triggerRepublishOutdated'),
  );
  assert.ok(fn.length > 0, 'triggerRepublishOutdated が見つからない');
  assert.match(fn, /REPUBLISH_ON_BOOT !== '1'/);
  assert.match(fn, /REPUBLISH_ON_BOOT !== '1'[\s\S]{0,240}return;/);
});

test('公開HTMLの控えを取って、書き戻せる道がある', () => {
  // 作り直しを戻す方法がこれしかない（EXPORT_VERSION を下げても、
  // すでに書かれた published_html は戻らない）。
  const route = readFileSync(new URL('../app/api/admin/published-html-backup/route.ts', import.meta.url), 'utf8');
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /published_html/);
});

test('全件の控えを、そのまま流し込めないようにしてある', () => {
  // 「全件の控えを取る → 一部だけ作り直す → 控えを全件POSTする」をやると、
  // 作り直していないサイトが、そのあと公開した内容まで巻き戻る。
  // 1件ごとに「いま置かれているはずの中身の指紋」を要求して、その道を塞ぐ。
  const route = readFileSync(new URL('../app/api/admin/published-html-backup/route.ts', import.meta.url), 'utf8');
  assert.match(route, /expected_sha256/);
  assert.match(route, /'needs_expected'/, '指紋が無い入力を断る道が無い');
  assert.match(route, /'conflict'/, 'そのあと公開し直された行を止める道が無い');
  assert.match(route, /'not_found'/, '消えた行を分ける道が無い');
});

test('更新できた行を数えてから、成功と言う（控えの書き戻し）', () => {
  // PostgREST は、条件に合う行が無くても error にならない。
  // error だけを見ると、存在しないIDでも「戻した」と数えてしまう。
  const route = readFileSync(new URL('../app/api/admin/published-html-backup/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.select\('id'\)/, '更新した行を取り直していない');
  assert.match(route, /updated\.length !== 1/, '更新0件を見分けていない');
});

test('更新できた行を数えてから、成功と言う（作り直し）', () => {
  const route = readFileSync(new URL('../app/api/admin/republish-all/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.eq\('updated_at', site\.updated_at\)/, '読んだときのままの行に限っていない');
  assert.match(route, /\.select\('id'\)/, '更新した行を取り直していない');
  assert.match(route, /updated\.length !== 1/, '更新0件を見分けていない');
});

test('作り直しは、その回を戻すための記録を返す', () => {
  // 戻す範囲を「この回が書いた分」に限るために要る。
  const route = readFileSync(new URL('../app/api/admin/republish-all/route.ts', import.meta.url), 'utf8');
  assert.match(route, /undo: \{/);
  assert.match(route, /expected_sha256: sha256\(html\)/, 'この回が書いた中身の指紋を残していない');
});

test('生成HTMLを変えたら EXPORT_VERSION を上げる（既存の公開HTMLが再生成される）', () => {
  assert.ok(EXPORT_VERSION >= 3, '公開HTMLを変更したのに EXPORT_VERSION が上がっていない');
  assert.match(basic, new RegExp(`<!--lhpv:${EXPORT_VERSION}-->$`), '版数の埋め込みが末尾に無い');
});

// ── 動きを切ったときに、内容が隠れないこと ──────────────
//
// 美容室の基準作品を組んでいて見つかった。
// 公開HTMLには表示アニメーションが2系統ある:
//   1. [data-lhp-anim] … 節ごと。animLevel を見ている（上のテストで固定済み）
//   2. .lhp-fade       … ギャラリーの写真・質問・料金表・カード。**見ていなかった**
// そのため animLevel:'none' を選んでも 2 は opacity:0 で始まり、
// スクロールするまで出てこなかった。印刷・スクリーンショット・
// スクロールしない閲覧では、最後まで空白のままになる。

function renderWithAnim(anim: 'none' | 'subtle' | 'full') {
  const blocks = [
    { id: 'b1', type: 'hero', data: { heading: '見出し', subheading: 'サブ', ctaText: 'CTA', ctaLink: '#', bgColor: '#0f172a', textColor: '#fff' } },
    { id: 'b2', type: 'gallery', data: { heading: 'スタイル', images: ['/a.jpg', '/b.jpg'], columns: '2' } },
    { id: 'b3', type: 'faq', data: { heading: 'よくある質問', items: [{ q: 'Q1', a: 'A1' }] } },
  ];
  const page = { id: 'home', name: 'ホーム', path: '/', blocks: blocks as never, seo };
  return exportToHTML([page], seo, { ...settings, animLevel: anim }, 'テスト院');
}

/** .lhp-fade を付ける処理の直前に、早期returnがあるか */
function fadeGuard(html: string): string {
  const i = html.indexOf("var els=document.querySelectorAll('.lhp-section-wrap");
  assert.ok(i > -1, '.lhp-fade を付ける処理が見つからない');
  return html.slice(Math.max(0, i - 800), i);
}

test('動く背景は、作品の「動き」の設定とは別に扱う', () => {
  // スクロールの演出を切っている作品でも、書き手が動く背景を置いたなら出す。
  // 逆に、端末が「動きを減らす」設定のときは、どちらであっても出さない。
  const html = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: {
        heading: 'あ', subheading: '', ctaText: 'c', ctaLink: '#',
        bgImage: '/salon/hero-1600.jpg', bgImageWidth: 1600, bgImageHeight: 1195,
        heroVideo: '/salon/hero.mp4',
      } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const, animLevel: 'none' as const }, 'テスト店',
  );
  // 動きなしでも、動く背景の仕掛けは入る
  assert.match(html, /data-lhp-hero-video data-src="\/salon\/hero\.mp4"/);
  // 判定に使うのは端末の設定だけ
  assert.match(html, /if\(reduceDevice\|\|\(!mp4&&!webm\)\)return;/);
  // スクロールの演出のほうは、これまでどおり止まる
  assert.match(html, /var reduce=animLevel==='none'\|\|reduceDevice;/);
});

test('動きなしを選んだら、料金の数字も動かさない', () => {
  // カウントアップは途中の数字を出す。13,200円 が一瞬 13,197円 に見えると
  // 値段を読み違える。動きなし・端末の「動きを減らす」設定では止める。
  const none = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'p1', type: 'price-table', data: { heading: '料金', plans: [
        { name: 'カラー＋カット', price: '13,200', period: '円', description: '', features: [], highlighted: true, buttonText: '予約', buttonLink: '#' },
      ] } },
    ] }] as never,
    seo, { ...settings, animLevel: 'none' as const }, 'テスト店',
  );
  assert.match(none, /var reduce=animLevel==='none'\|\|reduceDevice;/);
  assert.match(none, /var cio=!reduce&&new IntersectionObserver/, 'カウントアップが常に動く');
  assert.match(none, /if\(cio\)document\.querySelectorAll\('\.lhp-price-amount/);
});

test('打ち込み演出は、見出しの改行を壊さない', () => {
  const bold = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h1', type: 'hero', data: { heading: '朝、鏡の前で\nうまくいく髪を。', subheading: '', ctaText: '', ctaLink: '#' } },
    ] }] as never,
    seo, { ...settings, designStyle: 'bold' }, 'テスト店',
  );
  // 打ち直すと <br> が消えて1行に戻るので、改行のある見出しでは打たない
  assert.match(bold, /if\(h1&&!h1\.querySelector\('br'\)\)\{/);
  assert.match(bold, /if\(!reduce&&\(style==='bold'\|\|style==='sharp'\)\)\{/);
});

test('動きなしを選んだら、写真・質問・料金表も隠された状態から始まらない', () => {
  const html = renderWithAnim('none');
  assert.match(html, /\[data-lhp-anim\]\{opacity:1!important/);
  assert.match(fadeGuard(html), /if\('none'==='none'\)return;/,
    'animLevel を見ずに .lhp-fade を付けている（内容が空白のままになる）');
});

test('動きありのときは、これまでどおり順に出る', () => {
  for (const lv of ['subtle', 'full'] as const) {
    const html = renderWithAnim(lv);
    assert.equal(/if\('none'==='none'\)return;/.test(html), false, `${lv} で止めてしまっている`);
    assert.match(html, /IntersectionObserver/, `${lv} でスクロール連動が消えている`);
    assert.match(html, /lhp-fade\{opacity:0/, `${lv} で仕掛けが入っていない`);
  }
});

test('端末が「動きを減らす」設定なら、写真・質問も隠さない', () => {
  const guard = fadeGuard(renderWithAnim('full'));
  assert.match(guard, /prefers-reduced-motion: reduce/,
    '端末の設定を見ていない（動きを減らす設定の人に内容が出ない恐れ）');
  assert.match(guard.slice(guard.indexOf('prefers-reduced-motion')), /return/,
    '見ているだけで止めていない');
});

// ── シンプル予約フォーム ──────────────────────────────
//
// 監督レビュー(5348247)1: 入力に name が無いのに f.name.value を読んでいた。
// f.name は「フォーム自身の name 属性」を返すので、入力欄は取れない。
// f.email / f.phone に至っては undefined で、送信前に例外で落ちていた。

const booking = exportToHTML(
  [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
    { id: 'p1', type: 'price-table', data: { heading: '料金', plans: [
      { name: 'カラー＋カット', price: '13,200', period: '円〜', description: '', features: [], highlighted: true, buttonText: '予約', buttonLink: '#booking' },
    ] } },
    { id: 'bk', type: 'booking', data: {
      mode: 'simple', heading: 'ご予約', subtext: '',
      serviceTypes: ['カット', 'カラー＋カット'], timeSlots: ['10:00', '11:00'],
      buttonText: '申し込む', buttonColor: '#8a6a43', bgColor: '#fff',
      stickyCta: true, stickyCtaText: '予約する',
    } },
  ] }] as never,
  seo, settings, 'テスト店',
);

test('予約フォームの入力から、値が取れる形になっている', () => {
  // 値の取り出しはフォームのプロパティに頼らない
  assert.equal(/f\.name\.value|f\.email\.value|f\.phone\.value/.test(booking), false,
    'フォーム自身のプロパティから入力値を取ろうとしている（送信前に落ちる）');
  assert.match(booking, /function val\(k\)\{var el=f\.querySelector\('\[data-bk="'\+k\+'"\]'\)/);
  for (const k of ['service', 'date', 'time', 'name', 'phone', 'email']) {
    assert.match(booking, new RegExp(`data-bk="${k}"`), `入力の目印が無い: ${k}`);
  }
  // ラベルと入力がひも付いている
  for (const id of ['lhp-bkf-service', 'lhp-bkf-date', 'lhp-bkf-time']) {
    assert.match(booking, new RegExp(`for="${id}"`), `ラベルがひも付いていない: ${id}`);
    assert.match(booking, new RegExp(`id="${id}"`));
  }
  // 送信する中身
  assert.match(booking, /name:nm,email:em,phone:val\('phone'\)/);
});

test('予約の必須項目が、実APIの必須項目と揃っている', () => {
  // /api/contact は siteId・name・email が無いと 400 を返す。
  // 画面（ラベル）・入力制約（required）・送信前の確認を、そこに合わせる。
  assert.match(booking, /id="lhp-bkf-email"[^>]*required/, 'メール欄に required が無い');
  assert.match(booking, /id="lhp-bkf-name"[^>]*required/, 'お名前欄に required が無い');
  assert.match(booking, /<label class="lhp-form-label" for="lhp-bkf-email">メールアドレス<span class="lhp-req">必須<\/span>/);
  assert.match(booking, /<label class="lhp-form-label" for="lhp-bkf-name">お名前<span class="lhp-req">必須<\/span>/);
  // 任意の欄は、必須と見分けがつくこと
  assert.match(booking, /for="lhp-bkf-phone">電話番号<span class="lhp-opt">任意<\/span>/);
  // 送信前に自分でも確かめる（novalidate や自動入力の抜けで素通りしないように）
  assert.match(booking, /var nm=val\('name'\),em=val\('email'\);/);
  assert.match(booking, /if\(!nm\|\|!em\)\{/);
  assert.match(booking, /お名前とメールアドレスをご入力ください。/);
});

test('メニューと日時の区切りは、文字としての改行になる', () => {
  // 生成されたJSに出るのは \n（改行のエスケープ）。
  // \\n（バックスラッシュそのもの＋n）だと、受信側に「\n」という2文字が届く。
  assert.ok(booking.includes("+'\\n'+"), '区切りが改行のエスケープになっていない');
  assert.equal(booking.includes("+'\\\\n'+"), false, 'バックスラッシュがそのまま送られる形になっている');
});

const contactHtml = exportToHTML(
  [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
    { id: 'ct', type: 'contact', data: {
      heading: 'お問い合わせ', subtext: '', fields: ['name', 'email', 'phone', 'message'],
      buttonText: '送信する', buttonColor: '#2a2724', bgColor: '#fff',
    } },
  ] }] as never,
  seo, settings, 'テスト店',
);

test('お問い合わせフォームも、フォーム自身のプロパティから値を取らない', () => {
  // f.name はフォームの name 属性を返すので、入力値は取れない。
  // 予約フォームと同じ取り違えがこちらにも残っており、name が抜けたまま
  // 送られて /api/contact が 400「Missing required fields」を返していた。
  assert.equal(/f\.name\.value|f\.email\.value|f\.message\.value|f\.phone\?\.value/.test(contactHtml), false,
    'フォーム自身のプロパティから入力値を取ろうとしている');
  assert.match(contactHtml, /function cv\(k\)\{var el=f\.querySelector\('\[data-ct="'\+k\+'"\]'\)/);
  for (const k of ['name', 'email', 'phone', 'message']) {
    assert.match(contactHtml, new RegExp(`data-ct="${k}"`), `入力の目印が無い: ${k}`);
  }
  assert.match(contactHtml, /name:nm,email:em,phone:cv\('phone'\),message:ms/);
  // 必須の表示と、送信前の確認
  assert.match(contactHtml, /for="lhp-ctf-email">メールアドレス<span class="lhp-req">必須<\/span>/);
  assert.match(contactHtml, /for="lhp-ctf-phone">電話番号<span class="lhp-opt">任意<\/span>/);
  assert.match(contactHtml, /if\(!nm\|\|!em\|\|!ms\)\{/);
});

test('送信に失敗したら、押し直せる状態に戻る', () => {
  assert.match(booking, /btn\.textContent=label;btn\.disabled=false/);
  assert.match(booking, /もう一度お試しください/);
  // HTTPの失敗も成否に含める
  assert.match(booking, /if\(r\.ok&&d\.ok\)/, 'HTTPの失敗を成功として扱っている');
});

test('料金表で選んだメニューが、予約の欄に引き継がれる', () => {
  assert.match(booking, /data-lhp-menu="カラー＋カット"/, '料金表のボタンがメニュー名を持っていない');
  assert.match(booking, /function pickService\(label\)/);
  assert.match(booking, /sel\.options\[i\]\.text===label/, '選択肢の文言で突き合わせていない');
});

test('スマホの固定予約ボタンは、実際のリンクとして出る', () => {
  // CSSだけの飾りではなく、押せる要素があること
  assert.match(booking, /<div class="lhp-sticky-cta"[^>]*>\s*<a href="#booking" class="lhp-sticky-cta-btn"/);
  assert.match(booking, /予約する<\/a>/);
  assert.match(booking, /\.lhp-sticky-cta-btn\{[^}]*min-height:52px/, '指で押せる高さが無い');
  assert.match(booking, /env\(safe-area-inset-bottom\)/, 'ホームバーに重なる');
});

test('予約欄を見ている間は、固定予約ボタンを引っ込める', () => {
  // 同じ場所へ行くボタンが、フォームの送信ボタンに重なって押し間違えのもとになる
  assert.match(booking, /\.lhp-sticky-cta-off\{transform:translateY\(130%\);opacity:0;pointer-events:none\}/);
  assert.match(booking, /new IntersectionObserver\(function\(es\)\{\s*sticky\.classList\.toggle\('lhp-sticky-cta-off',es\[0\]\.isIntersecting\);/);
});

test('固定予約ボタンは、設定で出し入れできる', () => {
  const off = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'bk', type: 'booking', data: { mode: 'simple', heading: 'ご予約', subtext: '', serviceTypes: ['カット'], timeSlots: ['10:00'], buttonText: '申し込む', buttonColor: '#000', bgColor: '#fff' } },
    ] }] as never,
    seo, settings, 'テスト店',
  );
  assert.equal(/lhp-sticky-cta"/.test(off), false, '設定していないのに固定ボタンが出ている');
});

test('左右に分けるヒーローは、写真が主役になる幅を持つ', () => {
  // 内側の幅を広げないと、写真が42%＝約300pxにしかならず、
  // 1440pxの画面で切手のように小さく見えていた。
  const split = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: { heading: '店名', subheading: 'サブ', ctaText: '予約', ctaLink: '#booking', bgColor: '#2a2724', textColor: '#fff', bgImage: '/hero.jpg' } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, 'テスト店',
  );
  assert.match(split, /\.lhp-hero-split \.lhp-hero-inner\{[^}]*max-width:1180px/, '内側が広がっていない');
  assert.match(split, /\.lhp-hero-split-img\{flex:1 1 62%/, '写真の取り分が小さいまま');
  assert.match(split, /<div class="lhp-hero-split-img"><img class="lhp-hero-img" src="\/hero\.jpg"/);
});

// ── ヒーローの写真 ────────────────────────────────────
//
// 最初の画面に出る写真なので、遅延読み込みにしない・優先で取りに行く・
// 幅と高さを書いて読み込み前後で位置がずれないようにする。
// 形式と大きさの出し分けは <picture> で行う。

function renderHero(data: Record<string, unknown>) {
  return exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: { heading: '結い庵', subheading: 'サブ', ctaText: 'ご予約フォームへ', ctaLink: '#booking', bgColor: '#faf7f2', textColor: '#3a2e25', ...data } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const }, '結い庵',
  );
}

test('ヒーローの写真は遅延読み込みにせず、優先で取りに行く', () => {
  const h = renderHero({ bgImage: '/salon/hero.jpg' });
  assert.match(h, /loading="eager" fetchpriority="high" decoding="async"/);
  assert.equal(/loading="lazy"[^>]*lhp-hero/.test(h), false);
});

test('ヒーローの写真は寸法を書いて、読み込みで位置がずれないようにする', () => {
  const h = renderHero({ bgImage: '/salon/hero.jpg', bgImageWidth: 1600, bgImageHeight: 1200 });
  assert.match(h, /width="1600" height="1200"/);
});

test('形式と大きさの出し分けは picture で行う', () => {
  const h = renderHero({
    bgImage: '/salon/hero-1600.jpg',
    bgImageWidth: 1600, bgImageHeight: 1200,
    bgImageAlt: '自然光の入る店内。木の鏡台と椅子',
    bgImageSizes: '(max-width: 768px) 100vw, 62vw',
    bgImageSources: [
      { type: 'image/avif', srcset: '/salon/hero-800.avif 800w, /salon/hero-1600.avif 1600w' },
      { type: 'image/webp', srcset: '/salon/hero-800.webp 800w, /salon/hero-1600.webp 1600w' },
    ],
  });
  assert.match(h, /<picture><source type="image\/avif" srcset="[^"]*hero-1600\.avif 1600w" sizes="[^"]*">/);
  assert.match(h, /<source type="image\/webp"/);
  assert.match(h, /alt="自然光の入る店内。木の鏡台と椅子"/, '写真の説明が見出しの使い回しになっている');
  // 対応していないブラウザ向けに、元のjpgが最後に残る
  assert.match(h, /<img class="lhp-hero-img" src="\/salon\/hero-1600\.jpg"/);
});

test('スマホだけ別の切り取りを配れる', () => {
  const h = renderHero({
    bgImage: '/salon/hero-1600.jpg',
    bgImageSources: [{ type: 'image/webp', media: '(max-width: 768px)', srcset: '/salon/hero-sp-780.webp 780w' }],
  });
  assert.match(h, /media="\(max-width: 768px\)"/);
});

test('分割ヒーローは写真が主役、文字が脇（62% / 38%）', () => {
  const h = renderHero({ bgImage: '/salon/hero.jpg' });
  assert.match(h, /\.lhp-hero-split-img\{flex:1 1 62%/);
  assert.match(h, /\.lhp-hero-split \.lhp-hero-content\{flex:1 1 38%/);
  // スマホは縦に分ける。16:9だと椅子や鏡が切れる
  assert.match(h, /@media\(max-width:768px\)\{[^}]*flex-direction:column/);
  assert.match(h, /\.lhp-hero-split-img\{width:100%;flex:none;aspect-ratio:4\/3\}/);
});

test('写真が無いときは、これまでどおり空の枠になる', () => {
  const h = renderHero({});
  assert.match(h, /<div class="lhp-hero-split-img" style="background:rgba\(255,255,255,0\.12\)"><\/div>/);
  assert.equal(/<picture>/.test(h), false);
});

test('左右に分けるヒーローは、地色を暗く覆わない', () => {
  // 文字を写真に重ねるヒーローは読みやすさのために暗く落とす。
  // 分割ヒーローは文字が地色の上に乗るので、暗くすると
  // 明るい地色を選んでいても灰色に濁る。
  const split = exportToHTML(
    [{ id: 'home', name: 'ホーム', path: '/', seo, blocks: [
      { id: 'h', type: 'hero', data: { heading: '見出し', subheading: 'サブ', ctaText: '予約', ctaLink: '#booking', bgColor: '#faf7f2', textColor: '#3a2e25', bgImage: '/hero.jpg' } },
    ] }] as never,
    seo, { ...settings, heroLayout: 'split' as const, designStyle: 'elegant' }, 'テスト店',
  );
  assert.match(split, /\.lhp-hero:not\(\.lhp-hero-split\)::before\{[^}]*linear-gradient\(180deg,rgba\(0,0,0,\.3\)/);
  assert.equal(/[^)]\.lhp-hero::before\{content:'';position:absolute;inset:0;background:linear-gradient\(180deg,rgba\(0,0,0/.test(split), false,
    '分割ヒーローにも暗い覆いがかかっている');
});

test('Cookieの帯が出ている間も、固定予約ボタンが隠れない', () => {
  // どちらも画面下に固定で出る。帯のほうが手前（z-index 9999）なので、
  // 位置を動かさないと予約ボタンが帯の下に隠れて押せない。
  assert.match(booking, /\.lhp-sticky-cta\{[^}]*bottom:var\(--lhp-cookie-h,0px\)/,
    '固定予約ボタンが帯のぶん持ち上がらない');
  assert.match(booking, /shiftFixed\(b\.offsetHeight\)/, '帯の高さを測っていない');
  assert.match(booking, /function dismiss\(val\)\{[\s\S]{0,220}?shiftFixed\(0\)/,
    '帯を閉じたあとに位置が戻らない');
});

test('スマホの固定予約ボタンは、ビルダーの画面から切り替えられる', () => {
  // JSONに書けるだけでは、利用者は使えない。
  const builder = readFileSync(new URL('../app/laruHP/builder/page.tsx', import.meta.url), 'utf8');
  assert.match(builder, /id="bk-sticky-cta"[\s\S]{0,200}?checked=\{!!d\.stickyCta\}/,
    'ビルダーに切り替えが無い');
  assert.match(builder, /onDataChange\(block\.id, \{ \.\.\.d, stickyCta: e\.target\.checked \}\)/,
    '切り替えがブロックのデータに保存されない');
  assert.match(builder, /id="bk-sticky-cta-text"[\s\S]{0,220}?stickyCtaText: e\.target\.value/,
    '文言を変えられない');
});

// ── 共通の変更が、ほかのテンプレートを崩していないこと ──

test('どの業種テンプレートも、これまでどおり組み上がる', async () => {
  const { INDUSTRY_TEMPLATES } = await import('../lib/templates.ts');
  for (const [key, tpl] of Object.entries(INDUSTRY_TEMPLATES) as [string, { blocks: unknown[]; fontFamily: string; designStyle: string }][]) {
    const page = { id: 'home', name: 'ホーム', path: '/', blocks: tpl.blocks as never, seo };
    for (const heroLayout of ['center', 'left', 'split'] as const) {
      const html = exportToHTML([page] as never, seo,
        { ...settings, heroLayout, designStyle: tpl.designStyle, fontFamily: tpl.fontFamily } as never,
        `${key}テスト`);
      assert.ok(html.length > 3000, `${key}/${heroLayout}: 組み上がっていない`);
      assert.match(html, /<\/html>/, `${key}/${heroLayout}: HTMLが閉じていない`);
      // 文字を写真に重ねるヒーローでは、これまでどおり暗く落とす
      if (heroLayout !== 'split' && tpl.designStyle === 'elegant') {
        assert.match(html, /\.lhp-hero:not\(\.lhp-hero-split\)::before/, `${key}: 覆いが消えている`);
      }
      // 固定予約ボタンは、設定していないテンプレートには出ない
      assert.equal(/lhp-sticky-cta"/.test(html), false, `${key}/${heroLayout}: 設定していない固定ボタンが出ている`);
      // 写真無しのヒーローで <picture> を作らない
      assert.equal(/<picture><\/picture>/.test(html), false, `${key}/${heroLayout}: 空のpictureが出ている`);
    }
  }
});
