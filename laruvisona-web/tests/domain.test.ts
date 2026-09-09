// 独自ドメインの正規化・所有確認・状態判定の回帰テスト。
//
// ここで固定したいのは、Codexの指摘で挙がった穴がふさがっていること:
//   - CNAMEの部分一致で別のRenderサービスが「確認済み」になっていた
//   - 共有Aレコードへの一致だけを所有の証明にしていた
//   - 所有確認・DNS接続・SSL準備完了をひとつの verified に潰していた
//
// 外部サービスへは接続しない。

import assert from 'node:assert/strict';
import test from 'node:test';

const {
  normalizeDomain, wwwSibling, isReservedHost,
  challengeRecordName, challengeRecordValue, generateVerificationToken,
  checkOwnership, cnameMatchesTarget, checkPointsHere, deriveStatus,
  dnsInstructions, isServable, statusLabel,
} = await import('../lib/domain.ts');

// ── 正規化 ──

test('スキーム・パス・ポート・大文字・末尾ドットを落として1つのホストにする', () => {
  for (const input of [
    'https://Example.com/path?a=1',
    '  example.com.  ',
    'http://example.com:8443',
    'EXAMPLE.COM',
  ]) {
    const r = normalizeDomain(input);
    assert.equal(r.ok, true, `失敗: ${input}`);
    if (r.ok) assert.equal(r.value.host, 'example.com', `不一致: ${input}`);
  }
});

test('IDNはpunycodeに変換して保存する', () => {
  const r = normalizeDomain('日本語.jp');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.match(r.value.host, /^xn--/);
    assert.equal(r.value.display, '日本語.jp');
  }
});

test('ホスト名として不正なものを弾く', () => {
  const bad = [
    '', '   ', 'example', 'exa mple.com', '-example.com', 'example-.com',
    'example..com', 'example.c', '192.168.0.1', '127.0.0.1', '[::1]',
    'a'.repeat(64) + '.com',
    'exam_ple.com',
  ];
  for (const b of bad) {
    const r = normalizeDomain(b);
    assert.equal(r.ok, false, `通ってしまった: ${JSON.stringify(b)}`);
  }
});

test('文字列以外は弾く', () => {
  for (const v of [null, undefined, 123, {}, []]) {
    assert.equal(normalizeDomain(v).ok, false);
  }
});

test('wwwの有無を相互に導ける', () => {
  assert.equal(wwwSibling('example.com'), 'www.example.com');
  assert.equal(wwwSibling('www.example.com'), 'example.com');
  assert.equal(wwwSibling('www.co.jp'), 'co.jp');
});

// ── 予約ホスト ──

test('自社の配信基盤・管理ドメインは顧客ドメインとして受け付けない', () => {
  const main = 'https://laruvisona.jp';
  for (const h of [
    'laruvisona.jp', 'www.laruvisona.jp', 'shop.laruvisona.jp',
    'foo.onrender.com', 'onrender.com', 'larubot.tokyo', 'x.larubot.tokyo',
    'something.local', 'app.internal',
  ]) {
    assert.equal(isReservedHost(h, main), true, `予約されていない: ${h}`);
  }
  assert.equal(isReservedHost('example.com', main), false);
  assert.equal(isReservedHost('salon-example.jp', main), false);
});

// ── 所有確認 ──

test('所有確認はテナント固有のトークン一致でのみ成立する', () => {
  const token = 'abc123';
  const name = challengeRecordName('example.com');
  assert.equal(name, '_laruhp-challenge.example.com');

  assert.equal(checkOwnership([challengeRecordValue(token)], token), true);
  // 引用符付きで返ってくるDNSサーバもある
  assert.equal(checkOwnership([`"${challengeRecordValue(token)}"`], token), true);
  // 他人のトークン
  assert.equal(checkOwnership([challengeRecordValue('other')], token), false);
  // プレフィックスだけ合っていてもだめ
  assert.equal(checkOwnership(['laruhp-site-verification='], token), false);
  // 部分一致で通さない
  assert.equal(checkOwnership([`x${challengeRecordValue(token)}`], token), false);
  assert.equal(checkOwnership([`${challengeRecordValue(token)}extra`], token), false);
  // SPFなど無関係なTXTが混ざっていても誤判定しない
  assert.equal(checkOwnership(['v=spf1 include:_spf.google.com ~all'], token), false);
  assert.equal(checkOwnership([], token), false);
  assert.equal(checkOwnership([challengeRecordValue('')], ''), false);
});

test('トークンは推測できない長さで、毎回異なる', () => {
  const a = generateVerificationToken();
  const b = generateVerificationToken();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{32}$/);
});

// ── 向き先 ──

test('CNAMEは部分一致ではなく完全一致で判定する', () => {
  const target = 'laruvisona-corp-site.onrender.com';
  assert.equal(cnameMatchesTarget([target], target), true);
  assert.equal(cnameMatchesTarget([`${target}.`], target), true);      // 末尾ドット
  assert.equal(cnameMatchesTarget([target.toUpperCase()], target), true);

  // ここが以前の穴。includes() だと全部通っていた。
  assert.equal(cnameMatchesTarget(['someone-else.onrender.com'], target), false);
  assert.equal(cnameMatchesTarget(['evil-laruvisona-corp-site.onrender.com'], target), false);
  assert.equal(cnameMatchesTarget([`${target}.attacker.example`], target), false);
  assert.equal(cnameMatchesTarget([], target), false);
  // 期待値が未設定なら通さない
  assert.equal(cnameMatchesTarget([target], ''), false);
});

test('CNAMEが見えなくてもAレコードで向き先を判断できる', () => {
  const opts = { expectedTarget: 'svc.onrender.com', expectedApexIps: ['216.24.57.1'] };
  const viaA = checkPointsHere({ txt: [], cname: [], a: ['216.24.57.1'] }, opts);
  assert.equal(viaA.pointsHere, true);
  assert.equal(viaA.how, 'a');

  const viaCname = checkPointsHere({ txt: [], cname: ['svc.onrender.com'], a: [] }, opts);
  assert.equal(viaCname.how, 'cname');

  const none = checkPointsHere({ txt: [], cname: ['other.example'], a: ['1.2.3.4'] }, opts);
  assert.equal(none.pointsHere, false);
  assert.equal(none.how, null);
});

// ── 状態 ──

test('所有確認・向き先・SSLを別々の事実として状態にする', () => {
  assert.equal(deriveStatus({ ownership: false, pointsHere: true, renderVerified: true, tlsReady: true }), 'pending_ownership');
  assert.equal(deriveStatus({ ownership: true, pointsHere: false, renderVerified: null, tlsReady: null }), 'pending_dns');
  assert.equal(deriveStatus({ ownership: true, pointsHere: true, renderVerified: false, tlsReady: null }), 'ssl_pending');
  assert.equal(deriveStatus({ ownership: true, pointsHere: true, renderVerified: true, tlsReady: false }), 'ssl_pending');
  assert.equal(deriveStatus({ ownership: true, pointsHere: true, renderVerified: true, tlsReady: true }), 'connected');
});

test('共有Aレコードへの一致だけでは接続済みにならない', () => {
  // Renderの共有IPは誰でも向けられる。所有確認が無ければ接続済みにしない。
  const points = checkPointsHere(
    { txt: [], cname: [], a: ['216.24.57.1'] },
    { expectedTarget: 'svc.onrender.com', expectedApexIps: ['216.24.57.1'] },
  );
  const status = deriveStatus({ ownership: false, pointsHere: points.pointsHere, renderVerified: true, tlsReady: true });
  assert.equal(status, 'pending_ownership');
});

test('配信してよい状態は connected と legacy だけ', () => {
  assert.equal(isServable('connected'), true);
  assert.equal(isServable('legacy'), true);
  for (const s of ['pending_ownership', 'pending_dns', 'ssl_pending', 'failed'] as const) {
    assert.equal(isServable(s), false, `配信されてしまう: ${s}`);
  }
});

test('すべての状態に「次にやること」がある', () => {
  for (const s of ['pending_ownership', 'pending_dns', 'ssl_pending', 'connected', 'failed', 'legacy'] as const) {
    const l = statusLabel(s);
    assert.ok(l.label.length > 0, s);
    assert.ok(l.next.length > 0, s);
  }
});

// ── 画面に出すDNS手順 ──

test('DNS手順に、種類・名前・値がそろっている', () => {
  const rows = dnsInstructions('example.com', 'tok', { expectedTarget: 'svc.onrender.com', expectedApexIp: '216.24.57.1' });
  for (const r of rows) {
    assert.ok(r.type && r.name && r.value, JSON.stringify(r));
  }
  const txt = rows.find(r => r.type === 'TXT');
  assert.ok(txt, 'TXTの手順が無い');
  assert.equal(txt.name, '_laruhp-challenge.example.com');
  // 既存のメール設定を壊さない案内が必要
  assert.match(txt.note || '', /消さず|残して/);
});

test('ルートドメインはA、サブドメインはCNAMEを案内する', () => {
  const apex = dnsInstructions('example.com', 't', { expectedTarget: 'svc.onrender.com', expectedApexIp: '216.24.57.1' });
  assert.equal(apex.find(r => r.purpose === '配信先')?.type, 'A');

  const sub = dnsInstructions('www.example.com', 't', { expectedTarget: 'svc.onrender.com', expectedApexIp: '216.24.57.1' });
  const s = sub.find(r => r.purpose === '配信先');
  assert.equal(s?.type, 'CNAME');
  assert.equal(s?.value, 'svc.onrender.com');
});
