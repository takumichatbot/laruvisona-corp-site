import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isPrivateAddress, validateUrlShape, assertUrlAllowed, BlockedUrlError,
} from '../lib/safe-fetch.ts';

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('内部アドレスは全部ブロックされる', () => {
  const blocked = [
    '127.0.0.1', '127.1.1.1', '0.0.0.0',
    '169.254.169.254',
    '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '100.64.0.1',
    '192.0.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fd00::1', 'fc00::1', 'fe80::1', 'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    '2002:7f00:0001::',
    '64:ff9b::7f00:1',
    'not-an-ip', '',
  ];
  for (const ip of blocked) {
    assert.equal(isPrivateAddress(ip), true, ip + ' はブロックされるべき');
  }
});

test('普通の公開アドレスは通る', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip + ' は通るべき');
  }
});

test('http/https以外のスキームは拒否', () => {
  for (const u of ['file:///etc/passwd', 'ftp://example.com/', 'gopher://example.com/']) {
    assert.throws(() => validateUrlShape(u), (e: unknown) =>
      e instanceof BlockedUrlError && e.code === 'bad_protocol', u);
  }
});

test('80/443以外のポートは拒否', () => {
  assert.throws(() => validateUrlShape('http://example.com:22/'), (e: unknown) =>
    e instanceof BlockedUrlError && e.code === 'bad_port');
  assert.throws(() => validateUrlShape('http://example.com:6379/'), (e: unknown) =>
    e instanceof BlockedUrlError && e.code === 'bad_port');
  assert.doesNotThrow(() => validateUrlShape('https://example.com/'));
  assert.doesNotThrow(() => validateUrlShape('http://example.com:80/'));
});

test('URLに認証情報が入っていたら拒否', () => {
  assert.throws(() => validateUrlShape('http://user:pass@example.com/'), (e: unknown) =>
    e instanceof BlockedUrlError && e.code === 'credentials_in_url');
});

test('名前で分かる内部ホストは拒否（末尾ドットでも抜けられない）', () => {
  for (const u of [
    'http://localhost/', 'http://localhost./', 'http://LOCALHOST/',
    'http://metadata.google.internal/', 'http://anything.internal/',
    'http://printer.local/', 'http://x.home.arpa/',
  ]) {
    assert.throws(() => validateUrlShape(u), (e: unknown) =>
      e instanceof BlockedUrlError && e.code === 'blocked_host', u);
  }
});

test('IPリテラルの内部アドレスはDNSなしで拒否', async () => {
  for (const u of [
    'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/', 'http://[::1]/', 'http://[fd00::1]/',
  ]) {
    await assert.rejects(assertUrlAllowed(u), (e: unknown) =>
      e instanceof BlockedUrlError && e.code === 'private_address', u);
  }
});

test('公開IPリテラルはDNSなしで通る', async () => {
  const shape = await assertUrlAllowed('https://93.184.216.34/x');
  assert.equal(shape.port, 443);
});

test('scan-url は素のfetchを使っていない', () => {
  const src = read('app/api/ai/scan-url/route.ts');
  assert.match(src, /from '@\/lib\/safe-fetch'/);
  assert.equal(/await fetch\(/.test(src), false, 'safeFetch を経由すること');
  assert.match(src, /BlockedUrlError/);
});

test('お問い合わせWebhookも素のfetchを使っていない', () => {
  const src = read('app/api/contact/route.ts');
  assert.match(src, /from '@\/lib\/safe-fetch'/);
  assert.match(src, /await safeFetch\(webhookUrl/);
  assert.equal(/await fetch\(webhookUrl/.test(src), false);
});
