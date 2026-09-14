import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const plan = readFileSync(new URL('../docs/release-plan-2026-09-14.md', import.meta.url), 'utf8');
const check = readFileSync(new URL('../supabase/release_state_check_20260914.sql', import.meta.url), 'utf8');

test('出荷計画は今回必要なSQLを順序付きで列挙する', () => {
  for (const file of [
    'hp_sites.sql',
    'contacts_crm.sql','hp_orders.sql','hp_loyalty.sql','hp_newsletter.sql','hp_sequences.sql',
    'hp_members.sql','site_members.sql','hp_analytics.sql','hp_scheduling.sql','hp_scheduling_notifications.sql',
    'hp_scheduling_reminders.sql','hp_scheduling_payments.sql','hp_scheduled_emails.sql','hp_push_subscriptions.sql',
  ]) assert.match(plan, new RegExp(file.replace('.', '\\.')));
  assert.match(plan, /REPUBLISH_ON_BOOT` は設定しない/);
  assert.match(plan, /dryRun:true, slug, limit:1/);
  assert.match(plan, /ANALYTICS_SIGNING_SECRET/);
  assert.match(plan, /CRON_SECRET/);
});

test('状態確認SQLは読み取りだけで全体判定を返す', () => {
  assert.match(check, /ALL_REQUIRED_STATE/);
  assert.match(check, /bool_and\(ok\)/);
  assert.match(check, /hp_payment_accounts/);
  assert.match(check, /hp_booking_payments/);
  assert.match(check, /hp_payment_prepare/);
  const executable = check.replace(/--.*$/gm, '').replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(executable, /\b(?:update|insert|delete|alter|drop|create|grant|revoke)\b/i);
});

test('統合SQL回帰は出荷対象を同じ一時DBへ適用し、状態確認を判定する', () => {
  const runner = readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  for (const file of [
    'hp_sites.sql','hp_sites_regression.sql',
    'hp_scheduling.sql','hp_scheduling_notifications.sql','hp_scheduling_reminders.sql','hp_scheduling_payments.sql',
    'hp_scheduling_payments_state_check.sql',
    'hp_scheduled_emails.sql','hp_analytics.sql','hp_scheduling_regression.sql',
    'hp_public_rate_limits_regression.sql','hp_analytics_regression.sql','release_state_check_20260914.sql',
  ]) assert.match(runner, new RegExp(file.replace('.', '\\.')));
  assert.match(runner, /ALL_REQUIRED_STATE\|t/);
});
