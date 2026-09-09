// 到達確認の署名まわり。
//
// 監督レビュー(ecea9d0) R4: 固定の marker と host を返すだけの応答は、
// 別のサーバーでも同じJSONを返せるので偽装できた。
// 鍵を持たない相手が「到達できた」を成立させられないことを固定する。

import assert from 'node:assert/strict';
import test from 'node:test';

const {
  createChallenge, verifyChallenge, verifyProof, probeSecret,
} = await import('../lib/domain-probe-proof.ts');

const SECRET = 'x'.repeat(32);
const OTHER = 'y'.repeat(32);

function asQuery(c: { host: string; nonce: string; exp: number; sig: string }) {
  return { host: c.host, nonce: c.nonce, exp: String(c.exp), sig: c.sig };
}

test('鍵を持つサービスの応答だけが到達確認を成立させる', () => {
  const c = createChallenge(SECRET, 'example.com');
  const r = verifyChallenge(SECRET, asQuery(c), 'example.com');
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(verifyProof(SECRET, c, r.proof), true);
});

test('固定のJSONを返すだけのサーバーは通らない', () => {
  const c = createChallenge(SECRET, 'example.com');
  // 昔の実装が返していた形。proofが無い / 中身を真似ただけ。
  assert.equal(verifyProof(SECRET, c, ''), false);
  assert.equal(verifyProof(SECRET, c, 'laruhp-domain-probe'), false);
  assert.equal(verifyProof(SECRET, c, 'a'.repeat(64)), false);
});

test('鍵を知らないサーバーは応答署名を作れない', () => {
  const c = createChallenge(SECRET, 'example.com');
  const fake = verifyChallenge(OTHER, asQuery(c), 'example.com');
  // 別鍵では、そもそも要求の署名を検証できない
  assert.equal(fake.ok, false);
  if (!fake.ok) assert.equal(fake.reason, 'bad_sig');
});

test('別のホスト名で受けた応答は通らない', () => {
  const c = createChallenge(SECRET, 'example.com');
  const r = verifyChallenge(SECRET, asQuery(c), 'attacker.example');
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'host_mismatch');
});

test('期限切れの要求は通らない', () => {
  const c = createChallenge(SECRET, 'example.com', 0);
  const r = verifyChallenge(SECRET, asQuery(c), 'example.com', 10_000_000);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'expired');
});

test('nonceや署名が欠けた要求は通らない', () => {
  const c = createChallenge(SECRET, 'example.com');
  for (const drop of ['host', 'nonce', 'exp', 'sig'] as const) {
    const q: Record<string, string> = { ...asQuery(c) };
    delete q[drop];
    const r = verifyChallenge(SECRET, q, 'example.com');
    assert.equal(r.ok, false, `${drop} が無くても通った`);
  }
  const bad = verifyChallenge(SECRET, { ...asQuery(c), nonce: 'zz' }, 'example.com');
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, 'bad_nonce');
});

test('同じ要求でも毎回nonceが変わる', () => {
  const a = createChallenge(SECRET, 'example.com');
  const b = createChallenge(SECRET, 'example.com');
  assert.notEqual(a.nonce, b.nonce);
  assert.notEqual(a.sig, b.sig);
});

test('鍵が短い・未設定なら到達確認を行わない', () => {
  const prev = process.env.DOMAIN_PROBE_SECRET;
  delete process.env.DOMAIN_PROBE_SECRET;
  assert.equal(probeSecret(), null);
  process.env.DOMAIN_PROBE_SECRET = 'short';
  assert.equal(probeSecret(), null);
  process.env.DOMAIN_PROBE_SECRET = SECRET;
  assert.equal(probeSecret(), SECRET);
  if (prev === undefined) delete process.env.DOMAIN_PROBE_SECRET;
  else process.env.DOMAIN_PROBE_SECRET = prev;
});
