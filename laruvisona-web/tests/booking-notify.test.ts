// P0-07 の回帰テスト。
// 匿名の予約リクエストが指定した Origin へ内部秘密ヘッダーを送らせられないことを確認する。
// 実際の HTTP は行わず、globalThis.fetch を差し替えて宛先とヘッダーだけを見る。

import assert from 'node:assert/strict';
import test from 'node:test';

process.env.RETENTION_SECRET = 'test-internal-secret';
process.env.PORT = '3123';
delete process.env.INTERNAL_API_BASE_URL;

const { finalizeBooking } = await import('../lib/booking-finalize.ts');

interface Captured { url: string; headers: Record<string, string> }

function captureFetch(status = 200) {
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify({ ok: status < 400 }), { status });
  }) as typeof fetch;
  return calls;
}

const booking = {
  siteId: 'site-1',
  name: '予約者',
  email: 'guest@example.com',
  slotId: 'slot-1',
  slotDatetime: '2026-10-01T01:00:00.000Z',
  prepaid: false,
};

test('P0-07 通知はループバックにだけ送られる（外部ドメインへは送らない）', async () => {
  const calls = captureFetch();
  await finalizeBooking(booking);

  assert.equal(calls.length, 1);
  const target = new URL(calls[0].url);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '3123');
  assert.equal(target.pathname, '/api/contact');
});

test('P0-07 内部秘密ヘッダーは外部ホストへ出ない', async () => {
  const calls = captureFetch();
  await finalizeBooking(booking);

  const { url, headers } = calls[0];
  assert.equal(headers['x-internal-secret'], process.env.RETENTION_SECRET);
  // 秘密が付くのは内部宛先だけ
  assert.ok(url.startsWith('http://127.0.0.1:'));
});

test('P0-07 呼び出し側は宛先 URL を渡せない（型と実挙動の両方）', async () => {
  const calls = captureFetch();
  // 攻撃者 Origin を紛れ込ませても宛先には影響しない
  await finalizeBooking({ ...booking, baseUrl: 'https://attacker.example' } as never);

  assert.ok(new URL(calls[0].url).hostname === '127.0.0.1');
  assert.ok(!calls[0].url.includes('attacker.example'));
});

test('通知が失敗したら false を返す（成功として扱わない）', async () => {
  captureFetch(500);
  assert.equal(await finalizeBooking(booking), false);

  globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
  assert.equal(await finalizeBooking(booking), false);
});

test('通知が成功したら true を返す', async () => {
  captureFetch(200);
  assert.equal(await finalizeBooking(booking), true);
});

test('INTERNAL_API_BASE_URL を設定するとその宛先になる', async () => {
  process.env.INTERNAL_API_BASE_URL = 'http://internal.svc:8080/';
  const calls = captureFetch();
  await finalizeBooking(booking);
  assert.equal(calls[0].url, 'http://internal.svc:8080/api/contact');
  delete process.env.INTERNAL_API_BASE_URL;
});
