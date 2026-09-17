import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { localEndpoint } from '../lib/stripe';

/**
 * Stripeの宛先を差し替えられるようにしたので、その安全弁を固定する。
 *
 * 人の手なしで申し込みを通すために、Stripeを手元の替え玉へ向けられるようにした。
 * **ここが緩むと、本番の鍵のまま請求が別の宛先へ飛ぶ。**
 * 効かせる条件は2つだけ（本番鍵でない・ループバック宛）で、
 * どちらか一方でも欠けたら何もしない。
 */

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const saved = { base: process.env.STRIPE_API_BASE, key: process.env.STRIPE_SECRET_KEY };
  try {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    run();
  } finally {
    if (saved.base === undefined) delete process.env.STRIPE_API_BASE; else process.env.STRIPE_API_BASE = saved.base;
    if (saved.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = saved.key;
  }
}

test('既定では、差し替えない', () => {
  withEnv({ STRIPE_API_BASE: undefined, STRIPE_SECRET_KEY: 'sk_test_x' }, () => {
    assert.equal(localEndpoint(), null);
  });
});

test('本番の鍵では、絶対に差し替えない', () => {
  // ここが効かないと、実際の請求が替え玉へ飛ぶ
  withEnv({ STRIPE_API_BASE: 'http://127.0.0.1:54998', STRIPE_SECRET_KEY: 'sk_live_realkey' }, () => {
    assert.equal(localEndpoint(), null, '本番の鍵で宛先を差し替えている');
  });
});

test('ループバック以外へは、差し替えない', () => {
  for (const base of [
    'http://evil.example',
    'https://api.stripe.com.evil.example',
    'http://192.168.1.10:54998',
    'http://[::ffff:127.0.0.1]:54998',
    'not a url',
  ]) {
    withEnv({ STRIPE_API_BASE: base, STRIPE_SECRET_KEY: 'sk_test_x' }, () => {
      assert.equal(localEndpoint(), null, `${base} を受け入れている`);
    });
  }
});

test('手元の替え玉へは差し替える', () => {
  withEnv({ STRIPE_API_BASE: 'http://127.0.0.1:54998', STRIPE_SECRET_KEY: 'sk_test_x' }, () => {
    assert.deepEqual(localEndpoint(), { host: '127.0.0.1', port: 54998, protocol: 'http' });
  });
  withEnv({ STRIPE_API_BASE: 'http://localhost:54998', STRIPE_SECRET_KEY: 'sk_test_x' }, () => {
    assert.deepEqual(localEndpoint(), { host: 'localhost', port: 54998, protocol: 'http' });
  });
});

test('検証の道具が、本番の値を持っていない', () => {
  const runner = fs.readFileSync(new URL('../tests/billing/run.sh', import.meta.url), 'utf8');
  // 替え玉の鍵はすべて偽物であること。本物を書くと、リポジトリに鍵が残る。
  assert.match(runner, /STRIPE_SECRET_KEY="sk_test_/);
  assert.doesNotMatch(runner, /sk_live|whsec_[A-Za-z0-9]{24,}|re_[A-Za-z0-9]{20,}/);
  // 外へ出ないこと
  assert.doesNotMatch(runner, /api\.stripe\.com|api\.resend\.com|larubot\.tokyo/);
  const fixture = fs.readFileSync(new URL('../tests/billing/fixture.cjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fixture, /sk_live|https:\/\/api\./);
});
