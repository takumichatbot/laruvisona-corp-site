import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

process.env.ANALYTICS_SIGNING_SECRET = 'test-secret-value-that-is-long-enough-32';

const {
  sitePasswordToken, sitePasswordCookieName, sitePasswordCookieValid,
  sitePasswordMatches, sitePasswordPageHtml,
} = await import('../lib/site-password.ts');

/**
 * 閲覧パスワードが、保護になっていなかった。
 *
 * 編集画面はこう書いている。
 *   「設定すると公開サイトにアクセス時にパスワードの入力が必要になります。」
 *
 * 実際にやっていたのは、ページを丸ごと配信したあとで、JSで白い覆いを
 * 被せるだけ。パスワードは公開HTMLに `var pw="..."` と**平文で入っていた。**
 * ソースを表示すれば読めるし、本文もそこに全部ある。
 *
 * ブラウザで開けば確かにパスワードを聞かれるので、見た目には効いている。
 * 「内覧用に身内だけへ」「開店前に取引先だけへ」で使う人にとっては、
 * 約束が守られていない。
 *
 * いまは配信の手前で止める。合っているときだけ本文を返す。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('合鍵に、パスワードそのものを入れない', () => {
  // cookie は端末に残る。パスワードを入れると、そこから読める。
  const token = sitePasswordToken('my-shop', 'himitsu123');
  assert.doesNotMatch(token, /himitsu/);
  assert.match(token, /^[a-f0-9]{64}$/);
});

test('パスワードを変えると、古い合鍵が効かなくなる', () => {
  // 「見せる相手を切りたい」からパスワードを変える。
  // 古い合鍵が生き続けると、変えた意味が無い。
  const old = sitePasswordToken('my-shop', 'old-pass');
  assert.equal(sitePasswordCookieValid('my-shop', 'old-pass', old), true);
  assert.equal(sitePasswordCookieValid('my-shop', 'new-pass', old), false);
});

test('別のサイトの合鍵では、入れない', () => {
  const token = sitePasswordToken('shop-a', 'same-pass');
  assert.equal(sitePasswordCookieValid('shop-b', 'same-pass', token), false);
  // cookie の名前もサイトごとに違う
  assert.notEqual(sitePasswordCookieName('shop-a'), sitePasswordCookieName('shop-b'));
  assert.match(sitePasswordCookieName('shop-a'), /^lhp_pw_[a-f0-9]{16}$/);
});

test('壊れた合鍵で通らない', () => {
  for (const bad of [undefined, '', 'x', 'himitsu123', 'z'.repeat(64), '../../etc']) {
    assert.equal(sitePasswordCookieValid('my-shop', 'himitsu123', bad), false, String(bad));
  }
});

test('打たれたパスワードを、正しく見分ける', () => {
  assert.equal(sitePasswordMatches('himitsu123', 'himitsu123'), true);
  for (const wrong of ['himitsu12', 'himitsu1234', 'HIMITSU123', '', 'x']) {
    assert.equal(sitePasswordMatches('himitsu123', wrong), false, wrong);
  }
});

test('入口の画面に、本文もパスワードも入れない', () => {
  // ここに何か混ぜると、止めた意味が無くなる。
  const html = sitePasswordPageHtml('結い庵');
  assert.doesNotMatch(html, /himitsu/);
  assert.match(html, /結い庵/);
  assert.match(html, /name="password"/);
  // 検索に載せない
  assert.match(html, /noindex,nofollow/);
  // 店名は必ず逃がす（屋号に < が入っていても壊れない・混ぜ込まれない）
  assert.match(sitePasswordPageHtml('<script>alert(1)</script>'), /&lt;script&gt;/);
  assert.doesNotMatch(sitePasswordPageHtml('<script>alert(1)</script>'), /<script>alert/);
});

test('公開HTMLに、パスワードを書き出さない', () => {
  // ここが元の漏れ。戻っていないこと。
  const exporter = read('lib/html-export.ts');
  assert.doesNotMatch(exporter, /var pw=\$\{/, 'パスワードを公開HTMLへ書いている');
  assert.doesNotMatch(exporter, /jsonForScript\(settings\.sitePassword\)/, 'パスワードを公開HTMLへ渡している');
  assert.match(exporter, /const pwScript = '';/, '覆いを被せる作りが残っている');
});

test('配信の手前で止めている', () => {
  // ページ側で出し分けると、ISR のキャッシュに最初の1回が載って全員に配られる。
  // 入口の画面が焼き付くか、もっと悪ければ本文が焼き付いて誰でも見られる。
  const proxy = read('proxy.ts');
  assert.match(proxy, /async function sitePasswordGate\(request: NextRequest, slug: string\)/);
  // 3つの入口すべて（標準URL直・サブドメイン・独自ドメイン）
  assert.equal((proxy.match(/await sitePasswordGate\(request,/g) || []).length, 3, '通していない入口がある');
});

test('サイトの下のパスも、まとめて止める', () => {
  // /post/x や /shop を開けておくと、そこから本文が読める。
  const proxy = read('proxy.ts');
  assert.match(proxy, /\^\\\/hp\\\/\(\[\^\/\]\+\)\(\?:\\\/\|\$\)/, '下のパスを拾えていない');
});

test('合鍵はページのJSから読めない形で渡す', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /httpOnly: true, sameSite: 'lax', secure: true/);
});

test('入口の画面も、間違いの画面も、キャッシュに残さない', () => {
  const proxy = read('proxy.ts');
  assert.match(proxy, /'Cache-Control': 'no-store, private'/);
  // 合っていないときは 401。200 で返すと検索や中継に拾われる
  assert.match(proxy, /status: 401/);
});

test('引けないときに、関係ないサイトまで閉じない', () => {
  // 照会に失敗したことを理由に、パスワードを設定していないお店のサイトを
  // 閉じてしまうほうが害が大きい。
  const proxy = read('proxy.ts');
  const at = proxy.indexOf('async function sitePasswordFor');
  const fn = proxy.slice(at, proxy.indexOf('async function sitePasswordGate'));
  assert.match(fn, /\} catch \{[\s\S]{0,200}return null;/);
});
