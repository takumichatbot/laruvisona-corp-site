import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 払う直前の一瞬に、機械向けの文字が出ていた。
 *
 * 公開に契約が要るのは正しい。止める場所も正しい
 * （app/api/sites/[id]/publish/route.ts）。問題は出し方だった。
 *
 * APIは2つ返している。
 *   error:   'subscription_required'  … 機械向けの合図
 *   message: 'サイトの公開には…'        … 人に見せる文
 *
 * 制作画面（studio）は **error のほうを画面に出していた。**
 * サイトを作り終えて「公開する」を押した人に、
 * `subscription_required` という英語の識別子が出ていた。
 *
 * しかもそこから先へ行く導線が無かった。
 * 編集画面（builder）と一覧（dashboard）にはプラン選択を出す作りがあるのに、
 * **いちばん新しい、新規の人がまず通る画面にだけ無かった。**
 *
 * 無料でサイトを作れるようにした以上（lib/site-creation-access.ts）、
 * ここが受注そのものになる。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('機械向けの合図を、画面に出さない', () => {
  const src = read('app/laruHP/studio/page.tsx');
  const at = src.indexOf('const res = await fetch(`/api/sites/${siteId}/publish`');
  assert.ok(at > 0);
  const block = src.slice(at, at + 900);
  // message を先に見ること
  assert.match(block, /\(b\.message as string\) \|\| \(b\.error as string\)/,
    'error を先に出している（生の識別子が画面に出る）');
});

test('契約が要るときは、そうと分かる文にする', () => {
  const src = read('app/laruHP/studio/page.tsx');
  assert.match(src, /if \(b\.error === 'subscription_required'\)/, '見分けていない');
  assert.match(src, /公開にはプランが必要です。作ったサイトはこのまま残ります。/,
    '作ったものが消えると思わせている');
});

test('その場に、次に押すものを置く', () => {
  // 行き止まりにしない。ここが受注の一歩手前。
  const src = read('app/laruHP/studio/page.tsx');
  assert.match(src, /planNeeded && \(/, '出す条件が無い');
  assert.match(src, /href=\{`\/laruHP\/plans\$\{siteId \? `\?siteId=\$\{siteId\}` : ''\}`\}/,
    'プランへの導線が無い、またはサイトを持って行っていない');
  assert.match(src, /プランを選んで公開する/);
});

test('押したあと、ボタンが戻る', () => {
  // 早期に return する道で戻し忘れると、以後ずっと「公開しています…」のまま固まる。
  const src = read('app/laruHP/studio/page.tsx');
  const at = src.indexOf("if (b.error === 'subscription_required')");
  const block = src.slice(at, at + 320);
  assert.match(block, /publishingRef\.current = false;/, '二重押しの錠が残る');
  assert.match(block, /setPublishing\(false\);/, 'ボタンが固まったままになる');
});

test('他の画面の作りを壊していない', () => {
  // builder と dashboard は元からプラン選択を出す。そこは触らない。
  const builder = read('app/laruHP/builder/page.tsx');
  const dash = read('app/laruHP/dashboard/DashboardClient.tsx');
  for (const [name, src] of [['builder', builder], ['dashboard', dash]] as const) {
    assert.match(src, /data\.error === 'subscription_required'/, `${name} の判定が消えている`);
    assert.match(src, /setShowPlanModal\(true\)/, `${name} のプラン選択が出なくなっている`);
  }
});

test('公開そのものは、契約が要るまま', () => {
  const route = fs.readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  assert.match(route, /!isAdmin && !hasServiceAccess\(profile\?\.subscription_status\)/,
    '契約なしで公開できるようになっている');
  assert.match(route, /error: 'subscription_required', message:/, '2つ返す形が崩れている');
});
