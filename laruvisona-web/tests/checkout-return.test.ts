import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 払ったあと、見たこともない画面に放り出されていた。
 *
 * 新しく登録した人が通るのは制作画面（studio）。ところが決済の戻り先は
 * **必ず builder（これまでの編集画面）** だった。別のUI、別の操作。
 * 払った直後にそれをやると、そこで手が止まる。
 *
 * さらに、料金ページは URL の siteId を**受け取っていなかった。**
 * 「公開する」から来た人のサイトの文脈がそこで消え、決済APIには何も渡らず、
 * 戻り先はダッシュボードになる。何を押せば公開できるのか分からない。
 *
 * そして戻ってきた瞬間、契約はまだ反映されていないことがある
 * （Stripeのwebhook待ち）。そこで「公開する」を押すと、また
 * 「プランが必要です」と出る。**払った直後にそれを見るのがいちばん悪い。**
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('戻り先を選べる。ただし決め打ちの2つだけ', () => {
  // 外から任意のURLを入れさせない（開いたリダイレクタになる）
  const src = read('app/api/stripe/checkout/route.ts');
  assert.match(src, /const returnTo = rawReturnTo === 'studio' \? 'studio' : 'builder';/,
    '戻り先を素通しで受けている、または選べない');
  assert.match(src, /\$\{origin\}\/laruHP\/studio\?siteId=\$\{ownedSiteId\}&step=edit&payment=success/,
    '制作画面へ戻せない');
  assert.match(src, /\$\{origin\}\/laruHP\/builder\?siteId=\$\{ownedSiteId\}&payment=success/,
    'これまでの戻り先を壊している');
});

test('料金ページが、サイトと戻り先を運ぶ', () => {
  const src = read('app/laruHP/plans/page.tsx');
  assert.match(src, /function handoffParams\(\)/, '受け取っていない');
  assert.match(src, /q\.get\('returnTo'\) === 'studio' \? 'studio' : ''/, '戻り先を素通ししている');
  assert.match(src, /body: JSON\.stringify\(\{ plan, billing, \.\.\.handoffParams\(\) \}\)/,
    '決済APIへ渡していない');
});

test('ログインを挟んでも、落とさない', () => {
  // 料金ページ → 登録/ログイン → 料金ページ → 決済、と回る道がある。
  const src = read('app/laruHP/plans/page.tsx');
  const backAt = src.indexOf('const back = `/laruHP/plans?checkout=');
  assert.ok(backAt > 0);
  assert.match(src.slice(backAt, backAt + 140), /handoffQuery\(\)/, 'ログイン往復で消える');
  const originAt = src.indexOf('const to = `${LARUHP_APP_ORIGIN}/laruHP/plans?checkout=');
  assert.ok(originAt > 0);
  assert.match(src.slice(originAt, originAt + 160), /handoffQuery\(\)/, '別オリジンへ渡すと消える');
});

test('制作画面から料金へ行くとき、戻り先を伝える', () => {
  const src = read('app/laruHP/studio/page.tsx');
  assert.match(src, /\/laruHP\/plans\$\{siteId \? `\?siteId=\$\{siteId\}&returnTo=studio` : ''\}/,
    '戻り先を伝えていない');
});

test('戻ってきた直後、契約が反映されるまで待つ', () => {
  /*
    webhook が届く前に「公開する」を押すと、払ったのに
    「プランが必要です」ともう一度言われる。
  */
  const src = read('app/laruHP/studio/page.tsx');
  assert.match(src, /if \(params\.get\('payment'\) !== 'success'\) return;/, '戻りを見ていない');
  assert.match(src, /hasServiceAccess\(data\.subscription_status\)/, '契約を確かめていない');
  assert.match(src, /setPlanNeeded\(false\);/, '払ったのに案内が残る');
  assert.match(src, /ご契約ありがとうございます。「公開する」を押すと公開できます。/);
  // いつまでも回さない
  assert.match(src, /if \(tries >= 10\)/, '終わりが無い');
  assert.match(src, /お支払いは受け付けました。反映まで少しかかることがあります。/,
    '待ちきれなかったときに黙っている');
});

test('画面を離れたら、見に行くのをやめる', () => {
  const src = read('app/laruHP/studio/page.tsx');
  const at = src.indexOf("if (params.get('payment') !== 'success') return;");
  const block = src.slice(at, at + 1400);
  assert.match(block, /let alive = true;/);
  assert.match(block, /return \(\) => \{ alive = false; \};/, '離れたあとも書き換えに行く');
});
