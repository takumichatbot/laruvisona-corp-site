// P0-09 の回帰テスト。
// 旧実装は Google OAuth の state に Supabase のユーザーID をそのまま入れ、
// コールバックではその値を書き込み先として信用していた。ID は秘密ではないため、
// state を他人のIDに差し替えるだけで profiles.google_refresh_token を
// 書き換えられる（＝連携先の乗っ取り）。
//
// ここでは (1) state の生成・照合ロジックと、(2) コールバック実装が
// state を書き込み先に使っていないことの両方を検証する。
// 実際の HTTP・Supabase への接続は行わない。

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const { createOAuthState, oauthStateMatches, OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_SEC } =
  await import('../lib/oauth-state.ts');

test('P0-09 state は毎回異なる使い捨ての乱数', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const s = createOAuthState();
    assert.ok(s.length >= 40, `state が短すぎる: ${s}`);
    assert.match(s, /^[A-Za-z0-9_-]+$/);
    assert.ok(!seen.has(s), 'state が重複した');
    seen.add(s);
  }
});

test('P0-09 state 照合は一致したときだけ true', () => {
  const s = createOAuthState();
  assert.equal(oauthStateMatches(s, s), true);
  assert.equal(oauthStateMatches(s, createOAuthState()), false);
  assert.equal(oauthStateMatches(s, s.slice(0, -1) + (s.endsWith('A') ? 'B' : 'A')), false);
});

test('P0-09 Cookie 欠落・空文字を一致として扱わない', () => {
  assert.equal(oauthStateMatches('', ''), false);
  assert.equal(oauthStateMatches(null, null), false);
  assert.equal(oauthStateMatches(undefined, undefined), false);
  assert.equal(oauthStateMatches(createOAuthState(), undefined), false);
  assert.equal(oauthStateMatches(undefined, createOAuthState()), false);
});

// ── 実装そのものを見る（型では表現できないため文面で固定する） ──────────
const initiate = readFileSync(new URL('../app/api/auth/google/route.ts', import.meta.url), 'utf8');
const callback = readFileSync(new URL('../app/api/auth/google/callback/route.ts', import.meta.url), 'utf8');

test('P0-09 認可開始時に state をユーザーIDにしない', () => {
  assert.ok(!/state:\s*user\.id/.test(initiate), 'state にユーザーIDを入れている');
  assert.ok(/createOAuthState\(\)/.test(initiate), 'state を乱数生成していない');
  assert.ok(
    new RegExp(`cookies\\.set\\(\\s*${OAUTH_STATE_COOKIE.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}|cookies\\.set\\(\\s*OAUTH_STATE_COOKIE`).test(initiate),
    'state を httpOnly Cookie に保存していない'
  );
  assert.ok(/httpOnly:\s*true/.test(initiate), 'Cookie が httpOnly でない');
  assert.ok(/sameSite:\s*'lax'/.test(initiate), 'Google からの戻りで Cookie が届かない設定になっている');
});

test('P0-09 コールバックは state を照合し、書き込み先はセッションから取る', () => {
  assert.ok(/oauthStateMatches\(/.test(callback), 'state を照合していない');
  assert.ok(/auth\.getUser\(\)/.test(callback), 'ログインセッションを確認していない');
  assert.ok(/\.eq\(\s*'id'\s*,\s*user\.id\s*\)/.test(callback), '書き込み先がセッションのユーザーになっていない');
  assert.ok(!/\.eq\(\s*'id'\s*,\s*state\s*\)/.test(callback), 'state を書き込み先に使っている');
});

test('P0-09 state Cookie は短命で、成否にかかわらず破棄される', () => {
  assert.ok(OAUTH_STATE_MAX_AGE_SEC <= 15 * 60, 'state Cookie の寿命が長すぎる');
  assert.ok(/maxAge:\s*0/.test(callback), 'コールバックで state Cookie を破棄していない');
});

// ── 週次レポート cron の fail-open ──────────────────────────────────
const cron = readFileSync(new URL('../app/api/cron/weekly-report/route.ts', import.meta.url), 'utf8');

test('CRON_SECRET が未設定なら週次一斉メールを実行しない', () => {
  assert.ok(/if\s*\(\s*!secret\s*\)/.test(cron), 'CRON_SECRET 未設定時に素通りする');
  assert.ok(!/if\s*\(\s*secret\s*\)\s*\{/.test(cron), '鍵がある時だけ検証する fail-open が残っている');
});
