import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const member = readFileSync(new URL('../app/api/hp/members/request-reset/route.ts', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../app/api/auth/callback/route.ts', import.meta.url), 'utf8');

test('会員再設定メールはResendの戻り値を確認し個人メールをログへ出さない', () => {
  assert.match(member, /if \(result\.error\) throw/);
  assert.match(member, /singleLine\(site\?\.name/);
  assert.doesNotMatch(member, /console\.(?:log|warn|error)\([^\n]*emailNorm/);
});

test('初回案内はメール受付後だけ送信済みとして記録する', () => {
  assert.match(callback, /const welcome = await resend\.emails\.send/);
  /*
    元は `if (!welcome.error) await supabase.auth.updateUser` という
    一行そのものを見ていた。見たいのは**書き方ではなく決めごと**:
      ・受け付けられたときだけ「送信済み」の印を付ける
      ・受け付けられなかったら、印を付けない
    書き方を固定すると、同じ決めごとのまま形を整えただけで落ちる。
  */
  const at = callback.indexOf('const welcome = await resend.emails.send');
  const after = callback.slice(at);
  const mark = after.indexOf('welcome_sent: true');
  assert.ok(mark > 0, '送信済みの印を付けていない');
  // 印を付ける手前に、受け付けられたかの確認があること
  const before = after.slice(0, mark);
  assert.match(before, /welcome\.error/, '結果を見ずに印を付けている');
  assert.match(before, /if \(welcome\.error\)[\s\S]{0,200}\} else \{|if \(!welcome\.error\)/,
    '失敗したときに印を付けない分岐が無い');
});

test('初回案内は、送れなかったことを記録に残す', () => {
  // 残さないと「送ったが失敗」と「そもそも送っていない」が区別できない。
  assert.match(callback, /console\.error\('\[auth\] welcome mail not accepted:'/);
  // 印の更新に失敗すると、次のログインで同じメールをもう一度送る
  assert.match(callback, /welcome_sent not recorded \(may resend\)/);
});
