import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * メールのリンクを踏んだ人が、ログインできていなかった。
 *
 * ── 通っていた道 ──
 *
 * 入口は `code` だけを見ていた。`code` を session に換えるには、
 * 登録したときのブラウザに残っている控え（code_verifier）が要る（PKCE）。
 *
 * ところが人は、パソコンで登録して**メールはスマホで開く。**
 * スマホにその控えは無い。だから:
 *
 *   1. リンクを踏む → Supabase は「確認済み」にする
 *   2. こちらへ戻る → 控えが無いので交換に失敗
 *   3. /laruHP/auth/login?error=auth へ飛ばす
 *   4. ログイン画面はその error を**一度も読んでいなかった**。素の画面が出る
 *
 * 本人から見ると「メールのボタンを押したら、ログイン画面に戻された」。
 * 登録できたのかも分からない。
 *
 * 本番の跡: メールで登録した外部の2人が、**確認済みなのに一度もログインしていない。**
 * 2人ともそれきり来ていない。
 *
 * ── パスワード再設定は、もっと悪かった ──
 *
 * あちらのリンクは管理API（generateLink）がサーバー側で作る。
 * つまり控えはどこにも存在しない。**どの端末で開いても通らなかった。**
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

test('端末をまたいでも通る道を持っている', () => {
  // token_hash + verifyOtp は控えを使わない。スマホで開いても通る。
  const src = read('app/api/auth/callback/route.ts');
  assert.match(src, /const tokenHash = searchParams\.get\('token_hash'\);/, 'token_hash を見ていない');
  assert.match(src, /await supabase\.auth\.verifyOtp\(\{ type, token_hash: tokenHash \}\)/,
    'verifyOtp で確かめていない');
  assert.match(src, /if \(code \|\| \(tokenHash && type\)\)/, 'token_hash だけで来た人を門前払いしている');
});

test('code の道は残す（Googleログインはこれで正しい）', () => {
  // OAuth は同じブラウザで始まって同じブラウザで終わる。PKCE のままでよい。
  const src = read('app/api/auth/callback/route.ts');
  assert.match(src, /await supabase\.auth\.exchangeCodeForSession\(code!\)/, 'code の道を消している');
});

test('受け取る種類を、決めた分だけに絞る', () => {
  // 外から来る文字列をそのまま verifyOtp に渡さない。
  const src = read('app/api/auth/callback/route.ts');
  assert.match(src, /const OTP_TYPES = \['signup', 'recovery', 'invite', 'magiclink', 'email_change'\] as const;/);
  assert.match(src, /\(OTP_TYPES as readonly string\[\]\)\.includes\(value \|\| ''\)/, '素通しで渡している');
});

test('失敗したとき、何が起きたかを伝える', () => {
  // 登録そのものは済んでいることが多い。黙って戻すと本人には何も分からない。
  const src = read('app/api/auth/callback/route.ts');
  assert.match(src, /const reason = type === 'signup' \? 'confirmed_no_session' : 'auth';/,
    '登録の確認と、それ以外を区別していない');
});

test('ログイン画面が、その断りを出す', () => {
  const src = read('app/laruHP/auth/login/LoginClient.tsx');
  assert.match(src, /searchParams\.get\('error'\)/, 'error を読んでいない');
  assert.match(src, /case 'confirmed_no_session':/);
  assert.match(src, /メールの確認が終わりました。このままログインしてください。/);
  assert.match(src, /case 'auth':/, '期限切れのときに黙っている');
  // 実際に画面へ出ること（読むだけで出さないのが元の状態）
  assert.match(src, /\{notice && !error && <AuthNote kind="info">\{notice\}<\/AuthNote>\}/,
    '読んでいるが表示していない');
});

test('パスワード再設定のリンクを、自分で組み立てる', () => {
  /*
    action_link は Supabase の /auth/v1/verify を通って PKCE で戻る。
    管理APIで作ったリンクに控えは無いので、**ずっと通っていなかった。**
  */
  const src = read('app/api/auth/request-password-reset/route.ts');
  assert.match(src, /const hashed = generated\.data\?\.properties\?\.hashed_token;/,
    'hashed_token を使っていない');
  assert.match(src, /token_hash=\$\{encodeURIComponent\(hashed\)\}&type=recovery/,
    'こちらの入口へ直接渡していない');
  // 組み立てられなかったときだけ、元のリンクに落とす
  assert.match(src, /: generated\.data\?\.properties\?\.action_link;/, '作れなかったときに何も送らなくなる');
});
