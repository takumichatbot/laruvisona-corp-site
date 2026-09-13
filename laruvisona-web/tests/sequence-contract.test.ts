import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  escapeSequenceHtml, parseSequenceCreate, parseSequencePatch, parseSequenceSteps, renderSequenceBody,
} from '../lib/sequence-contract.ts';

const siteId = '11111111-1111-4111-8111-111111111111';

test('ステップ配信の入力は件数・長さ・間隔・開始条件を制限する', () => {
  const value = parseSequenceCreate({ siteId, name: ' お礼 ', trigger: 'booking', steps: [{ delay: 0, subject: ' 件名 ', body: ' 本文 ' }] });
  assert.equal(value.name, 'お礼');
  assert.equal(value.trigger, 'booking');
  assert.deepEqual(value.steps, [{ delay: 0, subject: '件名', body: '本文' }]);
  assert.match(value.id, /^[0-9a-f-]{36}$/);
  assert.throws(() => parseSequenceSteps([{ delay: 1, subject: 'a', body: 'b' }]));
  assert.throws(() => parseSequenceSteps(Array.from({ length: 21 }, () => ({ delay: 0, subject: 'a', body: 'b' }))));
  assert.throws(() => parseSequenceCreate({ siteId, name: 'x', trigger: 'unknown', steps: [{ delay: 0, subject: 'a', body: 'b' }] }));
});

test('更新は許可した4項目だけを受け付け、IDなどを上書きさせない', () => {
  assert.deepEqual(parseSequencePatch({ active: true }), { active: true });
  assert.throws(() => parseSequencePatch({ id: 'other' }));
  assert.throws(() => parseSequencePatch({ enrolledCount: 99 }));
  assert.throws(() => parseSequencePatch({ active: 'yes' }));
});

test('メール本文と店名はHTMLとして実行されず、顧客名だけを置換する', () => {
  assert.equal(escapeSequenceHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(renderSequenceBody('{{name}}様\n<script>x</script>', '<b>客</b>'), '&lt;b&gt;客&lt;/b&gt;様<br>&lt;script&gt;x&lt;/script&gt;');
});

test('設定APIはsettings_json全体を書き戻さず、更新0件とDB失敗を成功にしない', () => {
  const route = fs.readFileSync(new URL('../app/api/sequences/route.ts', import.meta.url), 'utf8');
  assert.match(route, /from\('hp_sequences'\)/);
  assert.doesNotMatch(route, /settings_json|Date\.now\(\)\.toString/);
  assert.match(route, /data\?\.length !== 1/);
  assert.match(route, /parseSequencePatch/);
  assert.match(route, /rpc\('laruhp_sequence_set_active'/);
  assert.match(route, /rpc\('laruhp_sequence_delete'/);
});

test('配信実行はDBで排他取得し、同じ段を同じキーで送り、結果をDBへ確定する', () => {
  const route = fs.readFileSync(new URL('../app/api/sequences/execute/route.ts', import.meta.url), 'utf8');
  assert.match(route, /rpc\('laruhp_sequence_claim'/);
  assert.match(route, /idempotencyKey: `sequence-/);
  assert.match(route, /rpc\('laruhp_sequence_finish'/);
  assert.match(route, /renderSequenceBody/);
  assert.doesNotMatch(route, /limit\(500\)/);
  assert.doesNotMatch(route, /extra_fields/);
});

test('SQLは設定・進行・配信結果を分離し、期限順の排他取得と有限再試行を持つ', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_sequences.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.hp_sequences/);
  assert.match(sql, /create table if not exists public\.hp_sequence_enrollments/);
  assert.doesNotMatch(sql, /on conflict\(sequence_id,contact_id\)/);
  assert.match(sql, /on conflict\(site_id,sequence_id,contact_id\) do nothing returning id into v_id/);
  assert.match(sql, /create table if not exists public\.hp_sequence_deliveries/);
  assert.match(sql, /for update of e skip locked/i);
  assert.match(sql, /unique\(enrollment_id,step_index\)/);
  assert.match(sql, /v_attempt>=5/);
  assert.match(sql, /stale_claim/);
  assert.match(sql, /laruhp_sequence_set_active/);
  assert.match(sql, /deleted_at/);
  assert.match(sql, /revoke all on function public\.laruhp_sequence_claim/);
  const runner = fs.readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  assert.match(runner, /hp_sequences\.sql/);
  assert.match(runner, /hp_sequences_regression\.sql/);
});

test('問い合わせ保存後は専用RPCへ登録し、手動登録も所有サイトに閉じる', () => {
  const contact = fs.readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');
  assert.match(contact, /rpc\('laruhp_sequence_enroll'/);
  assert.doesNotMatch(contact, /_seq_id|_seq_next/);
  const manual = fs.readFileSync(new URL('../app/api/sequences/enroll/route.ts', import.meta.url), 'utf8');
  assert.match(manual, /eq\('user_id', user\.id\)/);
  assert.match(manual, /rpc\('laruhp_sequence_enroll_specific'/);
});

test('管理画面は端末依存の絵文字を使わず、手動登録を実際のAPIへ送る', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/sequences/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /🗑️|✉️|⚠️|⏸|▶/);
  assert.match(page, /fetch\('\/api\/sequences\/enroll'/);
  assert.match(page, /grid-cols-1 sm:grid-cols-2/);
});
