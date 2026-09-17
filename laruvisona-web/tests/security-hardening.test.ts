import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clientIp } from '../lib/rate-limit';
import { isAdminEmail } from '../lib/adminAuth';

const code = (p: string) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const req = (headers: Record<string, string>) => new Request('https://laruvisona.jp/', { headers });

/**
 * 2026-09-17 の点検で見つかったもの。
 * どれも「攻撃されて初めて気づく」種類なので、テストで固定しておく。
 */

test('回数制限のIPは、送信者が書ける値を信じない', () => {
  // 逆プロキシは自分が見た相手を右に足す。先頭は送信者が自由に書ける。
  assert.equal(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-real-ip': '203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({})), 'unknown');
  const src = code('lib/rate-limit.ts');
  assert.doesNotMatch(src, /fwd\.split\(','\)\[0\]/, '先頭を採ると回数制限が丸ごと無効になる');
});

test('管理者判定は、環境変数が未設定なら必ず落ちる', () => {
  const saved = { a: process.env.ADMIN_EMAIL, b: process.env.NEXT_PUBLIC_ADMIN_EMAIL };
  try {
    delete process.env.ADMIN_EMAIL;
    delete process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    // 未設定のときに undefined === undefined で通ってしまうのが、直したかった穴
    assert.equal(isAdminEmail(undefined), false);
    assert.equal(isAdminEmail(''), false);
    assert.equal(isAdminEmail('someone@example.com'), false);

    process.env.ADMIN_EMAIL = 'Owner@Example.com';
    assert.equal(isAdminEmail('owner@example.com'), true);
    assert.equal(isAdminEmail(' owner@example.com '), true);
    assert.equal(isAdminEmail('other@example.com'), false);
    assert.equal(isAdminEmail(undefined), false);
  } finally {
    if (saved.a === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = saved.a;
    if (saved.b === undefined) delete process.env.NEXT_PUBLIC_ADMIN_EMAIL; else process.env.NEXT_PUBLIC_ADMIN_EMAIL = saved.b;
  }
});

test('管理APIが、裸のメール比較に戻っていない', () => {
  for (const path of [
    'app/api/admin/users/route.ts',
    'app/api/admin/stats/route.ts',
    'app/api/admin/users/[id]/route.ts',
  ]) {
    const src = code(path);
    assert.doesNotMatch(src, /user\.email === process\.env\.ADMIN_EMAIL/, `${path}: 未設定時に素通りする書き方`);
    assert.match(src, /isAdminEmail/);
  }
});

test('アップロードは、本文を読み込む前に大きさで切る', () => {
  for (const path of ['app/api/images/upload/route.ts', 'app/api/ai-command/upload/route.ts']) {
    const src = code(path);
    const guard = src.indexOf("content-length");
    const read = src.indexOf('req.formData()');
    assert.ok(guard > 0, `${path}: content-length を見ていない`);
    assert.ok(guard < read, `${path}: 判定が formData() のあとでは、もうメモリに載っている`);
  }
});

test('DBの生メッセージを、そのままクライアントへ返さない', () => {
  for (const path of [
    'app/api/ai-command/sessions/route.ts',
    'app/api/ai-command/commands/route.ts',
    'app/api/sites/[id]/posts/route.ts',
    'app/api/admin/republish-all/route.ts',
    'app/api/images/upload/route.ts',
  ]) {
    const src = code(path);
    assert.doesNotMatch(src, /\{ error: error\.message \}/, `${path}: テーブル名・列名・制約名が漏れる`);
  }
});

test('AIサイト診断が、存在しない列を読みにいかない', () => {
  const src = code('app/api/ai/site-audit/route.ts');
  // page_title / meta_description は sites に無い列。含めると問い合わせ全体が失敗する。
  assert.doesNotMatch(src, /select\([^)]*page_title/);
  assert.doesNotMatch(src, /select\([^)]*meta_description/);
});

test('DBに足す列の手順が、リポジトリに残っている', () => {
  const sql = code('supabase/security-and-missing-columns-2026-09-17.sql');
  for (const column of ['gmb_place_id', 'instagram_username', 'agency_brand_name', 'agency_logo_url', 'agency_accent', 'lead_scores']) {
    assert.match(sql, new RegExp(column), `${column} を足す手順が無い`);
  }
  assert.match(sql, /drop policy if exists "sites_select_published"/, '匿名に公開サイトの全列を読ませない手当て');
  assert.match(sql, /laruhp_guard_profile_billing/, '課金・権限の列を本人が書き換えられない手当て');
});
