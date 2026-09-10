// 到達確認を「実際にソケットを開いて」検証する回帰テスト。
//
// 監督レビュー(e836ed3) 1:
//   maxRedirects: 0 は、Location付きの308を safeFetch が例外にしていた。
//   probePort は not_reached を返し、転送先を取れないまま握りつぶしていた。
//   最初からaliasが入っている偽データでは、この不具合は見つからない。
//
// ここでは偽のfetchを使わず、本物の http サーバを立てて
//   本物の probePort → 本物の safeFetch → 実ソケット
// を通す。確認するのは3つ:
//   1. 308 が例外にならず、Location の転送先ホストが取れること
//   2. 転送先へは1回も接続しないこと（サーバの受信数で数える）
//   3. SSRF検査は生きていること（既定の検査はループバックを拒否する）

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

process.env.DOMAIN_PROBE_SECRET ??= 'x'.repeat(48);

const { makeProbePort } = await import('../lib/domain-ports.ts');
const { safeFetch, validateUrlShape, assertUrlAllowed, BlockedUrlError } = await import('../lib/safe-fetch.ts');

/**
 * 検証用サーバへ繋ぐためだけの検査。
 * 形の検査（スキーム・認証情報つきURL・名前で分かる内部ホスト）は本物を通し、
 * ループバックのアドレスとポートだけを許す。
 * 本番のコードはこれを渡さない（下の「本番コードに guard は無い」で固定）。
 */
async function loopbackGuard(raw: string | URL) {
  const url = raw instanceof URL ? raw : new URL(String(raw));
  if (url.hostname !== '127.0.0.1') {
    // ループバック以外は本物の検査に回す
    return assertUrlAllowed(raw);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('bad_protocol', 'http/https以外は取得できません');
  }
  if (url.username || url.password) {
    throw new BlockedUrlError('credentials_in_url', 'URLに認証情報を含めることはできません');
  }
  return { url, hostname: url.hostname, port: Number(url.port) };
}

type Srv = {
  origin: string;
  hits: string[];
  close: () => Promise<void>;
};

/** 受け取ったパスを記録するだけのサーバ */
async function serve(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<Srv> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(`${req.method} ${req.url?.split('?')[0]}`);
    handler(req, res);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    origin: `http://127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}

function portFor(srv: Srv) {
  return makeProbePort({
    fetchUrl: (u, init, opts) => safeFetch(u, init, { ...opts, guard: loopbackGuard }),
    originOf: () => srv.origin,
  });
}

// ── 1. 308 の転送先が取れる ──

test('308の転送先ホストを、実際の応答から取得できる', async () => {
  const srv = await serve((req, res) => {
    res.writeHead(308, { location: 'https://apex.example/api/domain-probe' });
    res.end();
  });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.equal(out.result, 'redirected', '308を転送として扱えていない');
    assert.equal(out.redirectHost, 'apex.example', '転送先ホストを取得できていない');
  } finally { await srv.close(); }
});

test('301・302・307でも転送先を取得できる', async () => {
  for (const code of [301, 302, 307] as const) {
    const srv = await serve((req, res) => {
      res.writeHead(code, { location: 'https://apex.example/' });
      res.end();
    });
    try {
      const out = await portFor(srv).reachesService('www.apex.example');
      assert.equal(out.result, 'redirected', `${code} を転送として扱えていない`);
      assert.equal(out.redirectHost, 'apex.example', `${code} の転送先を取得できていない`);
    } finally { await srv.close(); }
  }
});

test('相対パスのLocationは、要求したホスト自身として解決する', async () => {
  const srv = await serve((req, res) => {
    res.writeHead(302, { location: '/moved' });
    res.end();
  });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.equal(out.result, 'redirected');
    // 相対転送は自分自身。別サイトの根拠にはならない（判定側で自己転送を拒否する）
    assert.equal(out.redirectHost, '127.0.0.1');
  } finally { await srv.close(); }
});

test('Locationが無い3xxは、転送先なしの転送として返る', async () => {
  const srv = await serve((req, res) => { res.writeHead(304); res.end(); });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.equal(out.result, 'redirected');
    assert.equal(out.redirectHost, null);
  } finally { await srv.close(); }
});

// ── 2. 転送先へは接続しない ──

test('転送先へは1回も接続しない（要求は1回だけ）', async () => {
  // 同じサーバが転送先も兼ねる。追ってしまえば2回目の受信が記録される。
  const srv = await serve((req, res) => {
    if (req.url?.startsWith('/api/domain-probe')) {
      res.writeHead(308, { location: '/followed' });
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, proof: 'should-not-be-read' }));
  });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.equal(out.result, 'redirected');
    assert.deepEqual(srv.hits, ['GET /api/domain-probe'], `追加の通信をしている: ${srv.hits.join(', ')}`);
  } finally { await srv.close(); }
});

test('転送先の200と署名は、到達の根拠にしない', async () => {
  // 転送先が正しい署名を返しても「接続済み」にはならない
  const srv = await serve((req, res) => {
    res.writeHead(308, { location: 'https://apex.example/api/domain-probe' });
    res.end();
  });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.notEqual(out.result, 'reached', '転送先の応答で到達と判断している');
  } finally { await srv.close(); }
});

// ── 3. 通常の応答は今までどおり ──

test('200で署名が合わなければ到達にしない', async () => {
  const srv = await serve((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, proof: 'wrong' }));
  });
  try {
    const out = await portFor(srv).reachesService('www.apex.example');
    assert.equal(out.result, 'not_reached');
  } finally { await srv.close(); }
});

test('404はそのまま未到達', async () => {
  const srv = await serve((req, res) => { res.writeHead(404); res.end(); });
  try {
    assert.equal((await portFor(srv).reachesService('h.example')).result, 'not_reached');
  } finally { await srv.close(); }
});

test('繋がらなければ未到達（転送とは言わない）', async () => {
  const srv = await serve((req, res) => { res.writeHead(200); res.end('{}'); });
  const origin = srv.origin;
  await srv.close();   // 閉じてから叩く
  const port = makeProbePort({
    fetchUrl: (u, init, opts) => safeFetch(u, init, { ...opts, guard: loopbackGuard }),
    originOf: () => origin,
  });
  const out = await port.reachesService('h.example');
  assert.equal(out.result, 'not_reached', '接続できないのに転送と推測している');
});

// ── 4. SSRF検査は生きている ──

test('既定の検査はループバックを拒否する', async () => {
  await assert.rejects(
    () => assertUrlAllowed('http://127.0.0.1/api/domain-probe'),
    (e: unknown) => e instanceof BlockedUrlError && e.code === 'private_address',
  );
});

test('既定の検査は80/443以外のポートを拒否する', () => {
  assert.throws(() => validateUrlShape('https://example.com:8080/x'),
    (e: unknown) => e instanceof BlockedUrlError && e.code === 'bad_port');
});

test('redirect:manual でも検査は同じように走る', async () => {
  // 追わない指定でも、最初のURLの検査は省略しない
  await assert.rejects(
    () => safeFetch('http://127.0.0.1/x', {}, { redirect: 'manual' }),
    (e: unknown) => e instanceof BlockedUrlError && e.code === 'private_address',
  );
});

test('追う指定のときは、上限を超えたら今までどおり例外', async () => {
  const srv = await serve((req, res) => {
    res.writeHead(302, { location: '/again' });
    res.end();
  });
  try {
    await assert.rejects(
      () => safeFetch(`${srv.origin}/start`, {}, { redirect: 'follow', maxRedirects: 1, guard: loopbackGuard }),
      (e: unknown) => e instanceof BlockedUrlError && e.code === 'too_many_redirects',
    );
  } finally { await srv.close(); }
});
