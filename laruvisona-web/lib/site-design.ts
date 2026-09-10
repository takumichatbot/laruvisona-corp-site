// サイト全体の見た目を、CSSを書かずに整えるための設定。
//
// これまで、色や余白や書体の細かい調整は customCss に手書きするしかなかった。
// 基準作品の美容室も、4,500文字ほどのCSSを人が書いて成り立っていた。
// それでは顧客は自分で直せないし、同じ調整を業種ごとに書き直すことになる。
//
// ここでは、顧客が言葉で選べる項目（文字の色・地の色・差し色・余白の広さ・
// 見出しの大きさ・角の丸み…）だけを持ち、CSSの生成はこちらで行う。
// 生成したCSSは公開HTMLと編集画面のプレビューの両方で同じものを使う。
//
// 互換性: settings.design が無いサイトは、これまでどおり何も足さない。
// 既存のサイトの見え方は変わらない。

export type SpaceScale = 'tight' | 'normal' | 'roomy' | 'airy';
export type ButtonShape = 'square' | 'soft' | 'pill';
export type PhotoRatio = '1:1' | '4:5' | '3:4' | '4:3' | '16:9';
export type TitleRule = 'none' | 'short' | 'underline';

export interface SiteDesign {
  /** 文字の色 */
  ink: string;
  /** 地の色 */
  bg: string;
  /** 差し色（ボタン・強調） */
  accent: string;
  /** 差し色の上に載る文字の色 */
  onAccent: string;
  /** 薄い面の色（カード・帯） */
  surface: string;
  /** 罫線の色 */
  line: string;
  /** 本文の大きさ（1 = 16px 相当） */
  bodyScale: number;
  /** 行の高さ */
  bodyLeading: number;
  /** 本文の字間（em） */
  bodyTracking: number;
  /** 見出しの大きさ（1 = 既定） */
  headingScale: number;
  /** 見出しの字間（em） */
  headingTracking: number;
  /** 見出しの太さ */
  headingWeight: number;
  /** 節と節のあいだの広さ */
  space: SpaceScale;
  /** 角の丸み（px） */
  radius: number;
  /** ボタンの形 */
  buttonShape: ButtonShape;
  /** 一行の読み幅（全角文字の数の目安） */
  readWidth: number;
  /** 写真の比率（ギャラリー） */
  photoRatio: PhotoRatio;
  /** 見出しの飾り線 */
  titleRule: TitleRule;
}

export const DEFAULT_DESIGN: SiteDesign = {
  ink: '#1f2937',
  bg: '#ffffff',
  accent: '#2563eb',
  onAccent: '#ffffff',
  surface: '#f7f8fa',
  line: '#e5e7eb',
  bodyScale: 1,
  bodyLeading: 1.9,
  bodyTracking: 0.01,
  headingScale: 1,
  headingTracking: 0.02,
  headingWeight: 700,
  space: 'normal',
  radius: 12,
  buttonShape: 'soft',
  readWidth: 34,
  photoRatio: '1:1',
  titleRule: 'none',
};

const SPACE_PAD: Record<SpaceScale, string> = {
  tight: 'clamp(32px,4.5vw,52px)',
  normal: 'clamp(44px,6vw,72px)',
  roomy: 'clamp(48px,7vw,80px)',
  airy: 'clamp(56px,8.5vw,104px)',
};

const BUTTON_RADIUS: Record<ButtonShape, string> = {
  square: '0px',
  soft: 'var(--lhp-d-r)',
  pill: '9999px',
};

const RATIO: Record<PhotoRatio, string> = {
  '1:1': '1/1', '4:5': '4/5', '3:4': '3/4', '4:3': '4/3', '16:9': '16/9',
};

/** 数値を範囲におさめる。設定画面の値をそのまま信用しない */
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
};

/**
 * 色として安全に使える文字列だけを通す。
 * 設定は利用者が触れる値なので、CSSへそのまま差し込む前に形を確かめる。
 * `#fff` `#8a6a43` `rgb(0 0 0 / .3)` などを許し、それ以外は既定値に落とす。
 */
export function safeColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i.test(s)) return s;
  if (/^rgba?\([0-9a-z.,%/\s]{1,60}\)$/i.test(s)) return s;
  if (/^hsla?\([0-9a-z.,%/\s]{1,60}\)$/i.test(s)) return s;
  if (/^[a-z]{3,20}$/i.test(s)) return s; // transparent, white ...
  return fallback;
}

/** 保存されている値を、範囲と形を確かめたうえで SiteDesign にそろえる */
export function normalizeDesign(raw: unknown): SiteDesign {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const space = (['tight', 'normal', 'roomy', 'airy'] as const).includes(d.space as SpaceScale)
    ? d.space as SpaceScale : DEFAULT_DESIGN.space;
  const buttonShape = (['square', 'soft', 'pill'] as const).includes(d.buttonShape as ButtonShape)
    ? d.buttonShape as ButtonShape : DEFAULT_DESIGN.buttonShape;
  const photoRatio = (['1:1', '4:5', '3:4', '4:3', '16:9'] as const).includes(d.photoRatio as PhotoRatio)
    ? d.photoRatio as PhotoRatio : DEFAULT_DESIGN.photoRatio;
  const titleRule = (['none', 'short', 'underline'] as const).includes(d.titleRule as TitleRule)
    ? d.titleRule as TitleRule : DEFAULT_DESIGN.titleRule;
  return {
    ink: safeColor(d.ink, DEFAULT_DESIGN.ink),
    bg: safeColor(d.bg, DEFAULT_DESIGN.bg),
    accent: safeColor(d.accent, DEFAULT_DESIGN.accent),
    onAccent: safeColor(d.onAccent, DEFAULT_DESIGN.onAccent),
    surface: safeColor(d.surface, DEFAULT_DESIGN.surface),
    line: safeColor(d.line, DEFAULT_DESIGN.line),
    bodyScale: clamp(d.bodyScale, 0.85, 1.25, DEFAULT_DESIGN.bodyScale),
    bodyLeading: clamp(d.bodyLeading, 1.5, 2.3, DEFAULT_DESIGN.bodyLeading),
    bodyTracking: clamp(d.bodyTracking, 0, 0.12, DEFAULT_DESIGN.bodyTracking),
    headingScale: clamp(d.headingScale, 0.8, 1.4, DEFAULT_DESIGN.headingScale),
    headingTracking: clamp(d.headingTracking, 0, 0.2, DEFAULT_DESIGN.headingTracking),
    headingWeight: clamp(d.headingWeight, 200, 900, DEFAULT_DESIGN.headingWeight),
    space,
    radius: clamp(d.radius, 0, 32, DEFAULT_DESIGN.radius),
    buttonShape,
    readWidth: clamp(d.readWidth, 24, 46, DEFAULT_DESIGN.readWidth),
    photoRatio,
    titleRule,
  };
}

/**
 * 設定から、公開HTMLと編集プレビューの両方で使うCSSを作る。
 *
 * 既定のCSSより後ろに置く前提。customCss はさらに後ろに来るので、
 * 顧客が細かく上書きしたい場合はこれまでどおり書ける。
 */
export function designCss(raw: unknown): string {
  const d = normalizeDesign(raw);
  const pad = SPACE_PAD[d.space];
  const bodyPx = (16 * d.bodyScale).toFixed(2);
  const bodyPxSp = (15.5 * d.bodyScale).toFixed(2);
  return `
/* サイト全体の見た目（設定から生成。手書きのCSSではない） */
:root{
  --lhp-d-ink:${d.ink};
  --lhp-d-bg:${d.bg};
  --lhp-d-accent:${d.accent};
  --lhp-d-on-accent:${d.onAccent};
  --lhp-d-surface:${d.surface};
  --lhp-d-line:${d.line};
  --lhp-d-r:${d.radius}px;
  --lhp-d-btn-r:${BUTTON_RADIUS[d.buttonShape]};
  --lhp-d-read:${d.readWidth}em;
  --lhp-d-pad:${pad};
  --lhp-d-photo:${RATIO[d.photoRatio]};
  --lhp-r:${d.radius}px;
  --lhp-img-r:${d.radius}px;
  --lhp-btn-r:${BUTTON_RADIUS[d.buttonShape]};
  --lhp-accent:${d.accent};
}
body{color:var(--lhp-d-ink);background:var(--lhp-d-bg)}

/* 本文。和文は行を広めに取らないと、面として読みにくい */
.lhp-section p,.lhp-faq-a,.lhp-price-desc,.lhp-col p,.lhp-section-sub,.lhp-hours-note{
  font-size:${bodyPx}px;line-height:${d.bodyLeading};letter-spacing:${d.bodyTracking}em;
}
@media(max-width:640px){
  .lhp-section p,.lhp-faq-a,.lhp-col p{font-size:${bodyPxSp}px;line-height:${Math.max(1.5, d.bodyLeading - 0.1).toFixed(2)}}
}
/* 一行が長くなりすぎないように読み幅で止める */
.lhp-section > p,.lhp-section-sub,.lhp-hours-note{max-width:var(--lhp-d-read);margin-left:auto;margin-right:auto}
.lhp-section > p + p{margin-top:1.4em}

/* 見出し */
.lhp-section-title{
  font-size:clamp(${(20 * d.headingScale).toFixed(1)}px,${(3 * d.headingScale).toFixed(2)}vw,${(28 * d.headingScale).toFixed(1)}px);
  letter-spacing:${d.headingTracking}em;font-weight:${d.headingWeight};color:var(--lhp-d-ink);
  margin-bottom:.9em;border-bottom:none;padding-bottom:0;
}
${d.titleRule === 'short' ? `/* 飾り線は、見出しの寄せに合わせる。中央寄せの見出しには inline style が付く */
.lhp-section-title::after{content:"";display:block;width:34px;height:1px;background:var(--lhp-d-accent);margin:.7em auto 0 0}
.lhp-section-title[style*="text-align:center"]::after,.lhp-cta .lhp-section-title::after{margin-left:auto;margin-right:auto}` : ''}
${d.titleRule === 'underline' ? `.lhp-section-title{border-bottom:1px solid var(--lhp-d-line);padding-bottom:.5em}` : ''}
.lhp-hero h1{letter-spacing:${(d.headingTracking + 0.02).toFixed(3)}em;font-weight:${d.headingWeight}}

/* 節の間隔 */
.lhp-section{padding-top:var(--lhp-d-pad);padding-bottom:var(--lhp-d-pad)}
.lhp-contact,.lhp-cta,.lhp-testimonials-bg{padding-top:var(--lhp-d-pad);padding-bottom:var(--lhp-d-pad)}
/* 見出しだけの節は、次の節と余白が二重になる */
.lhp-section:has(> h2:only-child){padding-bottom:0}
.lhp-section:has(> h2:only-child) + .lhp-section{padding-top:clamp(20px,2.4vw,28px)}

/* ボタン */
.lhp-btn-primary,.lhp-btn-cta,.lhp-price-btn,.lhp-form button{
  background:var(--lhp-d-accent);color:var(--lhp-d-on-accent);border-radius:var(--lhp-d-btn-r);
  min-height:52px;letter-spacing:.06em;
}
.lhp-btn-primary,.lhp-btn-cta{display:inline-flex;align-items:center;justify-content:center}
.lhp-price-btn{display:flex;align-items:center;justify-content:center}

/* 面と罫線 */
.lhp-card,.lhp-price-card,.lhp-testimonial{border:1px solid var(--lhp-d-line);border-radius:var(--lhp-d-r)}
.lhp-price-featured{background:var(--lhp-d-surface);border-color:var(--lhp-d-accent)}
.lhp-price-badge{background:var(--lhp-d-accent);color:var(--lhp-d-on-accent);letter-spacing:.08em}
.lhp-faq-item{border:none;border-bottom:1px solid var(--lhp-d-line);border-radius:0}
.lhp-faq-q{min-height:56px}
.lhp-hours th,.lhp-hours td{border-bottom:1px solid var(--lhp-d-line)}
.lhp-col{background:var(--lhp-d-surface);border-radius:var(--lhp-d-r)}

/* 写真 */
.lhp-gallery-img{aspect-ratio:var(--lhp-d-photo);object-fit:cover;border-radius:var(--lhp-d-r)}

/* 入力欄。指で押せる大きさにする */
.lhp-form input,.lhp-form select,.lhp-form textarea{
  min-height:52px;font-size:16px;border-radius:var(--lhp-d-r);border:1px solid var(--lhp-d-line);
}
`.trim();
}

/* ── 雰囲気の見本 ─────────────────────────────────────────────────────
   はじめての人が「どんな感じにしたいか」だけ選べば、色・書体・余白・
   角の丸みがまとめて決まる。あとから1項目ずつ直せる。            */

export interface DesignPreset {
  id: string;
  name: string;
  /** どんな店に向くか。専門用語を使わない */
  note: string;
  designStyle: string;
  fontFamily: string;
  design: SiteDesign;
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: 'calm',
    name: '落ち着いた',
    note: '白と墨。文字を読ませたいとき。士業・教室・クリニック',
    designStyle: 'minimal',
    fontFamily: 'noto',
    design: {
      ...DEFAULT_DESIGN,
      ink: '#20262e', bg: '#ffffff', accent: '#2f5d7c', onAccent: '#ffffff',
      surface: '#f4f6f8', line: '#e3e7eb',
      bodyLeading: 1.95, bodyTracking: 0.015, headingWeight: 600, headingTracking: 0.04,
      space: 'normal', radius: 6, buttonShape: 'soft', readWidth: 34, titleRule: 'underline',
    },
  },
  {
    id: 'warm',
    name: 'やわらかい',
    note: '生成りと木の色。丸みのある形。カフェ・パン屋・子ども向け',
    designStyle: 'rounded',
    fontFamily: 'rounded',
    design: {
      ...DEFAULT_DESIGN,
      ink: '#3b332c', bg: '#fffdf9', accent: '#c98b4b', onAccent: '#ffffff',
      surface: '#fbf4ea', line: '#ece0d2',
      bodyLeading: 1.95, bodyTracking: 0.02, headingWeight: 700, headingTracking: 0.02,
      space: 'normal', radius: 20, buttonShape: 'pill', readWidth: 32, photoRatio: '4:5',
      titleRule: 'none',
    },
  },
  {
    id: 'refined',
    name: '上質',
    note: '明朝と広い余白。美容・和食・ブライダル',
    designStyle: 'elegant',
    fontFamily: 'mincho',
    design: {
      ...DEFAULT_DESIGN,
      ink: '#2a2724', bg: '#ffffff', accent: '#8a6a43', onAccent: '#ffffff',
      surface: '#f7f4ef', line: '#e2dcd2',
      bodyScale: 1.03, bodyLeading: 2.05, bodyTracking: 0.02,
      headingScale: 1, headingTracking: 0.06, headingWeight: 600,
      space: 'roomy', radius: 2, buttonShape: 'square', readWidth: 34,
      photoRatio: '4:5', titleRule: 'short',
    },
  },
  {
    id: 'strong',
    name: '力強い',
    note: '濃い地に太い文字。建設・整備・スポーツ',
    designStyle: 'bold',
    fontFamily: 'zen',
    design: {
      ...DEFAULT_DESIGN,
      ink: '#15181d', bg: '#ffffff', accent: '#c2410c', onAccent: '#ffffff',
      surface: '#f4f4f5', line: '#d9dadd',
      bodyLeading: 1.85, bodyTracking: 0.01, headingWeight: 800, headingTracking: 0,
      headingScale: 1.15, space: 'roomy', radius: 4, buttonShape: 'square',
      readWidth: 33, photoRatio: '4:3', titleRule: 'none',
    },
  },
  {
    id: 'fresh',
    name: '明るい',
    note: '白と青。清潔さを出したいとき。歯科・整体・教室',
    designStyle: 'modern',
    fontFamily: 'noto',
    design: {
      ...DEFAULT_DESIGN,
      ink: '#1f2937', bg: '#ffffff', accent: '#0e7490', onAccent: '#ffffff',
      surface: '#f0f7f9', line: '#dfe8ec',
      bodyLeading: 1.9, bodyTracking: 0.01, headingWeight: 700, headingTracking: 0.01,
      space: 'normal', radius: 14, buttonShape: 'pill', readWidth: 34, titleRule: 'none',
    },
  },
];

export const findPreset = (id: string) => DESIGN_PRESETS.find(p => p.id === id);
