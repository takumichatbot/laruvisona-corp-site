import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bareSource } from './helpers/bare-source';

/**
 * 制作スタジオの「できあがり」が、ちゃんと出ること。
 *
 * 2026-09-17、本番で開いたら、真ん中のプレビューが
 *   ・白いまま、または
 *   ・上の200pxだけ描かれて、そこから下が切れている
 * という状態だった。表題が文字の途中で切れて止まっていた。
 *
 * 枠の大きさも位置も正しく（1100×620・scale 0.856）、
 * 中に渡しているHTMLも正しい（69,960文字）。
 * **枠の高さを1px動かすと、その場で全部出た。**
 *
 * 起きていたこと。
 *   1. 入れ物の大きさは ResizeObserver で**あとから**分かる。最初は 0。
 *   2. だから枠は 1100×200 で作られ、その大きさで一度描かれる。
 *   3. 大きさが分かって 1100×620 に変わる。
 *   4. **中の文書が描き直されない。** 200pxぶんの古い絵が残る。
 *
 * ここは「完成像を見ながら作る」と言って売っている画面そのもの。
 * ここが白いと、作りかけの人は「壊れている」と思って手を止める。
 * 7件中6件が下書きのまま止まっているのと、無関係ではないはず。
 */

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const studio = read('app/laruHP/studio/page.tsx');

const bare = bareSource(studio);

test('大きさが分かるまで、枠を作らない', () => {
  // 作った直後に大きさが変わると、その変化が中に伝わらない。
  assert.match(studio, /const measured = size\.width > 0 && size\.height > 0;/);
  assert.match(studio, /\{measured && \(/);
  // 0 のときに 200px で作る古い形に戻っていないこと
  assert.doesNotMatch(studio, /height:Math\.max\(200,size\.height\/scale\),transform/);
});

test('中の文書が生きた瞬間に、描き直させる', () => {
  // 作った直後に動かしても、そのときはまだ中が空なので効かない。
  // 「読み込みが終わった」を教えてくれるのは、中からの ready の便りだけ。
  assert.match(studio, /if \(d\.type === 'ready'\) \{[\s\S]{0,300}repaint\(\);/);
  assert.match(studio, /const repaint = useCallback\(/);
  assert.match(studio, /requestAnimationFrame\(\(\) => \{[\s\S]{0,240}el\.style\.height/);
});

test('大きさが変わったときも、描き直させる', () => {
  // 窓の幅、パソコン⇔スマホ、パネルの開閉でも大きさは変わる。
  assert.match(studio, /useEffect\(\(\) => \{ repaint\(\); \}, \[frameHeight, frameWidth, repaint\]\)/);
});

test('プレビューの中身は、編集画面に手が届かないままにする', () => {
  // 直すついでに緩めない。公開HTMLの中身は人が打った文字だけとは限らない。
  assert.match(bare, /sandbox="allow-scripts"/);
  assert.doesNotMatch(bare, /allow-same-origin/);
});
