import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hpMemberEmail,
  parseHpMemberLogin,
  parseHpMemberReset,
  parseHpMemberSubscribe,
  parseHpMemberSignup,
  readHpMemberBody,
} from '../lib/hp-member-contract.ts';

const siteId = '11111111-1111-4111-8111-111111111111';

test('会員登録はサイト・メール・パスワードを整形し余分な入力を拒否する', () => {
  assert.deepEqual(parseHpMemberSignup({ siteId, email: ' USER@Example.com ', password: 'password-1', name: ' 齋藤 ' }), {
    honeypot: false, siteId, email: 'user@example.com', password: 'password-1', name: '齋藤',
  });
  assert.equal(hpMemberEmail(' USER@Example.com '), 'user@example.com');
  assert.throws(() => parseHpMemberSignup({ siteId: 'bad', email: 'a@example.com', password: 'password-1' }));
  assert.throws(() => parseHpMemberSignup({ siteId, email: 'bad', password: 'password-1' }));
  assert.throws(() => parseHpMemberSignup({ siteId, email: 'a@example.com', password: 'short' }), /8〜128/);
  assert.throws(() => parseHpMemberSignup({ siteId, email: 'a@example.com', password: 'password-1', role: 'paid' }));
});

test('ログインと再設定は長すぎる値や余分なキーを受け付けない', () => {
  assert.deepEqual(parseHpMemberLogin({ siteId, email: 'a@example.com', password: 'secret' }), { siteId, email: 'a@example.com', password: 'secret' });
  assert.throws(() => parseHpMemberLogin({ siteId, email: 'a@example.com', password: 'secret', status: 'active' }));
  assert.throws(() => parseHpMemberReset({ token: 'token', password: '1234567' }), /8〜128/);
  assert.throws(() => parseHpMemberReset({ token: 'x'.repeat(4097), password: 'password-1' }));
});

test('月額購読はStripe価格・ログイン情報・戻り先の長さを検証する', () => {
  assert.deepEqual(parseHpMemberSubscribe({ siteId, token: 'member-token', priceId: 'price_123Abc', returnUrl: 'https://shop.example.test/' }), {
    siteId, token: 'member-token', priceId: 'price_123Abc', returnUrl: 'https://shop.example.test/',
  });
  assert.throws(() => parseHpMemberSubscribe({ siteId, token: 'member-token', priceId: 'prod_123' }));
  assert.throws(() => parseHpMemberSubscribe({ siteId, token: 'member-token', priceId: 'price_123', returnUrl: 'x'.repeat(2049) }));
});

test('本文はContent-Lengthなしの分割送信でも上限で停止する', async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('{"value":"'));
      controller.enqueue(encoder.encode('あ'.repeat(1000)));
      controller.enqueue(encoder.encode('"}'));
      controller.close();
    },
  });
  const req = new Request('https://example.test/api/hp/members/signup', { method: 'POST', body, duplex: 'half' } as RequestInit & { duplex: string });
  await assert.rejects(() => readHpMemberBody(req, 1000), /長すぎ/);
});

test('認証APIはDBエラー・停止会員・削除0件を成功にしない', () => {
  const signup = fs.readFileSync(new URL('../app/api/hp/members/signup/route.ts', import.meta.url), 'utf8');
  assert.match(signup, /if \(siteError\)/);
  assert.match(signup, /if \(existingError\)/);
  assert.match(signup, /error \|\| !member/);
  const login = fs.readFileSync(new URL('../app/api/hp/members/login/route.ts', import.meta.url), 'utf8');
  assert.match(login, /if \(error\).*status: 500/);
  assert.match(login, /member\.status !== 'active'/);
  const subscribe = fs.readFileSync(new URL('../app/api/hp/members/subscribe/route.ts', import.meta.url), 'utf8');
  assert.match(subscribe, /member\.status !== 'active'/);
  assert.match(subscribe, /if \(memberError\)/);
  assert.match(subscribe, /if \(siteError\)/);
  assert.match(subscribe, /readHpMemberBody\(req\)/);
  const manage = fs.readFileSync(new URL('../app/api/hp/members/manage/route.ts', import.meta.url), 'utf8');
  assert.match(manage, /\.eq\('site_id', siteId\)\.select\('id'\)/);
  assert.match(manage, /deleted\?\.length !== 1/);
});

test('管理画面は削除成功後だけ表示を消し、公開画面に絵文字を残さない', () => {
  const page = fs.readFileSync(new URL('../app/laruHP/members/page.tsx', import.meta.url), 'utf8');
  const remove = page.slice(page.indexOf('const remove'), page.indexOf('const exportCsv'));
  assert.ok(remove.indexOf('if (!res.ok) throw') < remove.indexOf('setMembers'));
  assert.doesNotMatch(page, /👥|❌|✅|⭐/u);
  const reset = fs.readFileSync(new URL('../app/hp/member-reset/page.tsx', import.meta.url), 'utf8');
  assert.match(reset, /minLength=\{8\}/);
  assert.match(reset, /maxLength=\{128\}/);
  assert.doesNotMatch(reset, /✅|⭐/u);
  const exported = fs.readFileSync(new URL('../lib/html-export.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(exported, /⭐/u);
});

test('会員表は匿名アクセスと利用者の書き込みを閉じSQL回帰に含まれる', () => {
  const sql = fs.readFileSync(new URL('../supabase/hp_members.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on public\.hp_members from anon, authenticated/);
  assert.match(sql, /grant select on public\.hp_members to authenticated/);
  assert.match(sql, /grant all on public\.hp_members to service_role/);
  const runner = fs.readFileSync(new URL('../supabase/run-sql-regression.sh', import.meta.url), 'utf8');
  assert.match(runner, /hp_members\.sql/);
  assert.match(runner, /hp_members_regression\.sql/);
});
