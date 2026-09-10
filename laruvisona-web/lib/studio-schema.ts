// 制作画面（スタジオ）で、ブロックごとに「何を直せるか」を決める表。
//
// 編集画面・プレビュー・公開ページで見え方をそろえるため、描画は公開用の
// exportToHTML に一本化してある。こちらが持つのは「触れる項目」の定義だけ。
//
// 項目名は、はじめての人が読んで分かる言葉にする。
// 内部の呼び名（hero, cta, slug…）を画面に出さない。

import type { Block } from '@/types/laruHP';

export type FieldType =
  | 'text' | 'multiline' | 'color' | 'image' | 'select' | 'toggle' | 'number' | 'list';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** 入力欄の下に出す短い説明。無ければ出さない */
  hint?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  /** type: 'list' のとき、1件あたりの項目 */
  item?: FieldDef[];
  /** type: 'list' のとき、追加したときの初期値 */
  itemDefault?: Record<string, unknown>;
  /** 文字列の配列（画像の並びなど）を扱う */
  ofStrings?: boolean;
}

export interface BlockDef {
  /** 画面に出す名前 */
  label: string;
  /** 一覧で出す絵文字 */
  icon: string;
  /** 何のための節かを一言で */
  purpose: string;
  fields: FieldDef[];
}

const ALIGN: FieldDef = {
  key: 'align', label: '文字の寄せ', type: 'select',
  options: [{ value: 'left', label: '左' }, { value: 'center', label: '中央' }, { value: 'right', label: '右' }],
};

export const BLOCK_DEFS: Record<string, BlockDef> = {
  hero: {
    label: '最初の画面', icon: '🏞', purpose: '来た人が最初に見る場所。何の店かと、次にしてほしいことを置く',
    fields: [
      { key: 'heading', label: '主なコピー', type: 'multiline', hint: '改行した位置で折り返します' },
      { key: 'subheading', label: '店名・ひとこと', type: 'text' },
      { key: 'ctaText', label: 'ボタンの文字', type: 'text', placeholder: 'ご予約フォームへ' },
      { key: 'ctaLink', label: 'ボタンの行き先', type: 'text', placeholder: '#booking' },
      { key: 'bgImage', label: '写真', type: 'image' },
      { key: 'bgImageAlt', label: '写真の説明', type: 'text', hint: '目の見えない方の読み上げと、写真が出ないときに使います' },
      {
        key: 'bgImagePosition', label: '写真の見せ場（パソコン）', type: 'select',
        hint: '切り取られたときに、どこを残すか',
        options: [
          { value: '', label: '中央' }, { value: '50% 20%', label: '上より' },
          { value: '50% 80%', label: '下より' }, { value: '20% 50%', label: '左より' },
          { value: '80% 50%', label: '右より' },
        ],
      },
      {
        key: 'bgImagePositionSp', label: '写真の見せ場（スマホ）', type: 'select',
        hint: 'スマホは縦に長く切られるので、別に決められます',
        options: [
          { value: '', label: 'パソコンと同じ' }, { value: '50% 20%', label: '上より' },
          { value: '50% 80%', label: '下より' }, { value: '20% 50%', label: '左より' },
          { value: '80% 50%', label: '右より' },
        ],
      },
      { key: 'heroVideo', label: '動く背景（mp4）', type: 'text', hint: '写真が先に出て、動画はあとから重なります。音は出ません。端末が「動きを減らす」設定のときは読み込みません' },
      { key: 'heroVideoWebm', label: '動く背景（webm・任意）', type: 'text' },
      { key: 'bgColor', label: '地の色', type: 'color' },
      { key: 'textColor', label: '文字の色', type: 'color' },
    ],
  },
  heading: {
    label: '見出し', icon: '📛', purpose: '話題の区切り',
    fields: [
      { key: 'text', label: '見出し', type: 'text' },
      { key: 'subtext', label: '補足', type: 'text' },
      ALIGN,
    ],
  },
  paragraph: {
    label: '文章', icon: '📝', purpose: '考えていること、店の成り立ち',
    fields: [
      { key: 'text', label: '本文', type: 'multiline', hint: '空の行を入れると段落が変わります' },
      ALIGN,
    ],
  },
  image: {
    label: '写真', icon: '🖼', purpose: '1枚の写真',
    fields: [
      { key: 'src', label: '写真', type: 'image' },
      { key: 'alt', label: '写真の説明', type: 'text' },
      { key: 'height', label: '高さ（px）', type: 'number', min: 120, max: 900 },
    ],
  },
  gallery: {
    label: '写真をならべる', icon: '🖼', purpose: '仕上がり・商品・店内',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'images', label: '写真', type: 'list', ofStrings: true, itemDefault: {} },
      {
        key: 'columns', label: '横に並べる数', type: 'select',
        options: [{ value: '2', label: '2枚' }, { value: '3', label: '3枚' }],
      },
    ],
  },
  'price-table': {
    label: 'メニューと料金', icon: '💴', purpose: 'いくらで何をしてもらえるか',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'subtext', label: '補足', type: 'text', placeholder: '表示は税込です' },
      {
        key: 'plans', label: 'メニュー', type: 'list',
        itemDefault: { name: '新しいメニュー', price: '0', period: '円', description: '', features: [], highlighted: false, buttonText: 'このメニューで予約する', buttonLink: '#booking' },
        item: [
          { key: 'name', label: '名前', type: 'text' },
          { key: 'price', label: '金額', type: 'text', placeholder: '6,600' },
          { key: 'period', label: '単位', type: 'text', placeholder: '円' },
          { key: 'description', label: '説明', type: 'text' },
          { key: 'highlighted', label: 'おすすめとして目立たせる', type: 'toggle' },
          { key: 'buttonText', label: 'ボタンの文字', type: 'text' },
        ],
      },
    ],
  },
  team: {
    label: '担当する人', icon: '🧑', purpose: '誰に見てもらえるかが分かると、予約の不安が減る',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      {
        key: 'items', label: '人', type: 'list',
        itemDefault: { name: '氏名', role: '担当', bio: '', photo: '' },
        item: [
          { key: 'photo', label: '写真', type: 'image' },
          { key: 'name', label: '名前', type: 'text' },
          { key: 'role', label: '肩書き', type: 'text' },
          { key: 'bio', label: '紹介', type: 'text' },
        ],
      },
    ],
  },
  faq: {
    label: 'よくある質問', icon: '❓', purpose: '問い合わせの手前で答えておく',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      {
        key: 'items', label: '質問と答え', type: 'list',
        itemDefault: { q: '質問', a: '答え' },
        item: [
          { key: 'q', label: '質問', type: 'text' },
          { key: 'a', label: '答え', type: 'multiline' },
        ],
      },
    ],
  },
  hours: {
    label: '営業時間', icon: '🕘', purpose: 'いつ行けるか',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      {
        key: 'schedule', label: '曜日', type: 'list',
        itemDefault: { day: '月', hours: '10:00〜19:00', closed: false },
        item: [
          { key: 'day', label: '曜日', type: 'text' },
          { key: 'hours', label: '時間', type: 'text', placeholder: '10:00〜19:00' },
          { key: 'closed', label: '定休日', type: 'toggle' },
        ],
      },
      { key: 'note', label: '注意書き', type: 'multiline' },
    ],
  },
  booking: {
    label: '予約', icon: '📅', purpose: '来てほしい日時を受け取る',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'subtext', label: '案内文', type: 'multiline' },
      { key: 'serviceTypes', label: '選べるメニュー', type: 'list', ofStrings: true },
      { key: 'timeSlots', label: '選べる時間', type: 'list', ofStrings: true },
      { key: 'buttonText', label: '送信ボタンの文字', type: 'text' },
      { key: 'stickyCta', label: 'スマホの画面下に予約ボタンを出す', type: 'toggle' },
      { key: 'stickyCtaText', label: 'そのボタンの文字', type: 'text' },
      { key: 'bgColor', label: '地の色', type: 'color' },
      { key: 'buttonColor', label: 'ボタンの色', type: 'color' },
    ],
  },
  contact: {
    label: 'お問い合わせ', icon: '✉️', purpose: '予約以外の相談を受け取る',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'subtext', label: '案内文', type: 'multiline' },
      { key: 'buttonText', label: '送信ボタンの文字', type: 'text' },
      { key: 'bgColor', label: '地の色', type: 'color' },
      { key: 'buttonColor', label: 'ボタンの色', type: 'color' },
    ],
  },
  'two-col': {
    label: '2つ並べる', icon: '🔲', purpose: 'アクセスと連絡先など、対になる情報',
    fields: [
      { key: 'col1Title', label: '左の見出し', type: 'text' },
      { key: 'col1Text', label: '左の本文', type: 'multiline' },
      { key: 'col2Title', label: '右の見出し', type: 'text' },
      { key: 'col2Text', label: '右の本文', type: 'multiline' },
    ],
  },
  map: {
    label: '地図', icon: '🗺', purpose: '場所',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'embedUrl', label: '地図の埋め込みURL', type: 'text', hint: 'Googleマップの「共有」→「地図を埋め込む」で出るURL' },
      { key: 'height', label: '高さ（px）', type: 'number', min: 200, max: 700 },
    ],
  },
  cta: {
    label: 'ひと押し', icon: '👉', purpose: '最後にもう一度、行き先を示す',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      { key: 'subtext', label: '補足', type: 'text' },
      { key: 'buttonText', label: 'ボタンの文字', type: 'text' },
      { key: 'buttonLink', label: 'ボタンの行き先', type: 'text' },
      { key: 'bgColor', label: '地の色', type: 'color' },
    ],
  },
  tabs: {
    label: '折りたたみ', icon: '🗂', purpose: '長い一覧を分けて見せる',
    fields: [
      { key: 'heading', label: '見出し', type: 'text' },
      {
        key: 'items', label: '見出しと中身', type: 'list',
        itemDefault: { label: '見出し', body: '' },
        item: [
          { key: 'label', label: '見出し', type: 'text' },
          { key: 'body', label: '中身', type: 'multiline' },
        ],
      },
    ],
  },
};

/** 一覧に出す名前。定義が無いブロックでも、それらしい名前を返す */
export function blockLabel(block: Block): string {
  const def = BLOCK_DEFS[block.type];
  if (def) return def.label;
  return block.type;
}

export function blockIcon(block: Block): string {
  return BLOCK_DEFS[block.type]?.icon ?? '⬜';
}

/** 一覧に出す1行の要約。中身の最初の文字を使う */
export function blockSummary(block: Block): string {
  const d = block.data as Record<string, unknown>;
  for (const k of ['heading', 'text', 'col1Title', 'label', 'alt']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v.replace(/\s+/g, ' ').slice(0, 24);
  }
  const items = d.items ?? d.plans ?? d.images ?? d.schedule;
  if (Array.isArray(items)) return `${items.length}件`;
  return '';
}

/* ── ヒアリング ─────────────────────────────────────────────────────── */

export interface IntakeAnswers {
  /** 何の仕事か */
  industry: string;
  /** 店名・屋号 */
  name: string;
  /** 地域 */
  area: string;
  /** 誰に来てほしいか */
  audience: string;
  /** 来た人にしてほしいこと */
  goal: 'booking' | 'contact' | 'visit' | 'buy';
  /** ひとこと */
  description: string;
}

export const GOALS: Array<{ value: IntakeAnswers['goal']; label: string; note: string }> = [
  { value: 'booking', label: '予約してほしい', note: '日時を選んで送れる欄を置きます' },
  { value: 'contact', label: '相談してほしい', note: '問い合わせの欄を目立つ場所に置きます' },
  { value: 'visit', label: '店に来てほしい', note: '地図・営業時間・道順を前に出します' },
  { value: 'buy', label: '買ってほしい', note: '商品と料金を前に出します' },
];

export const INDUSTRY_CHOICES: Array<{ value: string; label: string }> = [
  { value: 'beauty', label: '美容室・サロン' },
  { value: 'restaurant', label: '飲食店・カフェ' },
  { value: 'clinic', label: '整体・治療院' },
  { value: 'dental', label: '歯科' },
  { value: 'legal', label: '士業・相談業' },
  { value: 'construction', label: '工事・施工' },
  { value: 'education', label: '教室・スクール' },
  { value: 'fitness', label: 'ジム・スタジオ' },
  { value: 'retail', label: '物販・小売' },
  { value: 'photo', label: '写真・制作' },
  { value: 'pet', label: 'ペット' },
  { value: 'realestate', label: '不動産' },
];

/** 目的に合わせて、節の並びを入れ替える */
export function orderForGoal(blocks: Block[], goal: IntakeAnswers['goal']): Block[] {
  const weight = (b: Block): number => {
    const base: Record<string, number> = {
      nav: 0, hero: 1, heading: 2, paragraph: 3, 'price-table': 5, services: 5,
      tabs: 6, team: 7, gallery: 8, testimonials: 9, faq: 10, hours: 11,
      booking: 12, 'two-col': 13, map: 14, contact: 15, cta: 16,
    };
    let w = base[b.type] ?? 12;
    if (goal === 'booking' && b.type === 'booking') w = 4.5;
    if (goal === 'contact' && b.type === 'contact') w = 4.5;
    if (goal === 'visit' && (b.type === 'hours' || b.type === 'map')) w = 4.5;
    if (goal === 'buy' && (b.type === 'price-table' || b.type === 'services')) w = 3.5;
    return w;
  };
  return [...blocks].sort((a, b) => weight(a) - weight(b));
}
