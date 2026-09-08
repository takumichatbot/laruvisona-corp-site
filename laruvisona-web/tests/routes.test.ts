import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// アプリ内リンクが実在するページを指しているかを機械的に確かめる。
//
// なぜ必要か:
// Next.js は動的ルート（例 app/laruHP/[industry]/page.tsx）を持つので、
// /laruHP/login のような存在しないパスも「型としては」[industry] に吸われる。
// ビルドは通るし型検査も通る。実際に開いたときだけ404になる。
// 実際に2件やらかした:
//   - /laruHP/login            … 正しくは /laruHP/auth/login（このページの案内リンク）
//   - /laruHP/builder/new      … そんなルートは無い（エージェンシー画面の新規作成ボタン）
// どちらも「押すまで気づけない」種類の壊れ方なので、ここで固定する。
//
// 判定は厳しめにする。文字列で直接書かれたリンクは、静的なページか
// public/ の実ファイルに完全一致すること。動的セグメントに吸われるだけの
// パスは通さない（それこそが上の2件の壊れ方だったため）。
// 変数を埋め込むリンク（`/laruHP/builder?siteId=${id}` など）は
// テンプレートリテラルなのでここでは拾わない。

const root = path.join(import.meta.dirname, '..');

function walk(dir: string, hit: (full: string, rel: string) => void) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, hit);
    else hit(full, path.relative(root, full));
  }
}

/** app/ 配下から、動的セグメントを含まないページのパスを集める */
function staticRoutes(): Set<string> {
  const out = new Set<string>();
  walk(path.join(root, 'app'), full => {
    if (path.basename(full) !== 'page.tsx') return;
    const rel = path.relative(path.join(root, 'app'), path.dirname(full));
    const seg = rel === '' ? [] : rel.split(path.sep).filter(s => !(s.startsWith('(') && s.endsWith(')')));
    const p = seg.length ? `/${seg.join('/')}` : '/';
    if (!p.includes('[')) out.add(p);
  });
  return out;
}

function publicFiles(): Set<string> {
  const out = new Set<string>();
  const dir = path.join(root, 'public');
  if (!fs.existsSync(dir)) return out;
  walk(dir, full => out.add('/' + path.relative(dir, full).split(path.sep).join('/')));
  return out;
}

test('アプリ内リンクは実在するページを指している', () => {
  const routes = staticRoutes();
  const files = publicFiles();
  const bad: string[] = [];
  const re = /(?:href|action)\s*=\s*["'](\/[^"'{}?#]*)/g;

  walk(path.join(root, 'app'), (full, rel) => {
    if (!/\.(tsx|jsx)$/.test(full)) return;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const url = m[1].replace(/\/+$/, '') || '/';
        if (url.startsWith('/api/') || url.startsWith('/_next')) continue;
        if (routes.has(url) || files.has(url)) continue;
        bad.push(`${rel}:${i + 1} -> ${url}`);
      }
    });
  });

  assert.deepEqual(bad, [], `存在しないパスへのリンク:\n  ${bad.join('\n  ')}`);
});

test('ログインの入口は1つに揃っている', () => {
  // /laruHP/login は存在しない。誘導先は /laruHP/auth/login。
  const routes = staticRoutes();
  assert.equal(routes.has('/laruHP/auth/login'), true);
  assert.equal(routes.has('/laruHP/login'), false, 'ルートが増えたならこのテストを直すこと');
});
