import type { Block } from '@/types/laruHP';

/**
 * 見出しは、すぐ下の中身とひと組で並べ替える。
 *
 * 業種のひな形では「見出し → その中身」の順に置いてある（例：私たちの強み → 3つの特徴）。
 * これを節の種類ごとに並べ替えると、見出しだけが別の場所へ移り、
 * 「3つの特徴」の後ろに「私たちの強み」が付く、といったページになっていた（5業種すべて）。
 *
 * 中身が無くなった見出し（次も見出し、または最後）は残さない。
 * 読む人には、何も続かない見出しだけが見えるため。
 * 中身が自分の見出しを持っているときも重ねない（「当院の特徴」の直下に「対応内容」と2段で出ていた）。
 */
export function sortSections(blocks: Block[], weight: (b: Block) => number): Block[] {
  const units: Block[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== 'heading') { units.push([b]); continue; }
    const next = blocks[i + 1];
    if (!next || next.type === 'heading') continue;
    const ownTitle = typeof next.data?.heading === 'string' && next.data.heading.trim() !== '';
    units.push(ownTitle ? [next] : [b, next]);
    i++;
  }
  return units
    .map((u, i) => ({ u, i, w: weight(u[u.length - 1]) }))
    .sort((a, b) => a.w - b.w || a.i - b.i)
    .flatMap((x) => x.u);
}
