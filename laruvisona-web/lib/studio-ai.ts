import type { Block } from '@/types/laruHP';
import { BLOCK_DEFS } from '@/lib/studio-schema';
import { cleanIncomingText } from '@/lib/safe-markup';
import { isPlaceholderText } from '@/lib/placeholder-text';

/**
 * 「AIに相談」（節の文章の提案）で扱ってよい欄と、提案の確かめ方。
 *
 * AIが変えられるのは、許可した既存の文章欄だけ。
 *   ・節の見出し・本文など（COPY）
 *   ・繰り返し項目の中の文章（LIST_TEXT。サービスの名前・説明、流れ、質問と答え、メニューの名前・説明）
 * 料金・URL・電話リンク・ID・写真・配列そのもの・公開設定は対象にしない。
 * 欄は「field」か「field.位置.sub」の文字列で表す。この一覧から作った文字列だけを受け付け、任意のパスは書かない。
 */
const COPY =
  /^(heading|subheading|text|subtext|ctaText|buttonText|alt|bgImageAlt|col[123](Title|Text))$/;
/** 繰り返し項目の中で、文章として提案してよい欄（料金・アイコン・表示の切替は入れない） */
const LIST_TEXT: Record<string, Record<string, string[]>> = {
  services: { items: ['title', 'description'] },
  tabs: { items: ['label', 'body'] },
  faq: { items: ['q', 'a'] },
  'price-table': { plans: ['name', 'description'] },
};
const MAX_TEXT = 2000;
const MAX_ITEMS = 12;
export const MAX_FACTS = 800;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function aiFields(block: Block): Record<string, string> {
  const out: Record<string, string> = {};
  const data = (block.data ?? {}) as Record<string, unknown>;
  for (const f of BLOCK_DEFS[block.type]?.fields || []) {
    if (COPY.test(f.key) && ['text', 'multiline'].includes(f.type)) {
      const value = str(data[f.key]);
      if (value.length <= MAX_TEXT) out[f.key] = value;
      continue;
    }
    const subs = LIST_TEXT[block.type]?.[f.key];
    const list = data[f.key];
    if (!subs || f.type !== 'list' || !Array.isArray(list)) continue;
    list.slice(0, MAX_ITEMS).forEach((item, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      for (const s of subs) {
        if (!(f.item || []).some((d) => d.key === s)) continue;
        const value = str((item as Record<string, unknown>)[s]);
        if (value.length <= MAX_TEXT) out[`${f.key}.${i}.${s}`] = value;
      }
    });
  }
  return out;
}

/** AIへ送る節の中身（文章の欄だけ。繰り返し項目は、許可した欄だけを残した形） */
export function aiData(block: Block): Record<string, unknown> {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(aiFields(block))) {
    const m = k.match(/^([^.]+)\.(\d+)\.([^.]+)$/);
    if (!m) { out[k] = v; continue; }
    const list = (out[m[1]] ??= (Array.isArray(data[m[1]]) ? (data[m[1]] as unknown[]).slice(0, MAX_ITEMS).map(() => ({})) : [])) as Record<string, string>[];
    if (list[Number(m[2])]) list[Number(m[2])][m[3]] = v;
  }
  return out;
}

/** 欄の呼び名（「見出し」「2件目の説明」など） */
export function aiFieldLabel(block: Block, key: string): string {
  const def = BLOCK_DEFS[block.type];
  const m = key.match(/^([^.]+)\.(\d+)\.([^.]+)$/);
  if (!m) return def?.fields.find((f) => f.key === key)?.label || key;
  const f = def?.fields.find((x) => x.key === m[1]);
  const sub = f?.item?.find((x) => x.key === m[3])?.label || m[3];
  const item = ((block.data as Record<string, unknown>)?.[m[1]] as Record<string, unknown>[] | undefined)?.[Number(m[2])] ?? {};
  const name = [item.title, item.name, item.label, item.q].map(str).find((v) => v.trim() && !isPlaceholderText(v));
  return `${name ? name.slice(0, 20) : `${Number(m[2]) + 1}件目`}の${sub}`;
}

export type SectionProposal = {
  id: string;
  type: string;
  before: Record<string, string>;
  changes: Record<string, string>;
  /** 繰り返し項目：提案したときの項目全体（採用時に照合。並べ替え・削除・手編集のあとに別の項目へ入れない） */
  items?: Record<string, string>;
  /** 提案に使った、本人が書いた事実（確認用に画面へ出す。保存しない） */
  facts?: string;
  /** 確かめられない事実が入っていたので外した欄 */
  dropped?: { key: string; reason: string }[];
  /** AIが「この情報があれば書ける」と返したもの */
  missing?: string[];
};

/* ── 本人が書いていない事実を足していないか（機械的な確かめ） ──
   数字・地名・資格や保証などの言葉が、本人の情報（と、元からある本人の文章）に無ければ外す。
   これで正しさまで保証はしない。採用前に、元の文章・新しい文章・使った情報を本人が確かめる。 */
const CLAIM_WORDS = [
  '実績', '創業', '設立', '年以上', '経験', '資格', '有資格', '認定', '許可', '免許', '保証', '補償', '口コミ', '評判',
  'お客様の声', '満足', '受賞', 'No.1', 'ナンバーワン', '一番', '最安', '業界初', '地域密着', '営業時間', '定休', '年中無休',
  '24時間', '住所', '電話', 'TEL', '〒', '対応地域', '対応エリア', '全国', '即日', '無料', '見積', '割引', '保険',
];
/** 地名らしい語（漢字＋都・府・県・市・区・町・村、北海道、〜駅）。前に付いた語ごと拾うので、末尾の部分で照合する */
const PLACE = /北海道|[一-龯]{1,4}(都|府|県|市|区|町|村)|[一-龯ァ-ヶー]{1,6}駅/g;
const norm = (s: string) => s.normalize('NFKC').replace(/[,，、\s]/g, '');
export function unsupportedClaims(text: string, sources: string): string[] {
  const t = text.normalize('NFKC'), src = norm(sources);
  const out = new Set<string>();
  for (const n of t.match(/\d[\d,.]*/g) ?? []) if (!src.includes(norm(n))) out.add(n);
  for (const w of CLAIM_WORDS) if (t.includes(w) && !src.includes(norm(w))) out.add(w);
  for (const p of t.match(PLACE) ?? []) {
    const known = [...p].some((_, i) => p.length - i >= 2 && src.includes(norm(p.slice(i))));
    if (!known) out.add(p);
  }
  return [...out];
}

const itemOf = (block: Block, key: string): string | undefined => {
  const m = key.match(/^([^.]+)\.(\d+)\.([^.]+)$/);
  if (!m) return undefined;
  const item = ((block.data as Record<string, unknown>)?.[m[1]] as unknown[] | undefined)?.[Number(m[2])];
  return item === undefined ? undefined : JSON.stringify(item);
};

/**
 * AIの返事を確かめる。形が違う・許可していない欄・HTML がある、なら全体を捨てる（null）。
 * 見本（【例】など）の欄は、本人の事実が無ければ見本の印を残させる（事実の文章に変えない）。
 * 本人の事実があるときだけ、その事実から書いた文章を受け付ける。確かめられない事実が入った欄は外す。
 */
export function reviewSectionProposal(
  block: Block,
  value: unknown,
  opts: { facts?: string; only?: string[] } = {},
): { proposal: SectionProposal | null; dropped: { key: string; reason: string }[]; missing: string[] } {
  const fail = { proposal: null, dropped: [], missing: [] };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail;
  const v = value as Record<string, unknown>;
  // 新しい形 { changes, missing } と、以前の形（欄 → 文章）の両方
  const wrapped = Object.hasOwn(v, 'changes') && Object.keys(v).every((k) => k === 'changes' || k === 'missing');
  const raw = wrapped ? v.changes : v;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail;
  const missing = wrapped && Array.isArray(v.missing)
    ? v.missing.filter((m): m is string => typeof m === 'string' && !/<\/?[a-z][^>]*>/i.test(m)).slice(0, 5).map((m) => cleanIncomingText(m, 80)).filter(Boolean)
    : [];
  const facts = cleanIncomingText(str(opts.facts), MAX_FACTS).trim();
  const all = aiFields(block);
  const before = opts.only?.length ? Object.fromEntries(Object.entries(all).filter(([k]) => opts.only!.includes(k))) : all;
  // 確かめの材料：本人の事実と、この節に元からある本人の文章（見本は材料にしない）
  const sources = [facts, ...Object.values(all).filter((t) => t && !isPlaceholderText(t))].join('\n');
  const changes: Record<string, string> = {}, items: Record<string, string> = {}, dropped: { key: string; reason: string }[] = [];
  for (const [k, x] of Object.entries(raw)) {
    if (!Object.hasOwn(before, k) || typeof x !== 'string' || x.length > MAX_TEXT || /<\/?[a-z][^>]*>/i.test(x)) return fail;
    const text = cleanIncomingText(x, MAX_TEXT);
    if (text === before[k]) continue;
    const sample = ['【例】', 'サンプル', '入力してください'].some((m) => before[k].includes(m) && !text.includes(m));
    if (sample && !facts) return fail;   // 本人の事実なしに、見本を事実の文章に見せない
    if (sample && !text.trim()) { dropped.push({ key: k, reason: '空の文章になるため' }); continue; }
    const extra = unsupportedClaims(text, sources);
    if (extra.length) { dropped.push({ key: k, reason: `本人の情報に無い内容（${extra.slice(0, 3).join('・')}）が入っていたため` }); continue; }
    changes[k] = text;
    const it = itemOf(block, k);
    if (it !== undefined) items[k] = it;
  }
  if (!Object.keys(changes).length) return { proposal: null, dropped, missing };
  return {
    proposal: { id: block.id, type: block.type, before, changes, ...(Object.keys(items).length ? { items } : {}), ...(facts ? { facts } : {}), ...(dropped.length ? { dropped } : {}), ...(missing.length ? { missing } : {}) },
    dropped, missing,
  };
}

export function parseSectionProposal(block: Block, value: unknown, opts?: { facts?: string; only?: string[] }): SectionProposal | null {
  return reviewSectionProposal(block, value, opts).proposal;
}

/** 採用時にも比較する。待機中の手編集や、別の節・消された節・並べ替えた別の項目へ適用しない。 */
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
        current[k] !== proposal.before[k] ||
        (k.includes('.') && itemOf(block, k) !== proposal.items?.[k]),
    )
  )
    return null;
  const data = { ...(block.data as Record<string, unknown>) };
  for (const k of keys) {
    const m = k.match(/^([^.]+)\.(\d+)\.([^.]+)$/);
    if (!m) { data[k] = proposal.changes[k]; continue; }
    const list = [...(data[m[1]] as Record<string, unknown>[])];
    list[Number(m[2])] = { ...list[Number(m[2])], [m[3]]: proposal.changes[k] };
    data[m[1]] = list;
  }
  return { ...block, data: data as Block['data'] };
}
