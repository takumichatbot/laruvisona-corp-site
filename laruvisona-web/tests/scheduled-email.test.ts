import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeEmailHtml, isoWeekKey, requireBearer } from '../lib/scheduled-email';

test('cron認証は鍵未設定時もfail closed', () => {
  assert.equal(requireBearer(new Request('https://example.test'), undefined), false);
  assert.equal(requireBearer(new Request('https://example.test', { headers: { authorization: 'Bearer x' } }), 'x'), true);
});

test('メールHTMLの利用者名を実行可能なHTMLにしない', () => {
  assert.equal(escapeEmailHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('週キーはISO週を年境界でも正しく作る', () => {
  assert.equal(isoWeekKey(new Date('2027-01-01T00:00:00+09:00')), '2026-W53');
  assert.equal(isoWeekKey(new Date('2027-01-04T00:00:00+09:00')), '2027-W01');
});

test('週次と継続メールは共通の排他台帳と冪等キーを使う', () => {
  const digest = fs.readFileSync(new URL('../app/api/digest/send/route.ts', import.meta.url), 'utf8');
  const retention = fs.readFileSync(new URL('../app/api/retention/send/route.ts', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(digest, /claimScheduledEmail/);
  assert.match(digest, /idempotencyKey: `hp-weekly-/);
  assert.match(retention, /claimScheduledEmail/);
  assert.match(retention, /idempotencyKey: `hp-retention-/);
  assert.match(retention, /days >= 25 && days <= 29/);
  assert.match(server, /毎日呼び、週キーの台帳/);
});

test('台帳は有限再試行・排他・利用者からの遮断を定義する', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_scheduled_emails.sql', import.meta.url), 'utf8');
  assert.match(sql, /attempts between 0 and 5/);
  assert.match(sql, /unique \(profile_id, kind, period_key\)/);
  assert.match(sql, /claimed_until <= now\(\)/);
  assert.match(sql, /revoke all on public\.hp_scheduled_email_deliveries from public, anon, authenticated/);
});
