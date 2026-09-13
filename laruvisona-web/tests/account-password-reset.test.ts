import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const request = readFileSync(new URL('../app/api/auth/request-password-reset/route.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/laruHP/auth/update-password/page.tsx', import.meta.url), 'utf8');

test('再設定リンクはSupabase Authが発行し固定鍵や全利用者列挙を使わない', () => {
  assert.match(request, /generateLink\(\{ type: 'recovery'/);
  assert.match(request, /api\/auth\/callback/);
  assert.doesNotMatch(request, /listUsers\(/);
  assert.doesNotMatch(request, /createHmac|fallback/);
  assert.equal(existsSync(new URL('../app/api/auth/do-password-reset/route.ts', import.meta.url)), false);
});

test('登録有無を公開応答で区別せず回数と入力を制限する', () => {
  assert.match(request, /account-reset:/);
  assert.match(request, /return NextResponse\.json\(\{ ok: true \}\)/);
  assert.doesNotMatch(request, /登録されていません/);
});

test('新しいパスワードは回復セッション内の本人がSupabase Authへ設定する', () => {
  assert.match(page, /supabase\.auth\.getSession\(\)/);
  assert.match(page, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.doesNotMatch(page, /tokenEmail|do-password-reset|signInWithPassword/);
});
