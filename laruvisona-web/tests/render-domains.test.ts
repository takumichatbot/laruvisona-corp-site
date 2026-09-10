// Render アダプター（lib/render-domains.ts）を、実際の関数を呼んで検証する。
//
// 監督レビュー(ce05e76) R2: findDomain が limit=100 の1ページしか見ておらず、
// 101件目以降にある対象を「存在しない」と返していた。
// 外部IDを保存していない解除では、これを不存在と扱って
// 外部登録を残したままDBの行を消せてしまう。
//
// グローバルの fetch を差し替えて、実アダプターをそのまま実行する。

import assert from 'node:assert/strict';
import test from 'node:test';

const { findDomain } = await import('../lib/render-domains.ts');

const CFG = { apiKey: 'test-key', serviceId: 'srv-test' };

/** Render の一覧APIの形（[{ customDomain, cursor }]） */
function page(names: string[], startIndex = 0) {
  return names.map((name, i) => ({
    customDomain: { id: `rd-${name}`, name, verificationStatus: 'verified' },
    cursor: `c${startIndex + i}`,
  }));
}

type Handler = (url: URL) => { status?: number; body?: unknown; raw?: string };

function stubFetch(handler: Handler) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const r = handler(url);
    const body = r.raw !== undefined ? r.raw : JSON.stringify(r.body ?? []);
    return new Response(body, {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { calls, restore() { globalThis.fetch = original; } };
}

test('name フィルタで見つかればそれを返す', async () => {
  const s = stubFetch(url => {
    if (url.searchParams.get('name') === 'target.example') return { body: page(['target.example']) };
    return { body: [] };
  });
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.domain?.id, 'rd-target.example');
  } finally { s.restore(); }
});

test('101件以上あっても、2ページ目以降の対象を見つける', async () => {
  // name フィルタが効かない（無視される）サーバーを想定
  const first = Array.from({ length: 100 }, (_, i) => `other${i}.example`);
  const second = ['target.example'];
  const s = stubFetch(url => {
    const cursor = url.searchParams.get('cursor');
    if (url.searchParams.get('name') && !cursor) return { body: [] }; // nameフィルタ無視
    if (!cursor) return { body: page(first, 0) };
    return { body: page(second, 100) };
  });
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, true, '2ページ目の対象を見つけられていない');
    if (r.ok) assert.equal(r.domain?.id, 'rd-target.example');
    assert.ok(s.calls.length >= 2, 'ページを辿っていない');
  } finally { s.restore(); }
});

test('最後まで見て存在しないときだけ「存在しない」を返す', async () => {
  const s = stubFetch(url => {
    if (url.searchParams.get('name')) return { body: [] };
    if (url.searchParams.get('cursor')) return { body: [] };
    return { body: page(['a.example', 'b.example']) };   // 100件未満＝最終ページ
  });
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.domain, null);
  } finally { s.restore(); }
});

test('続きがあるのに辿れないときは「存在しない」にしない', async () => {
  // 100件返ってくるが cursor が無い（＝続きを辿れない）
  const s = stubFetch(url => {
    if (url.searchParams.get('name')) return { body: [] };
    const full = Array.from({ length: 100 }, (_, i) => ({
      customDomain: { id: `rd-${i}`, name: `x${i}.example` },
      // cursor を付けない
    }));
    return { body: full };
  });
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, false, '確認しきれていないのに結果を確定させている');
    if (!r.ok) assert.equal(r.reason, 'incomplete');
  } finally { s.restore(); }
});

test('壊れた応答を「存在しない」に変換しない', async () => {
  for (const raw of ['not json at all', '{"unexpected":"shape"}', '']) {
    const s = stubFetch(() => ({ raw }));
    try {
      const r = await findDomain(CFG, 'target.example');
      assert.equal(r.ok, false, `壊れた応答を通した: ${raw}`);
      if (!r.ok) assert.ok(r.reason === 'malformed' || r.reason === 'api_error');
    } finally { s.restore(); }
  }
});

test('APIエラーを「存在しない」に変換しない', async () => {
  for (const status of [401, 429, 500, 503]) {
    const s = stubFetch(() => ({ status, body: { message: 'err' } }));
    try {
      const r = await findDomain(CFG, 'target.example');
      assert.equal(r.ok, false, `${status} を通した`);
      if (!r.ok) assert.equal(r.reason, 'api_error');
    } finally { s.restore(); }
  }
});

test('見つかってもIDが無ければ「存在しない」とは別に扱う', async () => {
  const s = stubFetch(url => {
    if (url.searchParams.get('name')) {
      return { body: [{ customDomain: { name: 'target.example' } }] }; // id なし
    }
    return { body: [] };
  });
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, false, 'IDが無いのに使えるものとして返している');
    if (!r.ok) assert.equal(r.reason, 'incomplete');
  } finally { s.restore(); }
});

test('接続できないときも「存在しない」にしない', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
  try {
    const r = await findDomain(CFG, 'target.example');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'api_error');
  } finally { globalThis.fetch = original; }
});
