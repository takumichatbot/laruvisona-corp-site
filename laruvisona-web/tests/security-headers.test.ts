import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config';

test('全公開ホストへ保守的なHTTPS・MIME・参照元ヘッダーを付ける', async () => {
  assert.ok(nextConfig.headers);
  const rules = await nextConfig.headers();
  const all = rules.find(rule => rule.source === '/:path*');
  assert.ok(all);
  const headers = new Map(all.headers.map(header => [header.key, header.value]));
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('X-Permitted-Cross-Domain-Policies'), 'none');
  assert.doesNotMatch(headers.get('Strict-Transport-Security') ?? '', /includeSubDomains/i);
});
