import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  escapeContactHtml,
  parseContactUpdate,
  parseContactSubmission,
  readContactBody,
} from '../lib/contact-contract.ts';

const valid = {
  siteId: '11111111-1111-4111-8111-111111111111',
  name: '齋藤 匠',
  email: 'USER@example.com',
  phone: '090-0000-0000',
  message: '相談です',
  type: 'contact',
  extraFields: { company: '株式会社テスト' },
};

test('問い合わせ契約は値を整形し、余分な型を通さない', () => {
  assert.deepEqual(parseContactSubmission(valid), {
    ...valid,
    email: 'user@example.com',
  });
  assert.throws(() => parseContactSubmission({ ...valid, type: 'admin' }));
  assert.throws(() => parseContactSubmission({ ...valid, extraFields: { x: { nested: true } } }));
  assert.throws(() => parseContactSubmission({ ...valid, message: 'x'.repeat(10001) }));
});

test('Content-Lengthが無い分割本文でも上限を超えたら読み切らない', async () => {
  const req = new Request('https://example.test/api/contact', {
    method: 'POST',
    body: JSON.stringify({ message: 'x'.repeat(2000) }),
  });
  await assert.rejects(() => readContactBody(req, 1000), /too_large/);
});

test('メールHTMLへ利用者のHTML・属性を実行可能な形で入れない', () => {
  const escaped = escapeContactHtml(`</td><img src=x onerror="alert(1)">&'`);
  assert.equal(escaped, '&lt;/td&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
  assert.doesNotMatch(escaped, /<img|"alert/);
  const route = fs.readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');
  assert.match(route, /escapeContactHtml\(value\)/);
  assert.match(route, /const safeSiteName = escapeContactHtml\(site\.name\)/);
  assert.match(route, /const safeMessage = escapeContactHtml\(message \|\| ''\)/);
});

test('CRM列と削除権限を再現可能なSQLで管理する', () => {
  const sql = fs.readFileSync(new URL('../supabase/contacts_crm.sql', import.meta.url), 'utf8');
  for (const column of ['extra_fields', 'crm_status', 'crm_tags', 'crm_note', 'crm_followup_at']) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(sql, /for delete to authenticated/);
  assert.match(sql, /site_id in \(select id from public\.sites where user_id = auth\.uid\(\)\)/);
});

test('問い合わせ管理APIはDB失敗と更新0件を成功扱いにしない', () => {
  const src = fs.readFileSync(new URL('../app/api/contacts/route.ts', import.meta.url), 'utf8');
  assert.match(src, /if \(sitesError\)/);
  assert.match(src, /if \(contactsError\)/);
  assert.match(src, /\.select\('id'\)/);
  assert.match(src, /updated\.length !== 1/);
  assert.match(src, /deleted\.length !== 1/);
  assert.match(src, /database_error/);
});

test('問い合わせ管理の更新は許可した値と上限だけを受け付ける', () => {
  const id = valid.siteId;
  assert.deepEqual(parseContactUpdate({ id, read: true, crm_status: 'done', crm_tags: ['VIP'], crm_note: '対応済み', crm_followup_at: null }), {
    id,
    updates: { read: true, crm_status: 'done', crm_tags: ['VIP'], crm_note: '対応済み', crm_followup_at: null },
  });
  assert.throws(() => parseContactUpdate({ id, crm_status: 'deleted' }));
  assert.throws(() => parseContactUpdate({ id, crm_tags: Array(21).fill('x') }));
  assert.throws(() => parseContactUpdate({ id }));
});

test('一括更新も問い合わせIDを本文へ入れ、失敗分を成功表示しない', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/contacts/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /JSON\.stringify\(\{ id, crm_status: newStatus \}\)/);
  assert.match(page, /JSON\.stringify\(\{ id, crm_tags:/);
  assert.match(page, /results\[index\]\?\.ok/);
  assert.match(page, /選択を残しています/);
  assert.match(page, /入力内容は残っています/);
});
