import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('未完了の予約通知を排他取得し、同じ通知関数で有限再試行する',()=>{
 const sql=fs.readFileSync(new URL('../supabase/hp_scheduling_notifications.sql',import.meta.url),'utf8');const route=fs.readFileSync(new URL('../app/api/cron/booking-notifications/route.ts',import.meta.url),'utf8');
 assert.match(sql,/for update of e skip locked/i);assert.match(sql,/notification_attempts<5/);assert.match(sql,/notification_attempts between 0 and 5/);assert.match(sql,/notification_lease/);assert.match(sql,/23 hours/);assert.match(sql,/stale_claim/);assert.match(sql,/notification_claim_token=p_claim_token/);assert.match(sql,/not p_success or notified=true/);
 assert.match(route,/notifyAppointment\(row\.site_id,row\.appointment_id,row\.revision\)/);assert.match(route,/hp_schedule_finish_notification/);assert.match(route,/finish\.data!==true/);
 const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');assert.match(server,/api\/cron\/booking-notifications/);assert.match(server,/5\*60000/);
});
test('通知済みフラグはDBで実際に1件更新できた場合だけ成功になる',()=>{
 const notify=fs.readFileSync(new URL('../lib/scheduling/notify.ts',import.meta.url),'utf8');assert.match(notify,/saved\.data\?\.length !== 1/);assert.match(notify,/marked\.data\?\.length === 1/);assert.match(notify,/userError/);assert.match(notify,/idempotencyKey: `hp-schedule-/);
});
