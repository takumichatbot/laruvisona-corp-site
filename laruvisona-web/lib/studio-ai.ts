import type { Block } from '@/types/laruHP';
import { BLOCK_DEFS } from '@/lib/studio-schema';
import { cleanIncomingText } from '@/lib/safe-markup';
const COPY =
  /^(heading|subheading|text|subtext|ctaText|buttonText|alt|bgImageAlt|col[123](Title|Text))$/;
export function aiFields(block: Block): Record<string, string> {
  return Object.fromEntries(
    (BLOCK_DEFS[block.type]?.fields || [])
      .filter((f) => COPY.test(f.key) && ['text', 'multiline'].includes(f.type))
      .flatMap((f) => {const value=String(block.data[f.key]||'');return value.length<=2000?[[f.key,value]]:[];}),
  );
}
export type SectionProposal = {
  id: string;
  type: string;
  before: Record<string, string>;
  changes: Record<string, string>;
};
export function parseSectionProposal(
  block: Block,
  value: unknown,
): SectionProposal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const before = aiFields(block),
    changes: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (
      !Object.hasOwn(before, k) ||
      typeof v !== 'string' ||
      v.length > 2000 ||
      /<\/?[a-z][^>]*>/i.test(v)
    )
      return null;
    const text = cleanIncomingText(v, 2000);
    // AIで未確認の例文を確定情報に見せない。事実の入力は利用者が行う。
    for (const marker of ['【例】', 'サンプル', '入力してください']) {
      if (before[k].includes(marker) && !text.includes(marker)) return null;
    }
    if (text !== before[k]) changes[k] = text;
  }
  return Object.keys(changes).length
    ? { id: block.id, type: block.type, before, changes }
    : null;
}
/** 採用時にも比較する。待機中の手編集や、別の節・消された節へ適用しない。 */
export function applySectionProposal(
  block: Block,
  proposal: SectionProposal,
  keys: string[],
): Block | null {
  if (block.id !== proposal.id || block.type !== proposal.type || !keys.length)
    return null;
  const current = aiFields(block);
  if (
    keys.some(
      (k) =>
        !Object.hasOwn(proposal.changes, k) ||
        !Object.hasOwn(current, k) ||
        current[k] !== proposal.before[k],
    )
  )
    return null;
  return {
    ...block,
    data: {
      ...block.data,
      ...Object.fromEntries(keys.map((k) => [k, proposal.changes[k]])),
    },
  };
}
