/**
 * 「公開の準備」の指摘を、直す場所（どの節の、どの項目か）まで落とす。
 *
 * 判定は lib/publish-readiness.ts と同じ材料（lib/placeholder-text.ts・見本写真の印）を使う。
 * 新しい判定は足さない。ここでは「どこにあるか」を、ページID・部品ID・項目キー・
 * 繰り返し項目の位置で返すだけ。画面（制作画面）はこれを使って、その欄を開く。
 *
 * 繰り返し項目には安定したIDが無いので、位置（index）と、そのときの値（expect）を持つ。
 * 開く前に resolveTarget で照合し、並べ替え・削除・書き換えのあとに別の項目を開かない。
 */
import type { Block, Page } from '@/types/laruHP';
import { isPlaceholderText } from './placeholder-text';
import { BLOCK_DEFS, type FieldDef } from './studio-schema';
import { isStarterSamplePhoto } from './studio-image';

export type FixKind = 'placeholder' | 'sample-photo';

export interface FixTarget {
  /** 一意の識別（page/block/field/index/sub） */
  id: string;
  kind: FixKind;
  pageId: string;
  pageIndex: number;
  blockId: string;
  /** 画面に出す節の名前 */
  section: string;
  /** 項目キー（BLOCK_DEFS の fields の key） */
  field: string;
  /** 繰り返し項目の位置（無ければ単独の欄） */
  index?: number;
  /** 繰り返し項目の中の項目キー（文字列の並びなら無し） */
  sub?: string;
  /** 画面に出す項目の名前 */
  fieldLabel: string;
  /** 問題の短い説明 */
  problem: string;
  /** 押したときの操作の名前 */
  action: string;
  /** 指摘したときの値。開く前に、いまの値と照合する */
  expect: string;
  /** 制作画面（トップページの節の編集欄）で直せるか。直せない場所は、これまでの編集画面へ案内する */
  editable: boolean;
}

const SAMPLE_PATH = /^\/studio\/placeholders\//;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const dataOf = (b: Block) => (b.data ?? {}) as Record<string, unknown>;
const clean = (v: unknown) => { const s = str(v).trim(); return s && !isPlaceholderText(s) ? s.replace(/\s+/g, ' ').slice(0, 24) : ''; };

/** 節の名前：見出し（例文でなければ）→ 直前の見出し → 節の種類の名前 */
export function sectionName(list: Block[], i: number): string {
  const b = list[i];
  const data = dataOf(b);
  if (b.type === 'hero') return BLOCK_DEFS.hero?.label || '最初の画面';
  if (b.type === 'heading') return clean(data.text) || (list[i + 1] ? sectionName(list, i + 1) : '') || '見出し';
  const prev = list[i - 1];
  const pair = b.type === 'two-col' ? [clean(data.col1Title), clean(data.col2Title)].filter(Boolean).join('・') : '';
  return clean(data.heading) || pair || (prev?.type === 'heading' ? clean(dataOf(prev).text) : '') || BLOCK_DEFS[b.type]?.label || '節';
}

/** 繰り返し項目1件の呼び名（例文でない名前があればそれ。無ければ「2件目」） */
function itemName(item: unknown, i: number): string {
  const o = (item ?? {}) as Record<string, unknown>;
  return clean(o.title) || clean(o.name) || clean(o.label) || clean(o.q) || clean(o.day) || `${i + 1}件目`;
}

function push(out: FixTarget[], t: Omit<FixTarget, 'id'>) {
  out.push({ ...t, id: [t.pageId, t.blockId, t.field, t.index ?? '', t.sub ?? ''].join('/') });
}

/** 節1つの中の、例文のまま・見本写真のままの欄 */
function scanBlock(out: FixTarget[], page: Page, pageIndex: number, list: Block[], i: number) {
  const b = list[i];
  const data = dataOf(b);
  const def = BLOCK_DEFS[b.type];
  const section = sectionName(list, i);
  const base = { pageId: page.id, pageIndex, blockId: b.id, section, editable: pageIndex === 0 && !!def };
  const seen = new Set<string>();
  const text = (field: string, label: string, value: unknown, index?: number, sub?: string) => {
    if (!isPlaceholderText(value)) return;
    seen.add(index === undefined ? field : `${field}.${index}${sub ? `.${sub}` : ''}`);
    push(out, { ...base, kind: 'placeholder', field, index, sub, fieldLabel: label, problem: '見本の文章が残っています', action: '編集する', expect: str(value) });
  };
  const photo = (field: string, label: string, value: unknown, index?: number, sub?: string) => {
    if (!SAMPLE_PATH.test(str(value))) return;
    push(out, { ...base, kind: 'sample-photo', field, index, sub, fieldLabel: label, problem: '見本の写真です', action: '写真を選ぶ', expect: str(value) });
  };
  for (const f of def?.fields ?? []) {
    const v = data[f.key];
    if (b.type === 'hero' && f.key === 'bgImage') {
      // 最初の画面の見本写真は、説明文の印で見分ける（lib/studio-image.ts）。差し替えると外れる
      if (str(v) && isStarterSamplePhoto(data)) push(out, { ...base, kind: 'sample-photo', field: 'bgImage', fieldLabel: f.label, problem: '見本の写真です', action: '写真を選ぶ', expect: str(v) });
      continue;
    }
    if (b.type === 'hero' && f.key === 'bgImageAlt') continue;   // 見本写真の印。写真の差し替えで外れる
    if (f.type === 'image') { photo(f.key, f.label, v); continue; }
    if (f.type === 'list' && Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (f.ofStrings) {
          const label = f.key === 'images' ? `写真${idx + 1}` : `${f.label} ${idx + 1}`;
          if (f.key === 'images') photo(f.key, label, item, idx); else text(f.key, label, item, idx);
          return;
        }
        for (const s of (f.item ?? []) as FieldDef[]) {
          const sv = (item as Record<string, unknown>)?.[s.key];
          const label = `${itemName(item, idx)}の${s.label}`;
          if (s.type === 'image') photo(f.key, label, sv, idx, s.key); else text(f.key, label, sv, idx, s.key);
        }
      });
      continue;
    }
    text(f.key, f.label, v);
  }
  // 編集欄が無い項目に例文が残っている（以前の編集画面で作った節など）。制作画面では直せないので案内する
  for (const [k, v] of Object.entries(data)) {
    if (seen.has(k) || (def?.fields ?? []).some(f => f.key === k)) continue;
    if (typeof v === 'string' && isPlaceholderText(v) && !(b.type === 'hero' && k === 'bgImageAlt')) {
      push(out, { ...base, editable: false, kind: 'placeholder', field: k, fieldLabel: '（この画面に無い項目）', problem: '見本の文章が残っています', action: 'これまでの編集画面で直す', expect: v });
    }
  }
}

/** すべての「直す場所」。並びはページ → 節 → 項目の順 */
export function readinessTargets(pages: Page[]): FixTarget[] {
  const out: FixTarget[] = [];
  pages.forEach((page, pageIndex) => {
    const list = page.blocks ?? [];
    list.forEach((_, i) => scanBlock(out, page, pageIndex, list, i));
  });
  return out;
}

/**
 * 開く直前に、指摘した場所がまだ同じ値かを確かめる。
 * 並べ替えで位置が変わっていたら、同じ値の項目を探す（1件に決まるときだけ）。
 * 直っている・消えている・同じ値が複数ある、なら null（古い指摘で別の欄を開かない）。
 */
export function resolveTarget(pages: Page[], t: FixTarget): FixTarget | null {
  const page = pages.find(p => p.id === t.pageId);
  const block = page?.blocks?.find(b => b.id === t.blockId);
  if (!page || !block) return null;
  const v = dataOf(block)[t.field];
  const at = (idx: number) => {
    const item = Array.isArray(v) ? v[idx] : undefined;
    return t.sub ? str((item as Record<string, unknown>)?.[t.sub]) : str(item);
  };
  if (t.index === undefined) return str(v) === t.expect ? t : null;
  if (!Array.isArray(v)) return null;
  if (at(t.index) === t.expect) return t;
  const hits = v.map((_, idx) => idx).filter(idx => at(idx) === t.expect);
  if (hits.length !== 1) return null;
  return { ...t, index: hits[0], id: [t.pageId, t.blockId, t.field, hits[0], t.sub ?? ''].join('/') };
}

/** 編集欄の位置を表す文字列（data-field-path に入れる値） */
export function targetPath(t: Pick<FixTarget, 'field' | 'index' | 'sub'>): string {
  return t.index === undefined ? t.field : `${t.field}.${t.index}${t.sub ? `.${t.sub}` : ''}`;
}
