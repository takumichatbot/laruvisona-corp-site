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
  assert.match(callback, /if \(!welcome\.error\) await supabase\.auth\.updateUser/);
});
