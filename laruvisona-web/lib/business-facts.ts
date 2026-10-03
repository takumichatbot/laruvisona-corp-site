import { isPlaceholderText } from '@/lib/placeholder-text';
import type { Block } from '@/types/laruHP';

/**
 * 会社の情報（本人が書いた事実）を、サイトの中で使い回すための小さな置き場。
 *
 * 出どころ（どこを直せば変わるか）を1つに決める：
 *   ・会社・お店の名前 …… sites.name（上の帯の名前）
 *   ・業種 ……………………… sites.industry（制作画面の業種）
 *   ・電話・住所・営業時間 … settings_json.businessInfo（「検索・SEO」の事業者情報。検索向けに公開される）
 *   ・対応地域・ひとことの説明・来てほしい人・主なサービス・連絡のしかた
 *     ………………………………… settings_json.businessFacts（ここ。制作画面の「会社の情報」）
 *
 * businessFacts の決めごと：
 *   ・本人が書いた・最初の質問で答えた文だけを入れる。推測・AIの文・見本（【例】など）は入れない
 *   ・公開HTML・検索向けの情報（JSON-LD・lhpmeta）には出さない（制作画面で使うための控え）
 *   ・通知先メール・認証・支払い・社内メモは入れない（欄が無い）
 *   ・使うときは、その節に関係する情報だけを、本人が見てから入れる（まとめて書き換えない）
 */

export const FACT_KEYS = ['area', 'shortDescription', 'targetAudience', 'servicesSummary', 'contactPreference'] as const;
export type FactKey = (typeof FACT_KEYS)[number];
export type BusinessFacts = Partial<Record<FactKey, string>>;

export const FACT_LABEL: Record<FactKey, string> = {
  area: '対応地域・場所',
  shortDescription: 'どんな仕事・お店か（ひとこと）',
  targetAudience: '来てほしい人',
  servicesSummary: '主なサービス・メニュー',
  contactPreference: '連絡・予約のしかた',
};
export const FACT_HINT: Record<FactKey, string> = {
  area: '例のように書かず、実際の地域だけ（足立区・葛飾区 など）',
  shortDescription: '本当にしていることを1〜2文で',
  targetAudience: 'どんな方に来てほしいか',
  servicesSummary: '実際に受けているものだけ。料金や実績は、確かなものだけ',
  contactPreference: '電話・フォーム・LINE など、実際に受け付けている方法',
};
export const FACT_MAX: Record<FactKey, number> = { area: 80, shortDescription: 200, targetAudience: 120, servicesSummary: 300, contactPreference: 120 };

/** 制御文字を落として整える。見本の文・長すぎる文・知らない欄は捨てる */
export function normalizeBusinessFacts(raw: unknown): BusinessFacts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: BusinessFacts = {};
  for (const k of FACT_KEYS) {
    const v = src[k];
    if (typeof v !== 'string') continue;
    const t = v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, FACT_MAX[k]);
    if (t && !isPlaceholderText(t)) out[k] = t;
  }
  return out;
}

export const hasFacts = (f: BusinessFacts | null | undefined) => !!f && FACT_KEYS.some((k) => !!f[k]);

/** 最初の質問で本人が打った答えだけを控える（選択肢・見本・電話は入れない。電話は事業者情報が出どころ） */
export function factsFromIntake(intake: { area?: unknown; audience?: unknown; description?: unknown }): BusinessFacts {
  return normalizeBusinessFacts({ area: intake.area, targetAudience: intake.audience, shortDescription: intake.description });
}

/** 事業者情報（検索・SEO）の、制作画面で見せてよい部分（読み取りだけ） */
export function publicContactFacts(bi: unknown): { label: string; value: string }[] {
  if (!bi || typeof bi !== 'object') return [];
  const b = bi as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const hours = Array.isArray(b.openingHours) ? (b.openingHours as unknown[]).filter((x): x is string => typeof x === 'string' && !!x.trim()).join('、') : '';
  return [
    { label: '電話', value: s(b.phone) },
    { label: '住所', value: [s(b.postalCode) && `〒${s(b.postalCode)}`, s(b.address)].filter(Boolean).join(' ') },
    { label: '営業時間', value: hours },
  ].filter((x) => x.value && !isPlaceholderText(x.value));
}

/** 節の種類ごとに、関係のある情報（AIの文案・欄への挿入で使う） */
const RELEVANT: Record<string, FactKey[]> = {
  hero: ['shortDescription', 'area', 'targetAudience'],
  heading: ['shortDescription', 'area'],
  paragraph: ['shortDescription', 'targetAudience', 'area', 'servicesSummary'],
  services: ['servicesSummary', 'area'],
  'three-col': ['servicesSummary', 'targetAudience'],
  'two-col': ['shortDescription', 'servicesSummary'],
  tabs: ['contactPreference', 'servicesSummary'],
  faq: ['area', 'servicesSummary', 'contactPreference'],
  contact: ['contactPreference', 'area'],
  cta: ['contactPreference', 'targetAudience'],
  booking: ['contactPreference'],
  hours: ['area'],
  map: ['area'],
  'price-table': ['servicesSummary'],
  testimonials: [],
  gallery: [],
};
export function relevantFactKeys(block: Pick<Block, 'type'> | null | undefined): FactKey[] {
  if (!block) return [];
  return RELEVANT[block.type] ?? ['shortDescription', 'area'];
}

/** その節の「使う情報」の下書き（本人が見て直してから送る。保存済みの値はここでは変えない） */
export function factsForSection(facts: BusinessFacts, block: Pick<Block, 'type'> | null | undefined, name = ''): string {
  const keys = relevantFactKeys(block).filter((k) => facts[k]);
  const lines = keys.map((k) => `${FACT_LABEL[k]}：${facts[k]}`);
  if (name.trim() && !isPlaceholderText(name) && lines.length) lines.unshift(`名前：${name.trim()}`);
  return lines.join('\n');
}
