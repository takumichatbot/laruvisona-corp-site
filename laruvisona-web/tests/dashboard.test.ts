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
  '/laruHP/loyalty', '/laruHP/onboarding', '/laruHP/shop', '/laruHP/orders', '/laruHP/members',
  '/laruHP/translate', '/laruHP/analytics', '/laruHP/sequences', '/laruHP/seo', '/laruHP/ab-test',
  '/laruHP/heatmap',
];

const groups = src.slice(src.indexOf('const TOOL_GROUPS'), src.indexOf('const TOOL_ACCENT') >= 0 ? src.indexOf('export default function DashboardPage') : src.length);

test('機能が1つも欠けていない（21個すべて残っている）', () => {
  for (const href of FEATURES) {
    assert.ok(groups.includes(`'${href}'`), `${href} が一覧から消えている`);
  }
});

test('仕事の流れで束ねてある（ただの一列ではない）', () => {
  for (const title of ['集客', '応対', '販売', '顧客', '分析・運営']) {
    assert.ok(groups.includes(`title: '${title}'`), `${title} のまとまりが無い`);
  }
  assert.ok(!src.includes('flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none'),
    '横スクロールの帯が残っている（スマホで大半が画面外になる）');
});

test('スマホで全部が見える並びになっている', () => {
  assert.match(src, /grid-cols-1 sm:grid-cols-2 lg:grid-cols-5/, 'まとまりが縦積みにならない');
  assert.match(src, /grid-cols-2 lg:grid-cols-1/, 'スマホで2列に並ばない');
});

test('指で押せる大きさがある', () => {
  const link = src.slice(src.indexOf('TOOL_ACCENT[item.accent]'));
  assert.match(link.slice(0, 200), /min-h-\[44px\]/, 'タップ領域が44px未満');
});

test('色クラスを文字列連結で作らない（Tailwindが生成できない）', () => {
  const jsx = src.slice(src.indexOf('const TOOL_ACCENT'));
  assert.ok(!/className=\{`[^`]*hover:border-\$\{/.test(jsx),
    '組み立てたクラス名は生成されず、色が効かない');
  assert.match(src, /const TOOL_ACCENT: Record<string, string> = \{/);
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
