import type { Block, Page } from '@/types/laruHP';
import { normalizeDesign, DESIGN_PRESETS, type SiteDesign } from '@/lib/site-design';
import { STUDIO_PALETTES } from '@/lib/studio-palettes';
import { FONT_LABEL } from '@/lib/style-direction-plan';
import { isDirection } from '@/lib/studio-direction';
import { isStarterSamplePhoto } from '@/lib/studio-image';

/**
 * 見た目の変更計画（Design Change Plan）。
 *
 * 言葉で直す・参考画像から・公開前の見直し（Director）の3つは、どれもこの形の計画を作り、
 * 同じ関数（applyDesignPlan）で見比べ・採用する。別々の変更処理を持たない。
 *
 * 変えてよいのは、すでにある見た目の設定だけ（下の許可リスト）。
 *   ・サイト全体の見た目（lib/site-design.ts の色・余白・見出し・角の丸み・写真の比率など）
 *   ・書体／形の雰囲気／表示の動き／最初の画面の標準の見せ方
 *   ・節ごとの見せ方（寄せ・上下の余白・現れ方・最初の画面の配置・写真の並べ方）
 * 文章・写真・リンク・電話・料金・フォーム・ページのURL・ID は計画に入れられない。
 * HTML／CSS／JavaScript を書く手段も持たない（customCss は対象外）。
 * 採用までデータは変えない。採用は1回の取り消しで戻る（呼ぶ側が1回の setSite で反映する）。
 */

export type DesignKey = Exclude<keyof SiteDesign, never>;
const DESIGN_KEYS: DesignKey[] = [
  'ink', 'bg', 'accent', 'onAccent', 'surface', 'line',
  'bodyScale', 'bodyLeading', 'bodyTracking', 'headingScale', 'headingTracking', 'headingWeight',
  'space', 'radius', 'buttonShape', 'readWidth', 'photoRatio', 'titleRule',
];
const COLOR_KEYS = new Set<DesignKey>(['ink', 'bg', 'accent', 'onAccent', 'surface', 'line']);

/* 最初の画面の配置は、節ごとの見せ方（heroLayout）だけで変える。サイト全体の標準を変えると、
   文字の色の合わせ（下の heroTextColor）が届かない最初の画面が出るため、ここには入れない */
export type SettingKey = 'fontFamily' | 'designStyle' | 'animLevel' | 'motionProfile';
const SETTING_VALUES: Record<SettingKey, readonly string[]> = {
  fontFamily: Object.keys(FONT_LABEL),
  designStyle: ['minimal', 'elegant', 'modern', 'bold', 'rounded', 'sharp'],
  animLevel: ['none', 'subtle', 'full'],
  motionProfile: ['', 'calm'],
};

/** 節ごとに変えてよい見せ方の欄と値（すでに「見せ方」タブにあるもの） */
const PAD = ['', 'sm', 'lg', 'xl'] as const;
const BLOCK_RULES: Record<string, { types: readonly string[] | '*'; values: readonly string[] }> = {
  align: { types: ['heading', 'paragraph'], values: ['left', 'center'] },
  paddingTop: { types: '*', values: PAD },
  paddingBottom: { types: '*', values: PAD },
  animation: { types: '*', values: ['none', 'fade', 'slide-up', 'zoom'] },
  heroLayout: { types: ['hero'], values: ['', 'center', 'left', 'split'] },
  mobilePhotoFit: { types: ['hero'], values: ['cover', 'contain'] },
  galleryLayout: { types: ['gallery'], values: ['grid', 'stack'] },
  columns: { types: ['gallery'], values: ['2', '3', '4'] },
};
export type BlockKey = keyof typeof BLOCK_RULES;

export type DesignOp =
  | { t: 'design'; key: DesignKey; value: string | number }
  | { t: 'setting'; key: SettingKey; value: string }
  | { t: 'block'; blockId: string; key: BlockKey; value: string };

export type PlanSource = 'words' | 'reference' | 'director';
export interface DesignChangePlan {
  source: PlanSource;
  /** 画面に出す見出し（例：「落ち着いた印象に」） */
  title: string;
  /** なぜこの変更か（短く） */
  reason: string;
  scope: { kind: 'site' } | { kind: 'section'; blockId: string; label: string };
  ops: DesignOp[];
  /** 計画を作ったときの、変える欄の値（採用時に照合。古い計画で新しい状態を上書きしない） */
  base: string;
  /** 計画を作れなかった・変えるものが無いときの説明 */
  note?: string;
}

export interface PlanSettingsLike {
  fontFamily?: string;
  designStyle?: string;
  animLevel?: string;
  motionProfile?: string;
  heroLayout?: string;
  accentColor?: string;
  design?: SiteDesign | Record<string, unknown> | null;
  designPreset?: string;
  styleDirection?: string;
}
type SiteLike<S> = { pages: Page[]; settings: S };

/** 節はどのページのものでも、ID で探す（ID はサイト内で一意） */
const allBlocks = (pages: Page[]) => pages.flatMap((p) => p.blocks ?? []);

/** 1つの操作が許可リストの中か */
export function validOp(op: unknown, pages: Page[]): op is DesignOp {
  if (!op || typeof op !== 'object') return false;
  const o = op as Record<string, unknown>;
  if (o.t === 'design') {
    if (!DESIGN_KEYS.includes(o.key as DesignKey)) return false;
    if (COLOR_KEYS.has(o.key as DesignKey)) return typeof o.value === 'string' && /^#[0-9a-f]{6}$/i.test(o.value);
    // 数値・選択肢は normalizeDesign が範囲と形を確かめる（範囲外は既定に落ちる）。ここでは型だけ
    return typeof o.value === 'number' || typeof o.value === 'string';
  }
  if (o.t === 'setting') return Object.hasOwn(SETTING_VALUES, o.key as string) && SETTING_VALUES[o.key as SettingKey].includes(o.value as string);
  if (o.t === 'block') {
    const rule = BLOCK_RULES[o.key as string];
    if (!rule || typeof o.blockId !== 'string' || typeof o.value !== 'string' || !rule.values.includes(o.value)) return false;
    const b = allBlocks(pages).find((x) => x.id === o.blockId);
    return !!b && (rule.types === '*' || rule.types.includes(b.type));
  }
  return false;
}

/** 変える欄の、いまの値（照合用） */
function currentValue<S extends PlanSettingsLike>(site: SiteLike<S>, op: DesignOp): unknown {
  if (op.t === 'design') return site.settings.design ? normalizeDesign(site.settings.design)[op.key] : null;
  if (op.t === 'setting') return (site.settings as Record<string, unknown>)[op.key] ?? '';
  const b = allBlocks(site.pages).find((x) => x.id === op.blockId);
  return b ? (b.data as Record<string, unknown>)[op.key] ?? '' : undefined;
}
export function baseOf<S extends PlanSettingsLike>(site: SiteLike<S>, ops: DesignOp[]): string {
  return JSON.stringify(ops.map((op) => currentValue(site, op)));
}

/** 計画を作る（許可リストの外・今と同じ値の操作は落とす） */
export function makePlan<S extends PlanSettingsLike>(
  site: SiteLike<S>,
  input: Omit<DesignChangePlan, 'base' | 'ops'> & { ops: unknown[] },
): DesignChangePlan {
  const ops = input.ops.filter((op): op is DesignOp => validOp(op, site.pages))
    .filter((op) => input.scope.kind === 'site' || (op.t === 'block' && op.blockId === input.scope.blockId))
    .filter((op) => {
      const cur = currentValue(site, op);
      if (op.t === 'design') return !site.settings.design || cur !== normalizeDesign({ ...normalizeDesign(site.settings.design), [op.key]: op.value })[op.key];
      return String(cur ?? '') !== op.value;
    });
  // 同じ欄への操作が重なったら、あとのものだけ残す
  const seen = new Set<string>();
  const unique = ops.reverse().filter((op) => {
    const k = op.t === 'block' ? `b:${op.blockId}:${op.key}` : `${op.t}:${op.key}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).reverse();
  return { ...input, ops: unique, base: baseOf(site, unique) };
}

export interface PlanChangeLine { label: string; detail: string }
const DESIGN_LABEL: Record<DesignKey, string> = {
  ink: '文字の色', bg: '地の色', accent: '差し色', onAccent: '差し色の上の文字', surface: '薄い面の色', line: '罫線の色',
  bodyScale: '本文の大きさ', bodyLeading: '行の高さ', bodyTracking: '本文の字間', headingScale: '見出しの大きさ',
  headingTracking: '見出しの字間', headingWeight: '見出しの太さ', space: '節と節のあいだ', radius: '角の丸み',
  buttonShape: 'ボタンの形', readWidth: '一行の長さ', photoRatio: '写真の比率', titleRule: '見出しの飾り線',
};
const SETTING_LABEL: Record<SettingKey, string> = {
  fontFamily: '書体', designStyle: '形の雰囲気', animLevel: '表示の動き（サイト全体）', motionProfile: '動きの強さ',
};
const BLOCK_LABEL: Record<string, string> = {
  align: '文字の寄せ', paddingTop: '上の余白', paddingBottom: '下の余白', animation: '現れるときの動き',
  heroLayout: '最初の画面の配置', mobilePhotoFit: 'スマホでの写真の収め方', galleryLayout: '写真の並べ方', columns: '横に並べる写真の数',
};
const VALUE_LABEL: Record<string, string> = {
  tight: 'つめる', normal: 'ふつう', roomy: 'ひろめ', airy: 'ゆったり', square: '角のまま', soft: '少し丸い', pill: 'まるい',
  none: 'なし', short: '短い線', underline: '下線', left: '左寄せ', center: '中央', split: '左に文字・右に写真',
  cover: '画面いっぱい', contain: '写真の全体を残す', grid: '整列して並べる', stack: 'スクロールで重ねる',
  sm: '少し', lg: '広く', xl: 'ゆったり', fade: '静かに現れる', 'slide-up': '下から現れる', zoom: '奥から近づく',
  subtle: '控えめ', full: 'しっかり', calm: '短く控えめ', '': '標準',
  minimal: '飾りの少ない整った形', elegant: '細い線と広い余白', modern: '丸みのあるカード', bold: '力強い太字', rounded: '大きな丸み', sharp: '角ばった形',
};
const fmt = (k: string, v: unknown): string => {
  if (v === undefined || v === null) return '未設定';
  if (k === 'fontFamily') return FONT_LABEL[String(v)] ?? String(v);
  if (k === 'headingScale' || k === 'bodyScale') return `${Number(v).toFixed(2)}倍`;
  if (k === 'radius') return `${v}px`;
  if (k === 'readWidth') return `${v}字`;
  if (k === 'headingWeight') return String(v);
  if (k === 'columns') return `${v}枚`;
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return v;
  return VALUE_LABEL[String(v)] ?? String(v);
};

/**
 * 計画を、渡された状態に当てる（元のデータは書き換えない）。比較の表示と採用の両方がこれを使う。
 * 照合が合わない（計画のあとに同じ欄が変わった）ときは null。
 */
export function applyDesignPlan<S extends PlanSettingsLike>(site: SiteLike<S>, plan: DesignChangePlan): { pages: Page[]; settings: S; changes: PlanChangeLine[] } | null {
  if (baseOf(site, plan.ops) !== plan.base) return null;
  if (!plan.ops.every((op) => validOp(op, site.pages))) return null;
  const changes: PlanChangeLine[] = [];
  let settings = { ...site.settings } as S;
  const designOps = plan.ops.filter((op): op is Extract<DesignOp, { t: 'design' }> => op.t === 'design');
  if (designOps.length) {
    const hadDesign = !!site.settings.design;
    const before = hadDesign ? normalizeDesign(site.settings.design) : normalizeDesign(DESIGN_PRESETS[0].design);
    const next = normalizeDesign({ ...before, ...Object.fromEntries(designOps.map((op) => [op.key, op.value])) });
    if (!hadDesign) changes.push({ label: 'サイト全体の設定', detail: '使いはじめます（色・余白・見出しなどをここで決める設定）' });
    for (const op of designOps) if (before[op.key] !== next[op.key]) changes.push({ label: DESIGN_LABEL[op.key], detail: `${fmt(op.key, before[op.key])} → ${fmt(op.key, next[op.key])}` });
    settings = { ...settings, design: next, accentColor: next.accent } as S;
  }
  for (const op of plan.ops) {
    if (op.t !== 'setting') continue;
    const before = (site.settings as Record<string, unknown>)[op.key];
    settings = { ...settings, [op.key]: op.value } as S;
    changes.push({ label: SETTING_LABEL[op.key], detail: `${fmt(op.key, before ?? '')} → ${fmt(op.key, op.value)}` });
  }
  const blockOps = plan.ops.filter((op): op is Extract<DesignOp, { t: 'block' }> => op.t === 'block');
  let pages = site.pages;
  if (blockOps.length) {
    pages = site.pages.map((page) => {
      if (!page.blocks?.some((b) => blockOps.some((op) => op.blockId === b.id))) return page;
      const blocks = page.blocks.map((b: Block) => {
        const mine = blockOps.filter((op) => op.blockId === b.id);
        if (!mine.length) return b;
        const data = { ...(b.data as Record<string, unknown>) };
        for (const op of mine) {
          const before = data[op.key];
          if (op.value === '' && (op.key === 'paddingTop' || op.key === 'paddingBottom' || op.key === 'heroLayout')) delete data[op.key];
          else data[op.key] = op.value;
          changes.push({ label: `${blockName(page.blocks, b)}：${BLOCK_LABEL[op.key]}`, detail: `${fmt(op.key, before ?? '')} → ${fmt(op.key, op.value)}` });
        }
        if (b.type === 'hero' && mine.some((op) => op.key === 'heroLayout')) heroTextColor(data, settings, (c) => changes.push({ label: `${blockName(page.blocks, b)}：文字の色`, detail: c }));
        return { ...b, data } as Block;
      });
      return { ...page, blocks };
    });
  }
  return { pages, settings, changes };
}

/**
 * 最初の画面の配置を変えたら、文字の色を配置に合わせる（「構成から、選び直す」と同じ決まり）。
 *   左に文字・右に写真 → サイト全体の文字の色／写真の上に文字 → 白（写真には暗い重ねがかかる）
 * 写真も動画も無い最初の画面は、地の色の上なので変えない。値は計算で決まり、利用者や AI が選ぶものではない。
 */
function heroTextColor(data: Record<string, unknown>, settings: PlanSettingsLike, note: (detail: string) => void) {
  const layout = String(data.heroLayout || settings.heroLayout || 'center');
  const hasPhoto = !!(data.bgImage || data.heroVideo);
  // 見た目の案を採用した作品で、写真が見本のまま（または無い）ときは、描画で文字と写真を上下に分ける
  // （lib/html-export.ts の safeStage）。文字は写真の上ではなく地の上なので、文字の色にする
  const separated = !!settings.styleDirection && isDirection(data.compositionStyle) && layout !== 'split' && (!data.bgImage || isStarterSamplePhoto(data));
  const ink = normalizeDesign(settings.design).ink;
  const want = layout === 'split' || separated ? ink : hasPhoto ? '#ffffff' : '';
  if (!want) return;
  const roles = data.colorRoles && typeof data.colorRoles === 'object' ? { ...(data.colorRoles as Record<string, unknown>) } : null;
  if (layout !== 'split' && roles && 'textColor' in roles) {
    delete roles.textColor;
    if (Object.keys(roles).length) data.colorRoles = roles; else delete data.colorRoles;
  }
  if (String(data.textColor || '').toLowerCase() === want.toLowerCase()) return;
  note(`${data.textColor || '標準'} → ${want === '#ffffff' ? '白（写真の上で読める色）' : `${want}（サイト全体の文字の色）`}`);
  data.textColor = want;
}

const TYPE_NAME: Record<string, string> = {
  hero: '最初の画面', heading: '見出し', paragraph: '本文', gallery: '写真', services: 'サービス', 'three-col': '3つの特徴',
  'two-col': '2つ並べる', tabs: '流れ', faq: 'よくある質問', contact: 'お問い合わせ', cta: 'ひと押し', 'price-table': '料金',
  hours: '営業時間', map: '地図', team: 'スタッフ', booking: '予約', testimonials: 'お客様の声', nav: 'メニュー',
};
export function blockName(blocks: Block[], b: Block): string {
  const d = b.data as Record<string, unknown>;
  const title = [d.heading, d.text].find((v) => typeof v === 'string' && v.trim() && !/【例】|入力してください/.test(v)) as string | undefined;
  return title && b.type !== 'paragraph' ? `${TYPE_NAME[b.type] ?? '節'}「${title.trim().slice(0, 14)}」` : `${TYPE_NAME[b.type] ?? '節'}（${blocks.indexOf(b) + 1}番目）`;
}

/** 計画の効く範囲の説明 */
export function scopeText(plan: DesignChangePlan): string {
  if (plan.scope.kind === 'section') return `選んだ節「${plan.scope.label}」だけ（ほかの節・サイト全体の設定は変わりません）`;
  return plan.ops.some((op) => op.t === 'block')
    ? 'サイト全体（色・書体・余白などはすべてのページ。節ごとの見せ方はトップページの該当する節）'
    : 'サイト全体（すべてのページ）';
}

/** 5つの配色候補（すでにある配色だけを使う。新しい色は作らない） */
export const PALETTE_OPS = (name: string): DesignOp[] => {
  const p = STUDIO_PALETTES.find((x) => x.name === name);
  if (!p) return [];
  return (['bg', 'ink', 'surface', 'accent', 'onAccent', 'line'] as const).map((k) => ({ t: 'design', key: k, value: p[k] }));
};
