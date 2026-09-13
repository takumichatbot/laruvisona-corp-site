import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bookingReminderMessage } from '../lib/scheduling/reminders.ts';

test('予約リマインドは店舗・日時・担当・予約番号を平文で伝える',()=>{
  const message=bookingReminderMessage({reminder_id:'r',claim_token:'c',kind:'24h',site_id:'s',appointment_id:'a-1',appointment_revision:2,customer_name:'齋藤',customer_email:'s@example.com',service_name:'初回相談',staff_name:'青木',starts_at:'2026-09-15T01:00:00Z',site_name:'相談室 まどか'});
  assert.equal(message.subject,'【明日のご予約】相談室 まどか');
  assert.match(message.text,/齋藤 様/);assert.match(message.text,/初回相談/);assert.match(message.text,/青木/);assert.match(message.text,/a-1/);
  assert.doesNotMatch(message.text,/<[^>]+>/);
  assert.equal(bookingReminderMessage({...({reminder_id:'r',claim_token:'c',kind:'2h',site_id:'s',appointment_id:'a',appointment_revision:1,customer_name:'客',customer_email:'a@b.test',service_name:'相談',staff_name:'青木',starts_at:'2026-09-15T01:00:00Z',site_name:'店\r\nBcc: x'} as const)}).subject,'【まもなくのご予約】店 Bcc: x');
});

test('配信APIは認証・事前設定・排他取得・冪等送信・結果確定を持つ',()=>{
  const route=fs.readFileSync(new URL('../app/api/cron/booking-reminders/route.ts',import.meta.url),'utf8');
  assert.match(route,/process\.env\.ADMIN_SECRET/);assert.match(route,/process\.env\.RESEND_API_KEY/);
  assert.match(route,/rpc\('hp_schedule_claim_reminders'/);assert.match(route,/idempotencyKey:`hp-booking-reminder-\$\{row\.reminder_id\}`/);
  assert.match(route,/rpc\('hp_schedule_finish_reminder'/);assert.match(route,/finished\.data!==true/);
  const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/api\/cron\/booking-reminders/);assert.match(server,/15\*60000/);
});

test('SQLは予約版ごとの一意性・期限順の排他取得・失効・有限再試行を持つ',()=>{
  const sql=fs.readFileSync(new URL('../supabase/hp_scheduling_reminders.sql',import.meta.url),'utf8');
  assert.match(sql,/unique \(appointment_id,appointment_revision,kind\)/i);
  assert.match(sql,/for update of r skip locked/i);assert.match(sql,/attempts<5/i);
  assert.match(sql,/a\.revision<>r\.appointment_revision/);assert.match(sql,/status='obsolete'/);
  assert.match(sql,/last_error='stale_claim'/);
  assert.match(sql,/claim_token=p_claim_token/);assert.match(sql,/revoke all on public\.hp_booking_reminders from public,anon,authenticated/i);
});
