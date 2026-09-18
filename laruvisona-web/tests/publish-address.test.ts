import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalBase } from '../lib/public-site-url.ts';
import { bareSource } from './helpers/bare-source';

/**
 * 公開したのに、その住所が画面に出なかった。
 *
 * 制作画面で「公開する」を押すと、出るのは **「公開しました」の5文字だけ。**
 * URLはどこにも出ない。作り終えて、いちばん見たいものが出ない。
 *
 * 公開APIは前から `slug` と `url` を返している
 * （app/api/sites/[id]/publish/route.ts）。一覧画面はそれを使っているのに、
 * 制作画面は受け取って捨てていた。
 *
 * 公開サイトは1件・累計閲覧21回。名刺やSNSに載せるのはこの住所なので、
 * 押したその場に出していないと、そこから先が始まらない。
 */

const read = (p: string) => bareSource(fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const studio = () => read('app/laruHP/studio/page.tsx');

test('公開APIは、住所を返している（前から）', () => {
  const route = fs.readFileSync(new URL('../app/api/sites/[id]/publish/route.ts', import.meta.url), 'utf8');
  assert.match(route, /slug: updated\.slug,/);
  assert.match(route, /url: `\/hp\/\$\{updated\.slug\}`,/);
});

test('公開したあと、住所を画面に持つ', () => {
  const s = studio();
  assert.match(s, /const \[publicUrl, setPublicUrl\] = useState\(''\);/, '住所を持っていない');
  assert.match(s, /setPublicUrl\(canonicalBase\(publicSiteRef\.current\)\);/, '公開後に住所を作っていない');
  assert.match(s, /slug: typeof b\.slug === 'string' && b\.slug \? b\.slug : publicSiteRef\.current\.slug,/,
    '公開APIの返す slug を捨てている');
});

test('開き直したときも、公開済みなら住所を出す', () => {
  // 公開したあと一度閉じて開き直す人のほうが多い。
  const s = studio();
  assert.match(s, /setPublicUrl\(s\.published \? canonicalBase\(publicSiteRef\.current\) : ''\);/,
    '読み込み時に住所を作っていない');
  assert.match(s, /custom_domain: \(s\.custom_domain as string \| null\) \?\? null,/,
    '独自ドメインを見ていない');
});

test('独自ドメインがあれば、そちらを出す', () => {
  // 正規URLの決まりは lib/public-site-url.ts に1つだけ置く。ここで組み直さない。
  assert.equal(canonicalBase({ slug: 'abc', custom_domain: 'example.com' }), 'https://example.com');
  assert.match(canonicalBase({ slug: 'abc', custom_domain: null }), /\/hp\/abc$/);
  const s = studio();
  assert.doesNotMatch(s, /`\$\{location\.origin\}\/hp\//, 'URLを自前で組んでいる');
});

test('画面に、住所と「開く」と「コピー」が出る', () => {
  const s = studio();
  assert.match(s, /\{published && publicUrl && \(/, '出す条件が無い');
  assert.match(s, /このサイトの住所/);
  assert.match(s, /住所をコピー/);
  assert.match(s, /開いて確かめる/);
  assert.match(s, /target="_blank" rel="noopener noreferrer"/, '新しいタブで開いていない');
});

test('コピーできなかったときに、黙らない', () => {
  /*
    clipboard は端末や設定で使えないことがある。
    失敗したまま何も起きないと「押したのに動かない」になる。
  */
  const s = studio();
  const at = s.indexOf('await navigator.clipboard.writeText(publicUrl);');
  assert.ok(at > 0, 'コピーしていない');
  const block = s.slice(at, at + 320);
  assert.match(block, /\} catch \{/, '失敗を見ていない');
  assert.match(block, /window\.prompt\('この住所をコピーしてください', publicUrl\)/, '失敗したときの逃げ道が無い');
});
