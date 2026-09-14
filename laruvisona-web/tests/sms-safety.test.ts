import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('任意の電話番号と本文をTwilioへ送れる旧SMS APIを閉じる', () => {
  const route = read('../app/api/sms/route.ts');
  assert.match(route, /status: 410/);
  assert.doesNotMatch(route, /TWILIO_|api\.twilio\.com|req\.json|createServiceClient|createClient/);
});

test('排他取得のない旧SMSリマインダーを定期実行しない', () => {
  const route = read('../app/api/sms/reminders/route.ts');
  const server = read('../server.js');
  assert.match(route, /status: 410/);
  assert.doesNotMatch(route, /TWILIO_|api\.twilio\.com|sms_24h_sent|sms_2h_sent/);
  assert.doesNotMatch(server, /postCron\('\/api\/sms\/reminders'/);
  assert.match(server, /api\/cron\/booking-reminders[\s\S]+api\/booking\/reminders/);
});
