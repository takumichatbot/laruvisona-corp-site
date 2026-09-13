import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const plan = readFileSync(new URL('../docs/release-plan-2026-09-14.md', import.meta.url), 'utf8');
const check = readFileSync(new URL('../supabase/release_state_check_20260914.sql', import.meta.url), 'utf8');

test('出荷計画は今回必要なSQLを順序付きで列挙する', () => {
  for (const file of [
    'contacts_crm.sql','hp_orders.sql','hp_loyalty.sql','hp_newsletter.sql','hp_sequences.sql',
    'hp_members.sql','site_members.sql','hp_analytics.sql','hp_scheduling_notifications.sql',
    'hp_scheduling_reminders.sql','hp_scheduled_emails.sql','hp_push_subscriptions.sql',
  ]) assert.match(plan, new RegExp(file.replace('.', '\\.')));
  assert.match(plan, /REPUBLISH_ON_BOOT` は設定しない/);
  assert.match(plan, /dryRun:true, slug, limit:1/);
});

test('状態確認SQLは読み取りだけで全体判定を返す', () => {
  assert.match(check, /ALL_REQUIRED_STATE/);
  assert.match(check, /bool_and\(ok\)/);
  assert.doesNotMatch(check, /\b(?:update|insert|delete|alter|drop|create|grant|revoke)\b/i);
});
