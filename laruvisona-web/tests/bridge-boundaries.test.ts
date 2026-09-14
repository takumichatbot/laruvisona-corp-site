import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readBridgeForm } from '../lib/bridge-input.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Mac即時実行とGitHub操作は入力・秘密比較・待ち時間を有限化する', () => {
  const quick = read('../app/api/bridge/quick/route.ts');
  const github = read('../app/api/bridge/github/route.ts');
  assert.match(quick, /verifySharedSecret/);
  assert.match(quick, /readBridgeJson\(req, 32_000\)/);
  assert.match(quick, /slice\(-100\)/);
  assert.doesNotMatch(quick, /body\.secret !== adminSecret|req\.json\(\)/);
  assert.match(github, /readBridgeJson\(req, 32_000\)/);
  assert.match(github, /AbortSignal\.timeout\(15_000\)/);
  assert.match(github, /REQUEST_CHANGES/);
  assert.doesNotMatch(github, /req\.json\(\)|await res\.text\(\)/);
});

test('管理ファイルと音声はmultipart本文を読込中に停止する', async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('1234567890')); controller.close(); },
  });
  const request = new Request('https://example.test', {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  await assert.rejects(() => readBridgeForm(request, 5), /too_large/);
  for (const path of ['../app/api/bridge/upload/route.ts', '../app/api/bridge/voice/route.ts']) {
    const source = read(path);
    assert.match(source, /readBridgeForm/);
    assert.doesNotMatch(source, /req\.formData\(\)/);
  }
});

test('一時共有は本文と保持件数と期限を制限する', () => {
  const source = read('../app/api/bridge/share/route.ts');
  assert.match(source, /readBridgeJson\(req, 16_000\)/);
  assert.match(source, /while \(shares\.size >= 100\)/);
  assert.match(source, /3_600_000/);
  assert.doesNotMatch(source, /req\.json\(\)|setTimeout\(/);
});
