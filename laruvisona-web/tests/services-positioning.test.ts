import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/services/page.tsx', import.meta.url), 'utf8');

test('相見積もりで比べられる前に、比べる軸が置いてある', () => {
  // 「つくる・直す・組み込む」だけでは、どの受託会社とも同じに見える。
  assert.match(page, /運用していないと、/);
  assert.match(page, /OPERATIONS\.map/);
});

test('その軸が、ヒーローの直後に来る', () => {
  // 4つ下の節に置いても、比べる前に読まれない。
  const hero = page.indexOf('つくって、売って、');
  const ops = page.indexOf('運用していないと、');
  const services = page.indexOf('{/* サービスと料金 */}');
  assert.ok(hero > 0 && ops > hero, 'ヒーローより後に無い');
  assert.ok(ops < services, '料金の節より後ろに落ちている');
});

test('書いてあるのは、実際に起きたことだけ', () => {
  // 一般論を書いた瞬間に他社と同じになる。実際に直した6件に対応している。
  const block = page.match(/const OPERATIONS[\s\S]*?\n\];/)![0];
  const titles = [...block.matchAll(/title: '([^']+)'/g)].map(m => m[1]);
  assert.equal(titles.length, 6);
  for (const t of titles) assert.ok(t.length >= 15, `具体性が足りない: ${t}`);
  // 今日までに実際に直したものと対応していること
  assert.ok(titles.some(t => t.includes('課金されているのに使えない')));
  assert.ok(titles.some(t => t.includes('請求される額がずれる')));
  assert.ok(titles.some(t => t.includes('解約できなくなる')));
  assert.ok(titles.some(t => t.includes('辿れない')));
});

test('検索結果の説明文も、同じ軸で書かれている', () => {
  assert.match(page, /description:\s*\n?\s*'自社サービスを作って、課金して、毎日運用している/);
});
