import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * ログイン・登録まわりの検査。
 *
 * ここは「買う前の最後の画面」で、詰まったら人はそのまま帰る。
 * しかも詰まったことがこちらに1つも届かない。だから、
 * 過去に直した欠けが戻っていないかを、ここで止める。
 */

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * 注釈を落としたコード。
 * 「以前はこう書いてあった」と注釈に残すと、その文字列を探す検査に引っかかる。
 * 直した経緯は残したいので、探すほうを注釈の外だけにする。
 */
const code = (path: string) => read(path)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

const SCREENS = [
  'app/laruHP/auth/login/LoginClient.tsx',
  'app/laruHP/auth/signup/SignupClient.tsx',
  'app/laruHP/auth/reset-password/page.tsx',
  'app/laruHP/auth/update-password/page.tsx',
];

test('入力欄は AuthField だけを通す', () => {
  // 画面ごとに input を書くと、autoComplete や文字サイズを1つずつ書き忘れる。
  // 実際、4画面とも autoComplete が無かった。
  for (const path of SCREENS) {
    const code = read(path);
    assert.doesNotMatch(code, /<input\b/, `${path} が input を直接書いている`);
    assert.match(code, /AuthField/, `${path} が AuthField を使っていない`);
  }
});

test('パスワード管理ソフトが欄を見つけられる', () => {
  // これが無いと、保存した鍵が自動で入らない。ここで諦める人がいちばん多い。
  const login = read('app/laruHP/auth/login/LoginClient.tsx');
  assert.match(login, /autoComplete="username"/);
  assert.match(login, /autoComplete="current-password"/);

  const signup = read('app/laruHP/auth/signup/SignupClient.tsx');
  assert.match(signup, /autoComplete="organization"/);
  assert.match(signup, /autoComplete="username"/);
  assert.match(signup, /autoComplete="new-password"/);

  assert.match(read('app/laruHP/auth/update-password/page.tsx'), /autoComplete="new-password"/);

  // AuthField 側で必須にしてある。省略できる形に戻したら、ここで止める。
  const parts = read('components/laruhp/auth-parts.tsx');
  assert.match(parts, /autoComplete: string;/, 'autoComplete を任意にしない');
});

test('押したまま戻らないボタンを作らない', () => {
  // await のあとで待ちを解いていると、途中で投げた日にボタンが「処理中」で固まる。
  for (const path of SCREENS) {
    const code = read(path);
    const awaits = (code.match(/await /g) || []).length;
    if (awaits === 0) continue;
    assert.match(code, /try \{/, `${path} が await を try で囲っていない`);
    assert.match(code, /catch \{|catch \(/, `${path} に catch が無い`);
  }
});

test('伏せ字は外せる', () => {
  const parts = read('components/laruhp/auth-parts.tsx');
  assert.match(parts, /auth-peek/);
  assert.match(parts, /aria-label=\{peek \?/, '切り替えの状態を読み上げにも伝える');
});

test('待っているあいだは、押せないし、押せないと分かる', () => {
  const parts = read('components/laruhp/auth-parts.tsx');
  assert.match(parts, /disabled=\{busy/);
  assert.match(parts, /auth-spin/, '押した直後に「効いた」と見えるもの');
  // Google は押してから画面が変わるまで数秒ある。無反応に見えるのがいちばん困る。
  assert.match(parts, /Googleへ移動しています/);
});

test('登録の有無を、応答から当てられないようにする', () => {
  const reset = code('app/laruHP/auth/reset-password/page.tsx');
  // 受け口は登録の有無にかかわらず ok を返す。画面も同じにする。
  assert.doesNotMatch(reset, /メールアドレスをご確認ください/);
  assert.match(reset, /登録されていれば/);

  const login = code('app/laruHP/auth/login/LoginClient.tsx');
  assert.match(login, /メールアドレスまたはパスワードが正しくありません/, 'どちらが違うかは言わない');
});

test('料金は1箇所から引く', () => {
  const signup = code('app/laruHP/auth/signup/SignupClient.tsx');
  assert.match(signup, /MONTHLY\.hp/);
  assert.match(signup, /TERMS\.minimumMonths/);
  // 数字を直に書くと、値上げした日にここだけ古いまま残る。
  assert.doesNotMatch(signup, /999円|6ヶ月|6か月/);
});

test('スマホで、入力のたびに画面が拡大しない', () => {
  const css = read('app/laruHP/auth/auth.css');
  const inputRule = css.slice(css.indexOf('.auth-field input {'));
  assert.match(inputRule.slice(0, inputRule.indexOf('}')), /font-size: 16px;/, '16px 未満だと iPhone が拡大する');
  assert.match(css, /min-height: 48px;/, '指で押す所は 44px 以上');
});

test('ログイン前とログイン後で、同じサービスに見える', () => {
  const auth = read('app/laruHP/auth/auth.css');
  const shell = read('app/laruHP/app-shell.css');
  // 面・線・文字・主色を、同じ名前・同じ値で持つ。
  for (const token of ['--sf-card', '--sf-side', '--ln-soft', '--tx-strong', '--ac:']) {
    assert.ok(auth.includes(token), `auth.css に ${token} が無い`);
    assert.ok(shell.includes(token), `app-shell.css に ${token} が無い`);
  }
  for (const [name, value] of [['--sf-side', '#0f172a'], ['--tx-strong', '#0f172a'], ['--ac', '#0369a1']]) {
    const re = new RegExp(`${name}:\\s*${value}`);
    assert.match(auth, re, `auth.css の ${name}`);
    assert.match(shell, re, `app-shell.css の ${name}`);
  }
});

test('同じ画面に、同じ行き先のリンクを2つ置かない', () => {
  const login = read('app/laruHP/auth/login/LoginClient.tsx');
  const resets = (login.match(/\/laruHP\/auth\/reset-password/g) || []).length;
  assert.equal(resets, 1, 'パスワード再設定への導線は1つにする');
});
