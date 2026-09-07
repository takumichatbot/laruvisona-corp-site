// 運用権限の境界に関する回帰テスト。
// 監査で「実ソース＋ダミー環境で再現済み」とされた侵入経路が塞がったままであることを検証する。
//
// 実行: npm test  （Node 24 の TypeScript 型除去で .ts をそのまま実行）
// 外部サービスへは一切接続しない。

import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

// テスト用の鍵を先に立てる（モジュール読込時に env を読む実装があるため）
process.env.MEMBER_JWT_SECRET = 'test-member-secret';
process.env.BRIDGE_JWT_SECRET = 'test-bridge-secret';
process.env.ADMIN_SECRET = 'test-admin-secret';

const relayAuth = await import('../lib/bridge-relay-auth.js');
const verifyBridgeToken: (token: string, role: string, secret: string) => boolean =
  (relayAuth as unknown as { default: { verifyBridgeToken: typeof verifyBridgeToken } }).default.verifyBridgeToken;

const {
  signMemberToken, verifyMemberToken, signResetToken, verifyResetToken,
  hashPassword, passwordFingerprint,
} = await import('../lib/member-auth.ts');

const { createAdminSession, verifyAdminSession, readAdminCookie } =
  await import('../lib/admin-session.ts');

const BRIDGE_SECRET = process.env.BRIDGE_JWT_SECRET!;

function bridgeToken(extra: Record<string, unknown> = {}, opts: jwt.SignOptions = {}) {
  return jwt.sign(
    { sub: 'bridge', typ: 'bridge', ...extra },
    BRIDGE_SECRET,
    { issuer: 'laruvisona-bridge', audience: 'bridge-relay', expiresIn: '1h', ...opts }
  );
}

// ── P0-01: 会員 JWT で運用リレーに接続できてはならない ──────────────────
test('P0-01 会員トークンは relay の認証を通らない', () => {
  const member = signMemberToken({ id: 'm1', siteId: 's1', email: 'a@example.com' });
  assert.equal(verifyBridgeToken(member, 'client', BRIDGE_SECRET), false);
  assert.equal(verifyBridgeToken(member, 'mac', BRIDGE_SECRET), false);
});

test('P0-01 会員鍵と Bridge 鍵が同じでも用途チェックで弾く', () => {
  // 運用上は鍵を分けるが、万一同じ値を設定しても通ってはいけない
  const sameSecret = 'shared-secret';
  const memberLike = jwt.sign(
    { mid: 'm1', sid: 's1', email: 'a@example.com', typ: 'member' },
    sameSecret,
    { issuer: 'laruvisona-members', audience: 'site-members', expiresIn: '30d' }
  );
  assert.equal(verifyBridgeToken(memberLike, 'client', sameSecret), false);
});

test('P0-01 正規の Bridge トークンだけが通る', () => {
  assert.equal(verifyBridgeToken(bridgeToken(), 'client', BRIDGE_SECRET), true);
  assert.equal(verifyBridgeToken(bridgeToken(), 'mac', BRIDGE_SECRET), true);
});

test('P0-01 issuer / audience / 用途が違うトークンは通らない', () => {
  const wrongIss = jwt.sign({ sub: 'bridge', typ: 'bridge' }, BRIDGE_SECRET,
    { issuer: 'someone-else', audience: 'bridge-relay', expiresIn: '1h' });
  const wrongAud = jwt.sign({ sub: 'bridge', typ: 'bridge' }, BRIDGE_SECRET,
    { issuer: 'laruvisona-bridge', audience: 'other', expiresIn: '1h' });
  const wrongTyp = bridgeToken({ typ: 'member' });
  const noClaims = jwt.sign({}, BRIDGE_SECRET, { expiresIn: '1h' });
  for (const t of [wrongIss, wrongAud, wrongTyp, noClaims]) {
    assert.equal(verifyBridgeToken(t, 'client', BRIDGE_SECRET), false);
  }
});

test('P0-01 role が固定されたトークンは他の role に流用できない', () => {
  const clientOnly = bridgeToken({ role: 'client' });
  assert.equal(verifyBridgeToken(clientOnly, 'client', BRIDGE_SECRET), true);
  assert.equal(verifyBridgeToken(clientOnly, 'mac', BRIDGE_SECRET), false);
});

test('P0-01 未知の role・鍵未設定・期限切れは拒否する', () => {
  assert.equal(verifyBridgeToken(bridgeToken(), 'admin', BRIDGE_SECRET), false);
  assert.equal(verifyBridgeToken(bridgeToken(), 'client', ''), false);
  const expired = bridgeToken({}, { expiresIn: '-1s' });
  assert.equal(verifyBridgeToken(expired, 'client', BRIDGE_SECRET), false);
});

// ── P0-08: リセット用トークンが通常ログインとして通ってはならない ────────
test('P0-08 リセットトークンは会員セッションとして通らない', () => {
  const reset = signResetToken('m1', 's1', hashPassword('old-password'));
  assert.equal(verifyMemberToken(reset), null);
});

test('P0-08 会員トークンはリセットトークンとして通らない', () => {
  const member = signMemberToken({ id: 'm1', siteId: 's1', email: 'a@example.com' });
  assert.equal(verifyResetToken(member), null);
});

test('P0-08 正規の会員／リセットトークンはそれぞれ通る', () => {
  const member = signMemberToken({ id: 'm1', siteId: 's1', email: 'a@example.com' });
  const m = verifyMemberToken(member);
  assert.equal(m?.mid, 'm1');
  assert.equal(m?.sid, 's1');

  const hash = hashPassword('old-password');
  const r = verifyResetToken(signResetToken('m1', 's1', hash));
  assert.equal(r?.mid, 'm1');
  assert.equal(r?.pwv, passwordFingerprint(hash));
});

test('P0-08 リセットトークンはパスワード変更後に無効になる（使い捨て）', () => {
  const before = hashPassword('old-password');
  const token = verifyResetToken(signResetToken('m1', 's1', before))!;
  // 同じパスワードでも hash は毎回ソルトが変わるので、再設定すれば指紋は変わる
  const after = hashPassword('new-password');
  assert.notEqual(token.pwv, passwordFingerprint(after));
  assert.equal(token.pwv, passwordFingerprint(before));
});

test('P0-08 他サイトの鍵で署名されたトークンは通らない', () => {
  const foreign = jwt.sign(
    { mid: 'm1', sid: 's1', email: 'a@example.com', typ: 'member' },
    'someone-elses-secret',
    { issuer: 'laruvisona-members', audience: 'site-members', expiresIn: '30d' }
  );
  assert.equal(verifyMemberToken(foreign), null);
});

// ── 管理者セッション: ADMIN_SECRET そのものを Cookie に入れない ──────────
test('管理者セッションは署名済みで、生の ADMIN_SECRET は通らない', async () => {
  const session = await createAdminSession();
  assert.ok(session);
  assert.equal(await verifyAdminSession(session), true);
  // 旧実装の Cookie（ADMIN_SECRET そのもの）は無効
  assert.equal(await verifyAdminSession(process.env.ADMIN_SECRET!), false);
  assert.equal(await verifyAdminSession(''), false);
  assert.equal(await verifyAdminSession('v1.9999999999999.deadbeef'), false);
});

test('管理者セッションは期限切れ・改ざんで無効になる', async () => {
  const expired = await createAdminSession(-60);
  assert.equal(await verifyAdminSession(expired), false);

  const valid = (await createAdminSession())!;
  const [v, exp, sig] = valid.split('.');
  // 期限だけ伸ばしても署名が合わない
  assert.equal(await verifyAdminSession(`${v}.${Number(exp) + 86_400_000}.${sig}`), false);
});

test('Cookie ヘッダーから admin_session だけを取り出す', () => {
  assert.equal(readAdminCookie('a=1; admin_session=v1.2.3; b=4'), 'v1.2.3');
  assert.equal(readAdminCookie('other_admin_session=x'), null);
  assert.equal(readAdminCookie(null), null);
});
