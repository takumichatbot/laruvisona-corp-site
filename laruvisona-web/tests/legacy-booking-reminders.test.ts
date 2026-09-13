import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { legacyBookingReminderMessage } from '../lib/scheduling/reminders.ts';

const route=readFileSync(new URL('../app/api/booking/reminders/route.ts',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/hp_reservations_reminded.sql',import.meta.url),'utf8');
const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');

test('旧予約のメールはHTMLを実行せずヘッダー用の店舗名を無害化する',()=>{
  const message=legacyBookingReminderMessage({
    reservation_id:'r-1',claim_token:'c',site_id:'s',customer_name:'<img src=x>',
    customer_email:'guest@example.test',service_name:'相談',starts_at:'2026-09-15T01:00:00Z',
    site_name:'店\r\nBcc: victim@example.test',
  });
  assert.equal(message.subject,'【ご予約リマインダー】店 Bcc: victim@example.test');
  assert.match(message.text,/<img src=x>/);
  assert.doesNotMatch(JSON.stringify(message),/html/);
});

test('旧予約ワーカーはDBの取得票と事業者冪等キーを使い、失敗を成功にしない',()=>{
  assert.match(route,/rpc\('hp_legacy_claim_reminders'/);
  assert.match(route,/idempotencyKey:`hp-legacy-booking-reminder-\$\{row\.reservation_id\}`/);
  assert.match(route,/ok=!response\.error/);
  assert.match(route,/rpc\('hp_legacy_finish_reminder'/);
  assert.match(route,/status:failed\?503:200/);
  assert.doesNotMatch(route,/html:/);
});

test('旧予約の取得は排他的で、取得票が一致した結果だけを確定する',()=>{
  assert.match(sql,/for update of r skip locked/i);
  assert.match(sql,/reminder_attempts<5/i);
  assert.match(sql,/reminder_claim_token=p_claim_token/i);
  assert.match(sql,/reminded=case when p_success then true else reminded end/i);
  assert.match(sql,/current_user in \('anon','authenticated'\)/i);
  assert.match(sql,/hp_legacy_protect_reminder_state_trg/i);
  assert.match(sql,/public\.hp_legacy_claim_reminders\(integer\)[\s\S]*from public,anon,authenticated/i);
});

test('旧日次処理を廃止し、新旧リマインドを同じ15分処理から呼ぶ',()=>{
  assert.match(server,/api\/cron\/booking-reminders[\s\S]+api\/booking\/reminders/);
  assert.equal((server.match(/postCron\('\/api\/booking\/reminders'\)/g)||[]).length,0);
});
