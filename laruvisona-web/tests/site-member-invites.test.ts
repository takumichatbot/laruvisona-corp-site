import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { escapeInviteHtml, readSiteMemberBody, siteMemberEmail, siteMemberSiteId, siteMemberToken } from '../lib/site-member-contract.ts';

const siteId = '11111111-1111-4111-8111-111111111111';
const token = 'a'.repeat(48);

test('共同閲覧の入力は正規化し、サイト・メール・トークンの形を固定する', () => {
  assert.equal(siteMemberSiteId(siteId), siteId);
  assert.equal(siteMemberEmail(' VIEWER@Example.com '), 'viewer@example.com');
  assert.equal(siteMemberToken(token), token);
  assert.throws(() => siteMemberSiteId('site'));
  assert.throws(() => siteMemberEmail('invalid'));
  assert.throws(() => siteMemberToken('a'.repeat(47)));
  assert.equal(escapeInviteHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

test('招待本文はContent-Lengthが無くても実バイト数で停止する', async () => {
  const req = new Request('https://example.test/api/sites/x/members', { method: 'POST', body: JSON.stringify({ email: `${'あ'.repeat(2000)}@example.com` }) });
  await assert.rejects(() => readSiteMemberBody(req, 1000), /長すぎ/);
});

test('招待は所有者に閉じ、役割を固定し、メール送信失敗を成功にしない', () => {
  const route = fs.readFileSync(new URL('../app/api/sites/[id]/members/route.ts', import.meta.url), 'utf8');
  assert.match(route, /\.eq\('user_id', user\.id\)/);
  assert.match(route, /role: 'conversation_viewer'/);
  assert.match(route, /invite_expires_at: expiresAt/);
  assert.match(route, /if \(mailError\) throw/);
  assert.match(route, /status: 502/);
  assert.match(route, /escapeInviteHtml\(/);
  assert.doesNotMatch(route, /\.catch\(\(\) => \{\}\)/);
});

test('招待受諾は招待先メール・期限・未使用トークンを照合し競合を成功にしない', () => {
  const route = fs.readFileSync(new URL('../app/api/sites/[id]/members/accept/route.ts', import.meta.url), 'utf8');
  assert.match(route, /member\.invited_email !== userEmail/);
  assert.match(route, /\.gt\('invite_expires_at'/);
  assert.match(route, /\.eq\('invite_token', token\)\.eq\('status', 'pending'\)/);
  assert.match(route, /activated\?\.length !== 1/);
});

test('取消と管理画面はAPI成功後だけ一覧を変え、権限を正しく説明する', () => {
  const route = fs.readFileSync(new URL('../app/api/sites/[id]/members/route.ts', import.meta.url), 'utf8');
  assert.match(route, /deleted\?\.length !== 1/);
  const dashboard = fs.readFileSync(new URL('../app/laruHP/dashboard/DashboardClient.tsx', import.meta.url), 'utf8');
  const removalStart = dashboard.indexOf("method: 'DELETE'", dashboard.indexOf('LARUbot履歴の共有'));
  const removal = dashboard.slice(removalStart, dashboard.indexOf('{/* Invite input */}', removalStart));
  assert.ok(removal.indexOf('if (!response.ok)') < removal.indexOf('setMemberLists'));
  assert.match(dashboard, /LARUbot履歴の共有/);
  const page = fs.readFileSync(new URL('../app/laruHP/invite/[token]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /チャット履歴を閲覧するメンバー/);
  assert.doesNotMatch(page, /サイト編集への招待|❌/u);
});

test('招待された人も共有サイトを選び、所有者だけがAI分析を実行できる', () => {
  const api = fs.readFileSync(new URL('../app/api/larubot/conversations/route.ts', import.meta.url), 'utf8');
  assert.match(api, /\.from\('site_members'\)\.select\('site_id'\)/);
  assert.match(api, /access: 'viewer'/);
  const page = fs.readFileSync(new URL('../app/laruHP/larubot-logs/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /fetch\('\/api\/larubot\/conversations'\)/);
  assert.match(page, /selectedSite\?\.access === 'owner'/);
});

test('共同閲覧表は期限・役割・権限境界をSQL回帰へ含める', () => {
  const sql = fs.readFileSync(new URL('../supabase/site_members.sql', import.meta.url), 'utf8');
  assert.match(sql, /invite_expires_at timestamptz/);
  assert.match(sql, /check \(role='conversation_viewer'\)/);
  assert.match(sql, /revoke all on public\.site_members from anon, authenticated/);
  assert.match(sql, /grant all on public\.site_members to service_role/);
  const runner = fs.readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  assert.match(runner, /site_members\.sql/);
  assert.match(runner, /site_members_regression\.sql/);
});
