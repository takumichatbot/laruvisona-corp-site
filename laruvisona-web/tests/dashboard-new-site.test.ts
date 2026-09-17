import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * いちばん最初の操作で、つまずいていた。
 *
 * 「新しいサイト」を押しても、画面はすぐには変わらない。
 * POSTの往復があり、そのあとに制作画面への遷移がある。
 * その間ボタンは押せたまま、見た目も変わらない。
 * **何も起きていないように見えるので、もう一度押す。**
 *
 * 押した数だけ空のサイトが作られる。すると
 *   ・一覧に「新しいサイト」が並んで、どちらが自分のものか分からない
 *   ・プランのサイト上限を、中身の無いサイトが食う
 * という状態で、登録した直後の人がつまずく。
 *
 * ── 本番に残っていた跡 ──
 *
 * 10サイトのうち4つが中身ゼロで、名前はすべて「新しいサイト」。
 * うち2つは同じ利用者が 06-20 14:16:22 と 14:16:36、**14秒差**で作っている。
 * 連打ではなく、「反応が無いからもう一度押した」間隔。
 * その人は外部の利用者で、これ以降ログインしていない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const dash = () => read('app/laruHP/dashboard/DashboardClient.tsx');

test('作成中は、もう一度押せない', () => {
  const src = dash();
  assert.match(src, /if \(creatingSiteRef\.current\) return;/, '二度目をはじいていない');
  assert.match(src, /creatingSiteRef\.current = true;/);
  // 描画を待たずに止まること（state だけだと間に合わないことがある）
  const at = src.indexOf('const handleNewSite');
  const head = src.slice(at, at + 220);
  assert.ok(head.indexOf('creatingSiteRef.current') < head.indexOf('setCreatingSite'),
    'ref より先に state を見ている');
});

test('押せないことが、見て分かる', () => {
  // 押せなくしただけだと、今度は「壊れた」と思われる。作業中だと分かること。
  const src = dash();
  assert.ok((src.match(/disabled=\{creatingSite\}/g) || []).length >= 2,
    '作成ボタンのどれかが押せるままになっている');
  assert.ok((src.match(/creatingSite \? '作成中…'/g) || []).length >= 3,
    '押している間の表示が変わらない');
  assert.match(src, /aria-busy=\{creatingSite\}/, '読み上げに作業中が伝わらない');
});

test('画面が変わるときは、押せない状態のままにする', () => {
  /*
    成功したら制作画面へ移る。そこで押せる状態に戻すと、
    **遷移が終わるまでのわずかな間に、もう一度押せてしまう。**
    2つ目のサイトが作られるのは、まさにこの隙間。
  */
  const src = dash();
  const at = src.indexOf('if (data.site) {');
  // この分岐の中だけを見る（後ろの失敗の道まで含めると、そちらの done() を拾う）
  const block = src.slice(at, src.indexOf("if (data.code === 'site_limit')", at));
  assert.match(block, /router\.push\(`\/laruHP\/studio\?siteId=\$\{data\.site\.id\}`\);\s*return;/,
    '遷移したあとも処理が続いている');
  assert.doesNotMatch(block, /done\(\);/, '遷移する道で押せる状態に戻している');
});

test('失敗したときは、押せる状態に戻す', () => {
  // 戻し忘れると、一度失敗した人は二度と作れなくなる。
  const src = dash();
  const at = src.indexOf('const handleNewSite');
  const fn = src.slice(at, src.indexOf('const adminEmails'));
  assert.ok((fn.match(/done\(\);/g) || []).length >= 2,
    '失敗の道のどれかで戻していない（上限・エラー・通信失敗）');
  assert.match(fn, /const done = \(\) => \{ creatingSiteRef\.current = false; setCreatingSite\(false\); \};/);
});
