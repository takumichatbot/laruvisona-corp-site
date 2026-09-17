// ダッシュボードの初速と機能一覧に関する回帰テスト。
//
// 以前の問題:
//   - 21個の機能を1本の横スクロール帯に同じ見た目で並べていた。
//     何があるか分からず、スマホでは大半が画面外で存在に気づけない。
//   - ユーザー確認(getUser)の完了を待ってから4本の取得を始めていたため、
//     表示までに往復が2回ぶん直列に積まれ、その間ずっとスケルトンだった。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/laruHP/dashboard/DashboardClient.tsx', import.meta.url), 'utf8');

// 帯にあった21機能。1つでも欠けたら気づけるように列挙で固定する。
const FEATURES = [
  '/laruHP/contacts', '/laruHP/crm', '/laruHP/booking/schedule', '/laruHP/newsletter', '/laruHP/blog',
  '/laruHP/larubot-logs', '/laruHP/agency', '/laruHP/calendar', '/laruHP/payments', '/laruHP/popups',
  '/laruHP/loyalty', '/laruHP/studio', '/laruHP/shop', '/laruHP/orders', '/laruHP/members',
  '/laruHP/translate', '/laruHP/analytics', '/laruHP/sequences', '/laruHP/seo', '/laruHP/ab-test',
  '/laruHP/heatmap',
];

// 2026-09-17: 道しるべは lib/laruhp-nav.ts へ移した。
// それまでは DashboardClient の本文の中（サイト一覧の見出しと中身のあいだ）に
// 直接書かれていて、この画面にしか無かった。ほかの画面へ入ると消える。
// 正本が移ったので、見る先もそちらにする。
const nav = readFileSync(new URL('../lib/laruhp-nav.ts', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../components/laruhp/AppShell.tsx', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../app/laruHP/app-shell.css', import.meta.url), 'utf8');

test('機能が1つも欠けていない（21個すべて残っている）', () => {
  for (const href of FEATURES) {
    assert.ok(nav.includes(`'${href}'`), `${href} が道しるべから消えている`);
  }
});

test('仕事の流れで束ねてある（ただの一列ではない）', () => {
  for (const title of ['集客', '応対', '販売', '顧客', '分析・運営']) {
    assert.ok(nav.includes(`title: '${title}'`), `${title} のまとまりが無い`);
  }
  assert.ok(!src.includes('flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none'),
    '横スクロールの帯が残っている（スマホで大半が画面外になる）');
});

test('道しるべが、どの画面でも同じ場所にある', () => {
  // 骨組みが持つこと。画面ごとに書き足すと、また画面によって違う状態に戻る。
  assert.match(shell, /NAV_GROUPS\.map/);
  assert.match(shell, /NAV_PRIMARY\.map/);
  // 大きい画面では出したまま、小さい画面では引き出しにする
  assert.match(shellCss, /@media \(min-width: 1024px\)/);
  assert.match(shellCss, /\.shell-side \{ transform: translateX\(0\); \}/);
  assert.match(shell, /aria-label="メニューを開く"/);
  // いまどこにいるかが分かること
  assert.match(shell, /aria-current=\{current \? 'page' : undefined\}/);
});

test('指で押せる大きさがある', () => {
  // 骨組みの側で、リンクの高さを決める
  const link = shellCss.slice(shellCss.indexOf('.shell-nav-link {'));
  assert.match(link.slice(0, 400), /padding: 8px 10px/, 'タップ領域の指定が無い');
  assert.match(shellCss, /\.shell-menu \{[\s\S]*?width: 38px/, 'メニューのボタンが小さすぎる');
});

test('色を文字列連結で作らない（Tailwindが生成できない）', () => {
  // 道しるべの見た目はCSS変数で決める。クラス名を組み立てない。
  assert.ok(!/className=\{`[^`]*\$\{[^`]*accent/.test(shell),
    '組み立てたクラス名は生成されず、色が効かない');
  assert.match(shellCss, /--ac:\s+#/, '主色が変数になっていない');
});

test('データ取得はユーザー確認を待たずに始める', () => {
  const eff = src.slice(src.indexOf("const sitesP     = fetch('/api/sites')"), src.indexOf('const results = await Promise.allSettled'));
  assert.ok(eff.length > 0, '先行して投げる形になっていない');
  const fetchAt = src.indexOf("const sitesP     = fetch('/api/sites')");
  const authAt = src.indexOf('await supabase.auth.getUser()');
  assert.ok(fetchAt > 0 && fetchAt < authAt, '取得より先に getUser を待っている');
});

test('サイト一覧が来た時点で画面を出す（遅い取得を待たない）', () => {
  const early = src.indexOf('const sitesSettled = await Promise.allSettled([sitesP])');
  const all = src.indexOf('const results = await Promise.allSettled([sitesP, profileP');
  assert.ok(early > 0 && all > early, '全部揃うまで表示を待っている');
  const between = src.slice(early, all);
  assert.match(between, /setLoading\(false\)/, '一覧が来た時点で読み込み表示を解除していない');
});
