import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { redact, safeErrorMessage } from '../lib/api-error.ts';

const root = path.join(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('URLのクエリに乗った鍵は消える', () => {
  const s = redact('Error fetching from https://generativelanguage.googleapis.com/v1beta/models/x:predictLongRunning?key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
  assert.equal(s.includes('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345'), false);
});

test('Bearerトークンは消える', () => {
  const s = redact('request failed: Authorization: Bearer abcdefghijklmnop1234567890');
  assert.equal(s.includes('abcdefghijklmnop1234567890'), false);
  assert.match(s, /<redacted>/);
});

test('JWTは消える', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop';
  const s = redact(`invalid token ${jwt} rejected`);
  assert.equal(s.includes(jwt), false);
  assert.match(s, /<redacted-jwt>/);
});

test('よくある鍵のプレフィックスは消える', () => {
  for (const k of ['sk_live_51ABCdefGHIjklMNO', 'whsec_ABCdefGHIjklMNOpqr', 'ghp_ABCdefGHIjklMNOpqrstuvwx', 'SG.ABCdefGHIjklMNOpq']) {
    const s = redact(`boom ${k} boom`);
    assert.equal(s.includes(k), false, k);
  }
});

test('URL自体も伏せる（内部ホスト名を出さない）', () => {
  const s = redact('connect ECONNREFUSED http://10.0.0.5:6379/status');
  assert.equal(s.includes('10.0.0.5'), false);
  assert.match(s, /<url>/);
});

test('長い16進トークンは消える', () => {
  const hex = 'a'.repeat(40);
  assert.equal(redact(`session ${hex}`).includes(hex), false);
});

test('safeErrorMessage は本番では詳細を出さない', () => {
  const prev = process.env.NODE_ENV;
  try {
    // NODE_ENV は defineProperty できないので代入で切り替える
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const msg = safeErrorMessage(new Error('relation \"public.sites\" does not exist'), '処理に失敗しました');
    assert.equal(msg, '処理に失敗しました');
    assert.equal(msg.includes('public.sites'), false);
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = prev;
  }
});

test('本番以外でも鍵は redact される', () => {
  const msg = safeErrorMessage(new Error('failed https://x.test/a?key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123'));
  assert.equal(msg.includes('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123'), false);
});

test('APIルートに素の String(e) レスポンスが残っていない', () => {
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name === 'route.ts') {
        const src = read(rel);
        if (/error:\s*String\(e\)/.test(src)) bad.push(rel);
        if (/error:\s*e instanceof Error \? e\.message : String\(e\)\s*[,}]/.test(src)) bad.push(rel);
      }
    }
  };
  walk('app/api');
  assert.deepEqual(bad, [], `例外をそのまま返しているルート: ${bad.join(', ')}`);
});

test('未認証で叩けるニュースレター登録はDBエラー文を返さない', () => {
  const src = read('app/api/newsletter/subscribe/route.ts');
  assert.equal(/error:\s*error\.message/.test(src), false);
  assert.match(src, /logError\('newsletter\/subscribe'/);
});

test('リポジトリに追跡されている .env は NEXT_PUBLIC_ だけ', () => {
  // .gitignore は「すでに追跡済み」のファイルには効かない。
  // ここに本物のシークレットが増えたら、このテストで気づけるようにする。
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  const keys = fs.readFileSync(p, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => l.split('=')[0].trim());
  const leaked = keys.filter(k => !k.startsWith('NEXT_PUBLIC_'));
  assert.deepEqual(leaked, [], `Gitに入る .env にシークレットが入っている: ${leaked.join(', ')}`);
});
