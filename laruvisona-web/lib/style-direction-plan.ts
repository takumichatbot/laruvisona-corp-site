import type { Block, Page } from '@/types/laruHP';
import { DESIGN_PRESETS, normalizeDesign, type SiteDesign } from '@/lib/site-design';
import { STUDIO_PALETTES } from '@/lib/studio-palettes';
import { arrangeDirection, directionSequence, type DirectionId } from '@/lib/studio-direction';
import { colorRolesOf, type ColorRole, type RoleKey } from '@/lib/theme-roles';

/**
 * 見た目の案（構成から、選び直す）の変更計画。
 *
 * 比較の表示・採用の両方がこの関数を通る。プレビューと採用で別の変換を持たない。
 * いつも「渡された元の状態」から作る（候補を選び替えても変更は積み重ならない）。
 * 元のデータは書き換えず、新しい pages / settings を返す。
 *
 * 変えるのは、案ごとに決めた項目だけ。settings / design を丸ごと置き換えない。
 * 本文・写真（URL・説明・見本の印）・リンク・電話・フォーム・ID・繰り返し項目は触らない。
 */
type DesignPatch = Partial<Pick<SiteDesign,
  'headingScale' | 'headingWeight' | 'headingTracking' | 'titleRule' | 'space' | 'radius' | 'buttonShape' | 'readWidth' | 'bodyLeading'>>;

interface StylePlan {
  basePreset: string;
  designStyle: string;
  fontFamily: string;
  palette: (typeof STUDIO_PALETTES)[number]['name'];
  design: DesignPatch;
  /** 見出し・紹介文を左寄せにそろえる */
  alignLeft?: boolean;
  /** 最初の画面を「左に文字・右に写真」にする */
  heroSplit?: boolean;
  /** スマホでは写真の全体を残し、文字と分ける */
  mobileWholePhoto?: boolean;
}

export const STYLE_PLANS: Record<DirectionId, StylePlan> = {
  editorial: {
    basePreset: 'calm', designStyle: 'minimal', fontFamily: 'biz', palette: '夜明けの青',
    design: { headingScale: 1.1, headingWeight: 700, headingTracking: 0.03, titleRule: 'short', space: 'normal', radius: 4, buttonShape: 'soft', readWidth: 34 },
    alignLeft: true,
  },
  immersive: {
    basePreset: 'refined', designStyle: 'elegant', fontFamily: 'mincho', palette: '墨と生成り',
    design: { headingWeight: 500, headingTracking: 0.08, bodyLeading: 2.05, space: 'airy', radius: 0, buttonShape: 'square', titleRule: 'none', readWidth: 32 },
    mobileWholePhoto: true,
  },
  catalog: {
    basePreset: 'calm', designStyle: 'minimal', fontFamily: 'noto', palette: '白と黒',
    design: { headingScale: 1.2, headingWeight: 800, headingTracking: 0.01, titleRule: 'underline', space: 'normal', radius: 0, buttonShape: 'square', readWidth: 38 },
    alignLeft: true, heroSplit: true,
  },
};

export interface PlanOptions {
  /** 案の配色を使う（既定は今の配色のまま） */
  usePalette: boolean;
  /** 色が個別に入っているボタン・帯も、テーマの色に合わせる */
  themeColors: boolean;
}
export const DEFAULT_PLAN_OPTIONS: PlanOptions = { usePalette: false, themeColors: false };

export interface PlanSettings {
  designStyle?: string;
  fontFamily?: string;
  accentColor?: string;
  design?: SiteDesign | null | Record<string, unknown>;
  designPreset?: string;
  styleDirection?: string;
  motionProfile?: string;
}
export interface PlanChange { label: string; detail: string }
export interface IndividualColor { blockId: string; part: string; key: RoleKey; value: string }
export interface StylePlanResult<S> {
  pages: Page[];
  settings: S;
  changes: PlanChange[];
  /** 色が個別に入っていて、テーマに合わせるかを利用者に聞く欄 */
  individualColors: IndividualColor[];
}

export const FONT_LABEL: Record<string, string> = {
  noto: 'すっきり（ゴシック）', mincho: '落ち着き（明朝）', rounded: 'やわらかい（丸ゴシック）',
  zen: 'はっきり（太めのゴシック）', biz: '読みやすさ優先', kaisei: '和の趣き',
};
const STYLE_LABEL: Record<string, string> = {
  minimal: '飾りの少ない整った形', elegant: '細い線と広い余白', modern: '丸みのあるカード',
  bold: '力強い太字', rounded: '大きな丸み', sharp: '角ばった形',
};
const DESIGN_LABEL: Record<keyof DesignPatch, string> = {
  headingScale: '見出しの大きさ', headingWeight: '見出しの太さ', headingTracking: '見出しの字間',
  titleRule: '見出しの飾り線', space: '節と節のあいだ', radius: '角の丸み', buttonShape: 'ボタンの形',
  readWidth: '一行の長さ', bodyLeading: '行の高さ',
};
const VALUE_LABEL: Record<string, string> = {
  tight: 'つめる', normal: 'ふつう', roomy: 'ひろめ', airy: 'ゆったり',
  square: '角のまま', soft: '少し丸い', pill: 'まるい', none: 'なし', short: '短い線', underline: '下線',
};
const HERO_LABEL: Record<string, string> = {
  split: '左に文字・右に写真', center: '写真の上に中央寄せの文字', left: '写真の上に左寄せの文字',
};
const PART_LABEL: Record<string, string> = { hero: '最初の画面', contact: 'お問い合わせ', booking: '予約', cta: 'ひと押し' };
export const KEY_LABEL: Record<RoleKey, string> = { bgColor: '地の色', textColor: '文字の色', buttonColor: 'ボタンの色' };
const fmt = (k: string, v: unknown) =>
  typeof v === 'string' ? (VALUE_LABEL[v] ?? v) : k === 'headingScale' ? `${v}倍` : k === 'readWidth' ? `${v}字` : k === 'radius' ? `${v}px` : String(v);

function roleTargets(block: Block, heroLayout: string): Partial<Record<RoleKey, ColorRole>> {
  switch (block.type) {
    case 'hero': return heroLayout === 'split' ? { bgColor: 'bg', textColor: 'ink' } : {};
    case 'contact':
    case 'booking': return { buttonColor: 'accent', bgColor: 'surface' };
    case 'cta': return { bgColor: 'surface', textColor: 'ink' };
    default: return {};
  }
}

export function planStyleDirection<S extends PlanSettings>(
  site: { pages: Page[]; settings: S },
  id: DirectionId,
  options: PlanOptions = DEFAULT_PLAN_OPTIONS,
): StylePlanResult<S> {
  const plan = STYLE_PLANS[id];
  const changes: PlanChange[] = [];
  const individualColors: IndividualColor[] = [];
  const before = site.settings;

  // ── サイト全体（すべてのページに効く） ──
  const hadDesign = !!before.design;
  const baseDesign = hadDesign
    ? normalizeDesign(before.design)
    : normalizeDesign(DESIGN_PRESETS.find(p => p.id === plan.basePreset)!.design);
  const palette = STUDIO_PALETTES.find(p => p.name === plan.palette)!;
  const { name: _paletteName, ...paletteColors } = palette;
  void _paletteName;
  const design: SiteDesign = { ...baseDesign, ...plan.design, ...(options.usePalette ? paletteColors : {}) };
  const settings: S = {
    ...before,
    designStyle: plan.designStyle,
    fontFamily: plan.fontFamily,
    design,
    accentColor: design.accent,
    designPreset: '',
    styleDirection: id,
    motionProfile: 'calm',
  } as S;

  if (!hadDesign)
    changes.push({ label: 'サイト全体の設定', detail: '使いはじめます。色・余白・角の丸み・写真の切り取り方が、ここで決まる設定になります' });
  if (before.fontFamily !== plan.fontFamily)
    changes.push({ label: '書体', detail: `${FONT_LABEL[before.fontFamily ?? ''] ?? '今の書体'} → ${FONT_LABEL[plan.fontFamily]}` });
  if (before.designStyle !== plan.designStyle)
    changes.push({ label: '形の雰囲気', detail: `${STYLE_LABEL[before.designStyle ?? ''] ?? '今の形'} → ${STYLE_LABEL[plan.designStyle]}` });
  for (const k of Object.keys(plan.design) as (keyof DesignPatch)[]) {
    if (baseDesign[k] !== design[k]) changes.push({ label: DESIGN_LABEL[k], detail: `${fmt(k, baseDesign[k])} → ${fmt(k, design[k])}` });
  }
  changes.push(options.usePalette
    ? { label: '配色', detail: `この案の配色「${plan.palette}」に変えます（文字・地・差し色・薄い面・罫線）` }
    : { label: '配色', detail: hadDesign ? '今の配色のままです' : 'これまでの基本の配色を使います' });
  if (before.motionProfile !== 'calm')
    changes.push({ label: '表示の動き', detail: '短いフェード（約0.3秒）だけにします。最初の画面は動かさず、見出しの打ち込み・数字のカウントアップはしません' });
  if (before.designPreset)
    changes.push({ label: '「雰囲気」の選択', detail: '選択の印は外れます（文章・写真はそのまま）' });

  // ── トップページの並びと節ごとの設定（他のページは触らない） ──
  const [top, ...rest] = site.pages;
  if (!top) return { pages: site.pages, settings, changes, individualColors };
  const beforeBlocks = top.blocks;
  let blocks = arrangeDirection(beforeBlocks, id, design.ink);
  let aligned = 0;
  blocks = blocks.map(b => {
    let data = b.data;
    if (b.type === 'hero') {
      if (plan.heroSplit) data = { ...data, heroLayout: 'split', compositionStyle: 'editorial', textColor: design.ink };
      if (plan.mobileWholePhoto) data = { ...data, mobilePhotoFit: 'contain' };
    }
    if (plan.alignLeft && (b.type === 'paragraph' || b.type === 'heading') && data.align !== 'left') {
      data = { ...data, align: 'left' };
      aligned++;
    }
    // ボタン・帯の色：役割を付ける。色が個別に入っている欄は、利用者が選んだときだけ
    const heroLayout = String(data.heroLayout || '');
    const targets = roleTargets(b, heroLayout);
    const roles = { ...colorRolesOf(data) };
    if (b.type === 'hero' && heroLayout !== 'split') delete roles.textColor;
    for (const [key, role] of Object.entries(targets) as [RoleKey, ColorRole][]) {
      const value = typeof data[key] === 'string' ? (data[key] as string).trim() : '';
      const individual = !!value && !(b.type === 'hero' && key === 'textColor') && roles[key] !== role;
      if (individual) individualColors.push({ blockId: b.id, part: PART_LABEL[b.type] ?? b.type, key, value });
      if (!individual || options.themeColors) roles[key] = role;
    }
    const prevRoles = colorRolesOf(b.data);
    if (JSON.stringify(roles) !== JSON.stringify(prevRoles)) {
      data = { ...data };
      if (Object.keys(roles).length) data.colorRoles = roles;
      else delete data.colorRoles;
    }
    return data === b.data ? b : { ...b, data };
  });

  const heroBefore = beforeBlocks.find(b => b.type === 'hero');
  const heroAfter = blocks.find(b => b.type === 'hero');
  if (heroAfter) {
    const from = String(heroBefore?.data.heroLayout || '') || 'サイト全体の設定どおり';
    const to = String(heroAfter.data.heroLayout || '');
    if (from !== to) changes.push({ label: '最初の画面', detail: `${HERO_LABEL[from] ?? from} → ${HERO_LABEL[to] ?? to}` });
    if (to !== 'split')
      changes.push({ label: '最初の画面（写真が見本のまま・写真が無い間）', detail: '文字と写真の場所を上下に分けて表示します。写真を差し替えると、写真の上に文字を重ねます' });
    if (plan.mobileWholePhoto && heroBefore?.data.mobilePhotoFit !== 'contain')
      changes.push({ label: 'スマホの最初の画面', detail: '写真の全体を残し、文字と写真を分けます' });
  }
  const galleryBefore = beforeBlocks.find(b => b.type === 'gallery');
  const galleryAfter = blocks.find(b => b.type === 'gallery');
  if (galleryAfter && (galleryBefore?.data.galleryLayout !== galleryAfter.data.galleryLayout || galleryBefore?.data.columns !== galleryAfter.data.columns))
    changes.push({ label: '写真の並べ方', detail: `${galleryAfter.data.galleryLayout === 'stack' ? 'スクロールで重ねる' : '整列して並べる'}（横に${galleryAfter.data.galleryLayout === 'stack' ? 1 : galleryAfter.data.columns}枚）` });
  const seq = (list: Block[]) => directionSequence(list).map(x => x.label).join(' → ');
  if (seq(beforeBlocks) !== seq(blocks)) changes.push({ label: '節の順番（トップページ）', detail: seq(blocks) });
  if (aligned) changes.push({ label: '見出し・紹介文の寄せ', detail: `左寄せにそろえます（${aligned}か所）` });
  const roleCount = blocks.filter(b => Object.keys(colorRolesOf(b.data)).length).length;
  if (roleCount) changes.push({ label: 'ボタン・帯の色', detail: 'テーマの色に合わせます。あとで配色を変えても追従します' });
  changes.push({
    label: '効く範囲',
    /* 言葉で伝える／内容で選んでもらうは、左寄せの本文・FAQ・営業時間・問い合わせ欄の
       読み始めを揃えるCSSがサイト全体に効く（lib/style-direction-css.ts）。説明もそれに合わせる */
    detail: (id === 'immersive' ? '色・書体・余白・動き' : '色・書体・余白・動き・左寄せの本文の読み始め・問い合わせ欄のまとまり')
      + (rest.length
        ? 'はサイト全体（すべてのページ）に効きます。最初の画面・節の並び替え・写真の並べ方・寄せの設定はトップページだけです'
        : 'はサイト全体に効きます'),
  });
  return { pages: [{ ...top, blocks }, ...rest], settings, changes, individualColors };
}
